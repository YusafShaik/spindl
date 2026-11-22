package si.spindl.engineering;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;
import si.spindl.identity.AppUserEntity;
import si.spindl.identity.AppUserRepository;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.manufacturing.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class EngineeringService {

    private final EngineeringChangeOrderRepository ecos;
    private final EcoBomDiffLineRepository diffLines;
    private final EcoSignOffRepository signOffs;
    private final BomRepository boms;
    private final BomLineRepository bomLines;
    private final ItemRepository items;
    private final AppUserRepository users;
    private final TenantAuditEventRepository audit;
    private final BomRevisionEventRepository history;

    public EngineeringService(
            EngineeringChangeOrderRepository ecos,
            EcoBomDiffLineRepository diffLines,
            EcoSignOffRepository signOffs,
            BomRepository boms,
            BomLineRepository bomLines,
            ItemRepository items,
            AppUserRepository users,
            TenantAuditEventRepository audit,
            BomRevisionEventRepository history
    ) {
        this.ecos = ecos;
        this.diffLines = diffLines;
        this.signOffs = signOffs;
        this.boms = boms;
        this.bomLines = bomLines;
        this.items = items;
        this.users = users;
        this.audit = audit;
        this.history = history;
    }

    // ==========================================
    // METRICS & LIST
    // ==========================================

    public EngineeringDtos.EngineeringMetricsView getMetrics(UUID tenantId) {
        List<EngineeringChangeOrderEntity> all = ecos.findAllByTenantIdOrderByCreatedAtDesc(tenantId);
        long active = all.stream().filter(e -> "UNDER_REVIEW".equalsIgnoreCase(e.getStatus()) || "APPROVED".equalsIgnoreCase(e.getStatus())).count();
        long pendingSignOffs = all.stream()
                .filter(e -> "UNDER_REVIEW".equalsIgnoreCase(e.getStatus()))
                .flatMap(e -> e.getSignOffs().stream())
                .filter(s -> "PENDING".equalsIgnoreCase(s.getStatus()))
                .count();
        long approved = all.stream().filter(e -> "APPROVED".equalsIgnoreCase(e.getStatus())).count();
        long implemented = all.stream().filter(e -> "IMPLEMENTED".equalsIgnoreCase(e.getStatus())).count();
        long critical = all.stream().filter(e -> "CRITICAL".equalsIgnoreCase(e.getChangeSeverity())).count();

        return new EngineeringDtos.EngineeringMetricsView(
                active,
                pendingSignOffs,
                approved,
                implemented,
                critical
        );
    }

    public List<EngineeringDtos.EcoSummaryView> listEcos(UUID tenantId, String status, String severity) {
        return ecos.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .filter(e -> status == null || status.isBlank() || "ALL".equalsIgnoreCase(status) || e.getStatus().equalsIgnoreCase(status))
                .filter(e -> severity == null || severity.isBlank() || "ALL".equalsIgnoreCase(severity) || e.getChangeSeverity().equalsIgnoreCase(severity))
                .map(EngineeringMapper::toEcoSummaryView)
                .toList();
    }

    public EngineeringDtos.EcoDetailView getEco(UUID tenantId, UUID id) {
        EngineeringChangeOrderEntity eco = ecos.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Engineering Change Order not found"));
        var lines = diffLines.findAllByTenantIdAndEcoIdOrderById(tenantId, id);
        var signs = signOffs.findAllByTenantIdAndEcoIdOrderByCreatedAtAsc(tenantId, id);
        return EngineeringMapper.toEcoDetailView(eco, lines, signs);
    }

    // ==========================================
    // CREATE ECO
    // ==========================================

    @Transactional
    public EngineeringDtos.EcoDetailView createEco(UUID tenantId, UUID actorId, EngineeringDtos.CreateEcoRequest request) {
        ItemEntity finished = items.findByTenantIdAndId(tenantId, request.finishedItemId())
                .orElseThrow(() -> new BadRequestException("Finished item not found"));

        BomEntity baseBom = null;
        if (request.baseBomId() != null) {
            baseBom = boms.findByTenantIdAndId(tenantId, request.baseBomId())
                    .orElseThrow(() -> new BadRequestException("Base BOM not found"));
        } else {
            List<BomEntity> current = boms.findEffectiveApproved(tenantId, finished.getId());
            if (!current.isEmpty()) baseBom = current.getFirst();
        }

        String targetRev = request.targetRevision().trim().toUpperCase(Locale.ROOT);
        if (boms.existsByTenantIdAndFinishedItemIdAndRevision(tenantId, finished.getId(), targetRev)) {
            throw new ConflictException("Target BOM revision " + targetRev + " already exists for this finished item");
        }

        String ecoNumber = "ECO-" + YearMonth.now().format(DateTimeFormatter.ofPattern("yyyyMM")) + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);

        AppUserEntity actor = actorId != null ? users.findById(actorId).orElse(null) : null;

        EngineeringChangeOrderEntity eco = new EngineeringChangeOrderEntity(
                tenantId,
                ecoNumber,
                request.title(),
                request.reason(),
                request.changeSeverity(),
                finished,
                baseBom,
                targetRev,
                request.effectiveCutoverDate(),
                actor
        );
        eco = ecos.save(eco);

        // Add diff lines
        for (EngineeringDtos.CreateDiffLineRequest dl : request.diffLines()) {
            ItemEntity component = items.findByTenantIdAndId(tenantId, dl.componentItemId())
                    .orElseThrow(() -> new BadRequestException("Component item not found: " + dl.componentItemId()));
            EcoBomDiffLineEntity diff = new EcoBomDiffLineEntity(
                    tenantId,
                    eco,
                    dl.changeType().toUpperCase(Locale.ROOT),
                    component,
                    dl.oldQuantity(),
                    dl.newQuantity(),
                    dl.oldScrapPercent(),
                    dl.newScrapPercent(),
                    dl.notes()
            );
            eco.addDiffLine(diff);
        }

        // Initialize 4 mandatory cross-department sign-offs
        eco.addSignOff(new EcoSignOffEntity(tenantId, eco, "ENGINEERING", "Chief Design Engineer"));
        eco.addSignOff(new EcoSignOffEntity(tenantId, eco, "MANUFACTURING", "Plant Operations Lead"));
        eco.addSignOff(new EcoSignOffEntity(tenantId, eco, "QUALITY", "ISO-9001 Quality Lead"));
        eco.addSignOff(new EcoSignOffEntity(tenantId, eco, "FINANCE", "Cost Accounting Lead"));

        ecos.save(eco);

        audit.save(new TenantAuditEventEntity(
                tenantId,
                actorId,
                "ECO_CREATED",
                "engineering_change_order",
                eco.getId(),
                Map.of("ecoNumber", eco.getEcoNumber(), "finishedSku", finished.getSku(), "targetRevision", targetRev)
        ));

        return EngineeringMapper.toEcoDetailView(eco);
    }

    // ==========================================
    // STAGE-GATE SIGN-OFF
    // ==========================================

    @Transactional
    public EngineeringDtos.EcoDetailView processSignOff(UUID tenantId, UUID actorId, UUID ecoId, EngineeringDtos.SignOffRequest request) {
        EngineeringChangeOrderEntity eco = ecos.findForUpdate(tenantId, ecoId)
                .orElseThrow(() -> new NotFoundException("ECO not found"));

        if (!"UNDER_REVIEW".equalsIgnoreCase(eco.getStatus())) {
            throw new BadRequestException("Sign-offs can only be submitted for ECOs under review");
        }

        String dept = request.department().toUpperCase(Locale.ROOT);
        EcoSignOffEntity signOff = signOffs.findByTenantIdAndEcoIdAndDepartment(tenantId, ecoId, dept)
                .orElseThrow(() -> new NotFoundException("Sign-off entry not found for department: " + dept));

        AppUserEntity actor = actorId != null ? users.findById(actorId).orElse(null) : null;

        if ("APPROVE".equalsIgnoreCase(request.action())) {
            signOff.approve(actor, request.signOffRole(), request.comments());
            eco.checkAndPromoteApproved();
        } else if ("REJECT".equalsIgnoreCase(request.action())) {
            signOff.reject(actor, request.signOffRole(), request.comments());
            eco.markRejected("Rejected by " + dept + ": " + (request.comments() != null ? request.comments() : "No comments provided"));
        } else {
            throw new BadRequestException("Invalid sign-off action: " + request.action());
        }

        signOffs.save(signOff);
        ecos.save(eco);

        audit.save(new TenantAuditEventEntity(
                tenantId,
                actorId,
                "ECO_SIGNED_OFF",
                "engineering_change_order",
                eco.getId(),
                Map.of("department", dept, "action", request.action(), "newStatus", eco.getStatus())
        ));

        var lines = diffLines.findAllByTenantIdAndEcoIdOrderById(tenantId, ecoId);
        var signs = signOffs.findAllByTenantIdAndEcoIdOrderByCreatedAtAsc(tenantId, ecoId);
        return EngineeringMapper.toEcoDetailView(eco, lines, signs);
    }

    // ==========================================
    // 1-CLICK IMPLEMENTATION & CUTOVER
    // ==========================================

    @Transactional
    public EngineeringDtos.EcoDetailView implementEco(UUID tenantId, UUID actorId, UUID ecoId, EngineeringDtos.ImplementEcoRequest request) {
        EngineeringChangeOrderEntity eco = ecos.findForUpdate(tenantId, ecoId)
                .orElseThrow(() -> new NotFoundException("ECO not found"));

        if (!"APPROVED".equalsIgnoreCase(eco.getStatus())) {
            throw new BadRequestException("Only fully APPROVED ECOs can be implemented for cutover");
        }

        ItemEntity finished = eco.getFinishedItem();

        // 1. Create brand new BomEntity with target revision
        LocalDate effectiveFrom = eco.getEffectiveCutoverDate();
        BomEntity newBom = boms.save(new BomEntity(tenantId, finished.getId(), eco.getTargetRevision(), effectiveFrom, null));

        // 2. Synthesize new BOM lines from base BOM lines and ECO diff lines
        List<BomLineEntity> baseLines = eco.getBaseBom() != null
                ? bomLines.findAllByTenantIdAndBomIdOrderById(tenantId, eco.getBaseBom().getId())
                : List.of();

        List<EcoBomDiffLineEntity> currentDiffs = diffLines.findAllByTenantIdAndEcoIdOrderById(tenantId, ecoId);
        Map<UUID, EcoBomDiffLineEntity> diffMap = new HashMap<>();
        for (EcoBomDiffLineEntity d : currentDiffs) {
            diffMap.put(d.getComponentItem().getId(), d);
        }

        List<BomLineEntity> newLines = new ArrayList<>();
        Set<UUID> handledComponents = new HashSet<>();

        // Process base lines
        for (BomLineEntity bl : baseLines) {
            UUID compId = bl.getComponentItemId();
            handledComponents.add(compId);
            EcoBomDiffLineEntity diff = diffMap.get(compId);

            if (diff != null) {
                if ("REMOVE".equalsIgnoreCase(diff.getChangeType())) {
                    // Excluded from new revision
                    continue;
                } else if ("QUANTITY_CHANGE".equalsIgnoreCase(diff.getChangeType())) {
                    newLines.add(new BomLineEntity(
                            tenantId,
                            newBom.getId(),
                            compId,
                            diff.getNewQuantity(),
                            diff.getNewScrapPercent(),
                            bl.getAlternativeGroup()
                    ));
                }
            } else {
                // Unchanged line
                newLines.add(new BomLineEntity(
                        tenantId,
                        newBom.getId(),
                        compId,
                        bl.getQuantityPerUnit(),
                        bl.getScrapAllowancePercent(),
                        bl.getAlternativeGroup()
                ));
            }
        }

        // Process ADD diff lines
        for (EcoBomDiffLineEntity diff : currentDiffs) {
            if ("ADD".equalsIgnoreCase(diff.getChangeType()) && !handledComponents.contains(diff.getComponentItem().getId())) {
                newLines.add(new BomLineEntity(
                        tenantId,
                        newBom.getId(),
                        diff.getComponentItem().getId(),
                        diff.getNewQuantity(),
                        diff.getNewScrapPercent(),
                        null
                ));
            }
        }

        bomLines.saveAll(newLines);

        // 3. Obsolete prior approved BOMs for this item
        for (BomEntity prior : boms.findAllByTenantIdAndFinishedItemIdAndStatusOrderByEffectiveFromDesc(tenantId, finished.getId(), "APPROVED")) {
            prior.obsolete();
            history.save(new BomRevisionEventEntity(tenantId, prior.getId(), actorId, "OBSOLETED", "APPROVED", "OBSOLETE"));
            audit.save(new TenantAuditEventEntity(
                    tenantId,
                    actorId,
                    "BOM_OBSOLETED",
                    "bom",
                    prior.getId(),
                    Map.of("supersededBy", newBom.getRevision(), "ecoNumber", eco.getEcoNumber())
            ));
        }

        // 4. Approve new BOM
        newBom.approve();
        boms.save(newBom);
        history.save(new BomRevisionEventEntity(tenantId, newBom.getId(), actorId, "APPROVED", "DRAFT", "APPROVED"));
        audit.save(new TenantAuditEventEntity(
                tenantId,
                actorId,
                "BOM_APPROVED",
                "bom",
                newBom.getId(),
                Map.of("revision", newBom.getRevision(), "ecoNumber", eco.getEcoNumber())
        ));

        // 5. Mark ECO as IMPLEMENTED
        String notes = request != null && request.implementationNotes() != null
                ? request.implementationNotes()
                : "Automated cutover to BOM Revision " + newBom.getRevision();
        eco.markImplemented(newBom, notes);
        ecos.save(eco);

        audit.save(new TenantAuditEventEntity(
                tenantId,
                actorId,
                "ECO_IMPLEMENTED",
                "engineering_change_order",
                eco.getId(),
                Map.of("ecoNumber", eco.getEcoNumber(), "newBomId", newBom.getId().toString(), "newRevision", newBom.getRevision())
        ));

        var finalSigns = signOffs.findAllByTenantIdAndEcoIdOrderByCreatedAtAsc(tenantId, ecoId);
        return EngineeringMapper.toEcoDetailView(eco, currentDiffs, finalSigns);
    }
}
