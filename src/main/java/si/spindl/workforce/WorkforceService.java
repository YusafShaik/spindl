package si.spindl.workforce;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.identity.AppUserEntity;
import si.spindl.identity.AppUserRepository;
import si.spindl.identity.TenantMembershipEntity;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.manufacturing.WorkCenterEntity;
import si.spindl.manufacturing.WorkCenterRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class WorkforceService {

    private final WorkforceSkillRepository skillRepository;
    private final WorkforceOperatorQualificationRepository qualificationRepository;
    private final WorkforceShiftRepository shiftRepository;
    private final WorkforceRosterAssignmentRepository rosterRepository;
    private final TenantMembershipRepository membershipRepository;
    private final AppUserRepository userRepository;
    private final WorkCenterRepository workCenterRepository;
    private final PasswordEncoder passwordEncoder;

    public WorkforceService(
            WorkforceSkillRepository skillRepository,
            WorkforceOperatorQualificationRepository qualificationRepository,
            WorkforceShiftRepository shiftRepository,
            WorkforceRosterAssignmentRepository rosterRepository,
            TenantMembershipRepository membershipRepository,
            AppUserRepository userRepository,
            WorkCenterRepository workCenterRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.skillRepository = skillRepository;
        this.qualificationRepository = qualificationRepository;
        this.shiftRepository = shiftRepository;
        this.rosterRepository = rosterRepository;
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
        this.workCenterRepository = workCenterRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // ==========================================
    // EMPLOYEES & WORKFORCE DIRECTORY
    // ==========================================

    @Transactional(readOnly = true)
    public List<WorkforceDtos.EmployeeDto> listEmployees(UUID tenantId) {
        List<TenantMembershipEntity> memberships = membershipRepository.findAllByTenantIdOrderByCreatedAtAsc(tenantId);
        List<WorkforceOperatorQualificationEntity> allQuals = qualificationRepository.findAllByTenantIdOrderByCreatedAtDesc(tenantId);

        Map<UUID, List<WorkforceOperatorQualificationEntity>> qualsByUser = allQuals.stream()
                .collect(Collectors.groupingBy(q -> q.getUser().getId()));

        List<WorkforceDtos.EmployeeDto> result = new ArrayList<>();
        for (TenantMembershipEntity m : memberships) {
            Optional<AppUserEntity> userOpt = userRepository.findById(m.getUserId());
            if (userOpt.isEmpty()) continue;
            AppUserEntity user = userOpt.get();

            List<WorkforceOperatorQualificationEntity> userQuals = qualsByUser.getOrDefault(user.getId(), Collections.emptyList());
            List<WorkforceDtos.EmployeeSkillDto> skillDtos = userQuals.stream()
                    .map(q -> new WorkforceDtos.EmployeeSkillDto(
                            q.getId(),
                            q.getSkill().getId(),
                            q.getSkill().getSkillCode(),
                            q.getSkill().getName(),
                            q.getSkill().getCategory(),
                            q.getQualificationLevel(),
                            q.getCertifiedAt(),
                            q.getExpiresAt(),
                            q.getStatus(),
                            q.getNotes()
                    ))
                    .toList();

            result.add(new WorkforceDtos.EmployeeDto(
                    user.getId(),
                    m.getId(),
                    user.getDisplayName(),
                    user.getEmail(),
                    m.getRole(),
                    m.isActive(),
                    skillDtos,
                    m.getCreatedAt()
            ));
        }
        return result;
    }

    public WorkforceDtos.EmployeeDto createEmployee(UUID tenantId, UUID actorId, WorkforceDtos.CreateEmployeeRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("Employee name is required.");
        }
        if (req.email() == null || req.email().isBlank()) {
            throw new IllegalArgumentException("Employee email is required.");
        }

        String email = req.email().trim().toLowerCase();
        String name = req.name().trim();
        String role = (req.role() != null && !req.role().isBlank()) ? req.role().trim().toUpperCase() : "OPERATOR";

        AppUserEntity user = userRepository.findByEmail(email).orElseGet(() -> {
            String randomPassword = UUID.randomUUID().toString().replace("-", "");
            AppUserEntity newUser = new AppUserEntity(email, passwordEncoder.encode(randomPassword), name);
            return userRepository.save(newUser);
        });

        // Ensure user belongs to this tenant
        TenantMembershipEntity membership = membershipRepository.findByTenantIdAndUserId(tenantId, user.getId())
                .orElseGet(() -> membershipRepository.save(new TenantMembershipEntity(tenantId, user.getId(), role)));

        if (!membership.isActive()) {
            membership.setActive(true);
            membership.changeRole(role);
            membership = membershipRepository.save(membership);
        }

        // Add initial skills if provided
        List<WorkforceDtos.EmployeeSkillDto> skillDtos = new ArrayList<>();
        if (req.skills() != null && !req.skills().isEmpty()) {
            AppUserEntity certifyingUser = actorId != null ? userRepository.findById(actorId).orElse(null) : null;
            for (WorkforceDtos.InitialSkillAssignment assign : req.skills()) {
                if (assign.skillId() == null) continue;
                WorkforceSkillEntity skill = skillRepository.findByTenantIdAndId(tenantId, assign.skillId()).orElse(null);
                if (skill == null) continue;

                String level = (assign.level() != null && !assign.level().isBlank()) ? assign.level().trim().toUpperCase() : "OPERATOR";
                WorkforceOperatorQualificationEntity qual = qualificationRepository.findByTenantIdAndUserIdAndSkillId(tenantId, user.getId(), skill.getId())
                        .orElseGet(WorkforceOperatorQualificationEntity::new);

                qual.setTenantId(tenantId);
                qual.setUser(user);
                qual.setSkill(skill);
                qual.setQualificationLevel(level);
                qual.setCertifiedAt(LocalDate.now());
                qual.setStatus("ACTIVE");
                if (certifyingUser != null) {
                    qual.setCertifiedByUser(certifyingUser);
                }
                WorkforceOperatorQualificationEntity savedQual = qualificationRepository.save(qual);
                skillDtos.add(new WorkforceDtos.EmployeeSkillDto(
                        savedQual.getId(),
                        skill.getId(),
                        skill.getSkillCode(),
                        skill.getName(),
                        skill.getCategory(),
                        savedQual.getQualificationLevel(),
                        savedQual.getCertifiedAt(),
                        savedQual.getExpiresAt(),
                        savedQual.getStatus(),
                        savedQual.getNotes()
                ));
            }
        }

        return new WorkforceDtos.EmployeeDto(
                user.getId(),
                membership.getId(),
                user.getDisplayName(),
                user.getEmail(),
                membership.getRole(),
                membership.isActive(),
                skillDtos,
                membership.getCreatedAt()
        );
    }

    public void deleteQualification(UUID tenantId, UUID qualificationId) {
        WorkforceOperatorQualificationEntity qual = qualificationRepository.findByTenantIdAndId(tenantId, qualificationId)
                .orElseThrow(() -> new IllegalArgumentException("Qualification not found: " + qualificationId));
        qualificationRepository.delete(qual);
    }

    // ==========================================
    // SKILLS MATRIX
    // ==========================================

    @Transactional(readOnly = true)
    public WorkforceDtos.SkillsMatrixResponse getSkillsMatrix(UUID tenantId) {
        List<WorkforceSkillEntity> skills = skillRepository.findAllByTenantIdOrderByCategoryAscSkillCodeAsc(tenantId);
        List<WorkforceDtos.SkillDto> skillDtos = skills.stream().map(this::toSkillDto).toList();

        List<TenantMembershipEntity> memberships = membershipRepository.findAllByTenantIdOrderByCreatedAtAsc(tenantId);
        List<WorkforceOperatorQualificationEntity> allQuals = qualificationRepository.findAllByTenantIdOrderByCreatedAtDesc(tenantId);

        Map<UUID, List<WorkforceOperatorQualificationEntity>> qualsByUser = allQuals.stream()
                .collect(Collectors.groupingBy(q -> q.getUser().getId()));

        List<WorkforceDtos.SkillsMatrixRowDto> rows = new ArrayList<>();
        for (TenantMembershipEntity m : memberships) {
            Optional<AppUserEntity> userOpt = userRepository.findById(m.getUserId());
            if (userOpt.isEmpty()) continue;
            AppUserEntity user = userOpt.get();

            List<WorkforceOperatorQualificationEntity> userQuals = qualsByUser.getOrDefault(user.getId(), Collections.emptyList());
            Map<String, WorkforceDtos.OperatorQualificationDto> qualMap = new HashMap<>();
            for (WorkforceOperatorQualificationEntity q : userQuals) {
                qualMap.put(q.getSkill().getSkillCode(), toQualDto(q));
            }

            rows.add(new WorkforceDtos.SkillsMatrixRowDto(
                    user.getId(),
                    user.getDisplayName(),
                    user.getEmail(),
                    m.getRole(),
                    qualMap
            ));
        }

        return new WorkforceDtos.SkillsMatrixResponse(skillDtos, rows);
    }

    // ==========================================
    // SKILLS CATALOG
    // ==========================================

    @Transactional(readOnly = true)
    public List<WorkforceDtos.SkillDto> listSkills(UUID tenantId) {
        return skillRepository.findAllByTenantIdOrderByCategoryAscSkillCodeAsc(tenantId)
                .stream().map(this::toSkillDto).toList();
    }

    public WorkforceDtos.SkillDto createSkill(UUID tenantId, WorkforceDtos.CreateSkillRequest req) {
        if (skillRepository.existsByTenantIdAndSkillCode(tenantId, req.skillCode())) {
            throw new IllegalArgumentException("Skill code " + req.skillCode() + " already exists.");
        }
        WorkforceSkillEntity entity = new WorkforceSkillEntity(
                tenantId,
                req.skillCode().trim().toUpperCase(),
                req.name().trim(),
                req.category() != null ? req.category().trim().toUpperCase() : "GENERAL",
                req.description(),
                req.minCertHours() > 0 ? req.minCertHours() : 40
        );
        WorkforceSkillEntity saved = skillRepository.save(entity);
        return toSkillDto(saved);
    }

    // ==========================================
    // QUALIFICATIONS
    // ==========================================

    @Transactional(readOnly = true)
    public List<WorkforceDtos.OperatorQualificationDto> listQualifications(UUID tenantId, UUID userId, UUID skillId) {
        if (userId != null) {
            return qualificationRepository.findAllByTenantIdAndUserId(tenantId, userId).stream().map(this::toQualDto).toList();
        }
        if (skillId != null) {
            return qualificationRepository.findAllByTenantIdAndSkillId(tenantId, skillId).stream().map(this::toQualDto).toList();
        }
        return qualificationRepository.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream().map(this::toQualDto).toList();
    }

    public WorkforceDtos.OperatorQualificationDto upsertQualification(
            UUID tenantId,
            UUID certifyingUserId,
            WorkforceDtos.UpsertQualificationRequest req
    ) {
        if (!membershipRepository.existsByTenantIdAndUserIdAndActiveTrue(tenantId, req.userId())) {
            throw new IllegalArgumentException("User not found: " + req.userId());
        }
        AppUserEntity user = userRepository.findById(req.userId())
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + req.userId()));
        WorkforceSkillEntity skill = skillRepository.findByTenantIdAndId(tenantId, req.skillId())
                .orElseThrow(() -> new IllegalArgumentException("Skill not found: " + req.skillId()));

        WorkforceOperatorQualificationEntity entity = qualificationRepository
                .findByTenantIdAndUserIdAndSkillId(tenantId, req.userId(), req.skillId())
                .orElseGet(() -> {
                    WorkforceOperatorQualificationEntity q = new WorkforceOperatorQualificationEntity();
                    q.setTenantId(tenantId);
                    q.setUser(user);
                    q.setSkill(skill);
                    return q;
                });

        entity.setQualificationLevel(req.qualificationLevel() != null ? req.qualificationLevel().toUpperCase() : "OPERATOR");
        entity.setCertifiedAt(LocalDate.now());
        entity.setExpiresAt(req.expiresAt());
        entity.setStatus(req.status() != null ? req.status().toUpperCase() : "ACTIVE");
        entity.setNotes(req.notes());

        if (certifyingUserId != null && membershipRepository.existsByTenantIdAndUserIdAndActiveTrue(tenantId, certifyingUserId)) {
            userRepository.findById(certifyingUserId).ifPresent(entity::setCertifiedByUser);
        }

        WorkforceOperatorQualificationEntity saved = qualificationRepository.save(entity);
        return toQualDto(saved);
    }

    // ==========================================
    // SHIFTS
    // ==========================================

    @Transactional(readOnly = true)
    public List<WorkforceDtos.ShiftDto> listShifts(UUID tenantId) {
        return shiftRepository.findAllByTenantIdOrderByStartTimeAsc(tenantId)
                .stream().map(this::toShiftDto).toList();
    }

    public WorkforceDtos.ShiftDto createShift(UUID tenantId, WorkforceDtos.CreateShiftRequest req) {
        if (shiftRepository.existsByTenantIdAndShiftCode(tenantId, req.shiftCode())) {
            throw new IllegalArgumentException("Shift code " + req.shiftCode() + " already exists.");
        }
        WorkforceShiftEntity entity = new WorkforceShiftEntity(
                tenantId,
                req.shiftCode().trim().toUpperCase(),
                req.name().trim(),
                req.startTime(),
                req.endTime(),
                req.breakMinutes() >= 0 ? req.breakMinutes() : 45
        );
        WorkforceShiftEntity saved = shiftRepository.save(entity);
        return toShiftDto(saved);
    }

    public WorkforceDtos.ShiftDto updateShift(UUID tenantId, UUID shiftId, WorkforceDtos.UpdateShiftRequest req) {
        WorkforceShiftEntity entity = shiftRepository.findByTenantIdAndId(tenantId, shiftId)
                .orElseThrow(() -> new IllegalArgumentException("Shift not found: " + shiftId));
        if (req.shiftCode() != null && !req.shiftCode().isBlank() && !req.shiftCode().trim().equalsIgnoreCase(entity.getShiftCode())) {
            String newCode = req.shiftCode().trim().toUpperCase();
            if (shiftRepository.existsByTenantIdAndShiftCode(tenantId, newCode)) {
                throw new IllegalArgumentException("Shift code " + newCode + " already exists.");
            }
            entity.setShiftCode(newCode);
        }
        if (req.name() != null && !req.name().isBlank()) {
            entity.setName(req.name().trim());
        }
        if (req.startTime() != null) {
            entity.setStartTime(req.startTime());
        }
        if (req.endTime() != null) {
            entity.setEndTime(req.endTime());
        }
        if (req.breakMinutes() >= 0) {
            entity.setBreakMinutes(req.breakMinutes());
        }
        if (req.isActive() != null) {
            entity.setActive(req.isActive());
        }
        WorkforceShiftEntity saved = shiftRepository.save(entity);
        return toShiftDto(saved);
    }

    // ==========================================
    // ROSTER & ATTENDANCE
    // ==========================================

    @Transactional(readOnly = true)
    public List<WorkforceDtos.RosterAssignmentDto> getRoster(UUID tenantId, LocalDate date, LocalDate fromDate, LocalDate toDate) {
        if (fromDate != null && toDate != null) {
            return rosterRepository.findRosterBetween(tenantId, fromDate, toDate).stream().map(this::toRosterDto).toList();
        }
        LocalDate target = date != null ? date : LocalDate.now();
        return rosterRepository.findAllByTenantIdAndRosterDateOrderByShiftStartTimeAsc(tenantId, target)
                .stream().map(this::toRosterDto).toList();
    }

    public WorkforceDtos.RosterAssignmentDto createRosterAssignment(UUID tenantId, WorkforceDtos.CreateRosterAssignmentRequest req) {
        WorkforceShiftEntity shift = shiftRepository.findByTenantIdAndId(tenantId, req.shiftId())
                .orElseThrow(() -> new IllegalArgumentException("Shift not found: " + req.shiftId()));
        if (!membershipRepository.existsByTenantIdAndUserIdAndActiveTrue(tenantId, req.userId())) {
            throw new IllegalArgumentException("User not found: " + req.userId());
        }
        AppUserEntity user = userRepository.findById(req.userId())
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + req.userId()));

        WorkforceRosterAssignmentEntity entity = rosterRepository
                .findByTenantIdAndUserIdAndRosterDate(tenantId, req.userId(), req.rosterDate())
                .orElseGet(() -> {
                    WorkforceRosterAssignmentEntity r = new WorkforceRosterAssignmentEntity();
                    r.setTenantId(tenantId);
                    r.setUser(user);
                    r.setRosterDate(req.rosterDate() != null ? req.rosterDate() : LocalDate.now());
                    return r;
                });

        entity.setShift(shift);
        if (req.workCenterId() != null) {
            workCenterRepository.findByTenantIdAndId(tenantId, req.workCenterId()).ifPresent(entity::setWorkCenter);
        } else {
            entity.setWorkCenter(null);
        }
        entity.setPlannedHours(req.plannedHours() != null ? req.plannedHours() : BigDecimal.valueOf(8.00));
        entity.setAttendanceStatus("SCHEDULED");
        entity.setNotes(req.notes());

        WorkforceRosterAssignmentEntity saved = rosterRepository.save(entity);
        return toRosterDto(saved);
    }

    public WorkforceDtos.RosterAssignmentDto clockIn(UUID tenantId, UUID rosterId) {
        WorkforceRosterAssignmentEntity entity = rosterRepository.findByTenantIdAndId(tenantId, rosterId)
                .orElseThrow(() -> new IllegalArgumentException("Roster assignment not found"));
        entity.setAttendanceStatus("PRESENT");
        entity.setClockInTime(Instant.now());
        WorkforceRosterAssignmentEntity saved = rosterRepository.save(entity);
        return toRosterDto(saved);
    }

    public WorkforceDtos.RosterAssignmentDto clockOut(UUID tenantId, UUID rosterId) {
        WorkforceRosterAssignmentEntity entity = rosterRepository.findByTenantIdAndId(tenantId, rosterId)
                .orElseThrow(() -> new IllegalArgumentException("Roster assignment not found"));
        Instant now = Instant.now();
        entity.setClockOutTime(now);

        if (entity.getClockInTime() != null) {
            long minutes = Duration.between(entity.getClockInTime(), now).toMinutes();
            BigDecimal hours = BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
            entity.setActualHours(hours);
        }

        WorkforceRosterAssignmentEntity saved = rosterRepository.save(entity);
        return toRosterDto(saved);
    }

    // ==========================================
    // ROUTING OPERATION SKILL GUARD
    // ==========================================

    @Transactional(readOnly = true)
    public WorkforceDtos.SkillGuardVerificationResponse verifySkillGuard(
            UUID tenantId,
            WorkforceDtos.SkillGuardVerificationRequest req
    ) {
        if (!membershipRepository.existsByTenantIdAndUserIdAndActiveTrue(tenantId, req.operatorUserId())) {
            throw new IllegalArgumentException("Operator not found");
        }
        AppUserEntity user = userRepository.findById(req.operatorUserId())
                .orElseThrow(() -> new IllegalArgumentException("Operator not found"));

        if (req.requiredSkillCode() == null || req.requiredSkillCode().isBlank()) {
            return new WorkforceDtos.SkillGuardVerificationResponse(
                    true, user.getDisplayName(), "", "", "", "", false,
                    "Operation requires no specialized skill certification."
            );
        }

        String skillCode = req.requiredSkillCode().trim().toUpperCase();
        Optional<WorkforceSkillEntity> skillOpt = skillRepository.findByTenantIdAndSkillCode(tenantId, skillCode);
        String skillName = skillOpt.map(WorkforceSkillEntity::getName).orElse(skillCode);

        Optional<WorkforceOperatorQualificationEntity> qualOpt = qualificationRepository
                .findActiveQualificationBySkillCode(tenantId, req.operatorUserId(), skillCode);

        if (qualOpt.isEmpty()) {
            return new WorkforceDtos.SkillGuardVerificationResponse(
                    false, user.getDisplayName(), skillCode, skillName, "NONE", req.requiredLevel(), false,
                    String.format("Operator %s holds NO active qualification for required skill '%s'.", user.getDisplayName(), skillName)
            );
        }

        WorkforceOperatorQualificationEntity qual = qualOpt.get();
        boolean isExpired = qual.getExpiresAt() != null && qual.getExpiresAt().isBefore(LocalDate.now());

        if (isExpired) {
            return new WorkforceDtos.SkillGuardVerificationResponse(
                    false, user.getDisplayName(), skillCode, skillName, qual.getQualificationLevel(), req.requiredLevel(), true,
                    String.format("Operator %s's qualification '%s' expired on %s. Recertification required.", user.getDisplayName(), skillName, qual.getExpiresAt())
            );
        }

        int currentRank = getLevelRank(qual.getQualificationLevel());
        int requiredRank = getLevelRank(req.requiredLevel());

        if (currentRank < requiredRank) {
            return new WorkforceDtos.SkillGuardVerificationResponse(
                    false, user.getDisplayName(), skillCode, skillName, qual.getQualificationLevel(), req.requiredLevel(), false,
                    String.format("Operator %s qualification level '%s' is below required '%s' for this operation.", user.getDisplayName(), qual.getQualificationLevel(), req.requiredLevel())
            );
        }

        return new WorkforceDtos.SkillGuardVerificationResponse(
                true, user.getDisplayName(), skillCode, skillName, qual.getQualificationLevel(), req.requiredLevel(), false,
                String.format("Operator %s verified as certified '%s' for '%s'.", user.getDisplayName(), qual.getQualificationLevel(), skillName)
        );
    }

    private int getLevelRank(String level) {
        if (level == null) return 0;
        return switch (level.trim().toUpperCase()) {
            case "APPRENTICE" -> 1;
            case "OPERATOR" -> 2;
            case "SPECIALIST" -> 3;
            case "MASTER" -> 4;
            default -> 0;
        };
    }

    // ==========================================
    // SUMMARY
    // ==========================================

    @Transactional(readOnly = true)
    public WorkforceDtos.WorkforceSummaryDto getSummary(UUID tenantId) {
        long operators = membershipRepository.countByTenantIdAndActiveTrue(tenantId);
        long activeShifts = shiftRepository.count();
        LocalDate today = LocalDate.now();
        long scheduled = rosterRepository.countScheduledOperatorsToday(tenantId, today);
        long present = rosterRepository.countPresentOperatorsToday(tenantId, today);
        double rate = scheduled > 0 ? ((double) present / scheduled) * 100.0 : 100.0;
        long skills = skillRepository.count();
        long quals = qualificationRepository.countActiveQualifications(tenantId);

        return new WorkforceDtos.WorkforceSummaryDto(
                operators,
                activeShifts,
                present,
                scheduled,
                Math.round(rate * 10.0) / 10.0,
                skills,
                quals
        );
    }

    // ==========================================
    // MAPPER HELPERS
    // ==========================================

    private WorkforceDtos.SkillDto toSkillDto(WorkforceSkillEntity e) {
        return new WorkforceDtos.SkillDto(
                e.getId(), e.getTenantId(), e.getSkillCode(), e.getName(),
                e.getCategory(), e.getDescription(), e.getMinCertHours(), e.getCreatedAt()
        );
    }

    private WorkforceDtos.OperatorQualificationDto toQualDto(WorkforceOperatorQualificationEntity e) {
        return new WorkforceDtos.OperatorQualificationDto(
                e.getId(), e.getTenantId(), e.getUser().getId(), e.getUser().getDisplayName(), e.getUser().getEmail(),
                e.getSkill().getId(), e.getSkill().getSkillCode(), e.getSkill().getName(), e.getSkill().getCategory(),
                e.getQualificationLevel(), e.getCertifiedAt(), e.getExpiresAt(), e.getStatus(), e.getNotes()
        );
    }

    private WorkforceDtos.ShiftDto toShiftDto(WorkforceShiftEntity e) {
        return new WorkforceDtos.ShiftDto(
                e.getId(), e.getTenantId(), e.getShiftCode(), e.getName(),
                e.getStartTime(), e.getEndTime(), e.getBreakMinutes(), e.isActive()
        );
    }

    private WorkforceDtos.RosterAssignmentDto toRosterDto(WorkforceRosterAssignmentEntity e) {
        return new WorkforceDtos.RosterAssignmentDto(
                e.getId(), e.getTenantId(),
                e.getShift().getId(), e.getShift().getShiftCode(), e.getShift().getName(),
                e.getShift().getStartTime(), e.getShift().getEndTime(),
                e.getUser().getId(), e.getUser().getDisplayName(), e.getUser().getEmail(),
                e.getWorkCenter() != null ? e.getWorkCenter().getId() : null,
                e.getWorkCenter() != null ? e.getWorkCenter().getCode() : null,
                e.getWorkCenter() != null ? e.getWorkCenter().getName() : null,
                e.getRosterDate(), e.getPlannedHours(), e.getAttendanceStatus(),
                e.getClockInTime(), e.getClockOutTime(), e.getActualHours(), e.getNotes()
        );
    }
}
