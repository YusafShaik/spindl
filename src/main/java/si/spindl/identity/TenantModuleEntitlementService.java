package si.spindl.identity;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class TenantModuleEntitlementService {
    private record Definition(String name, boolean required, List<String> dependencies) {}
    private static final Map<String, Definition> CATALOG = Map.ofEntries(
            Map.entry("dashboard", new Definition("Overview", true, List.of())),
            Map.entry("crm", new Definition("CRM", false, List.of())),
            Map.entry("catalog", new Definition("Product catalog", false, List.of())),
            Map.entry("inventory", new Definition("Inventory", false, List.of("catalog"))),
            Map.entry("sales", new Definition("Sales", false, List.of("catalog", "inventory"))),
            Map.entry("purchasing", new Definition("Purchasing", false, List.of("catalog", "inventory"))),
            Map.entry("manufacturing", new Definition("Manufacturing", false, List.of("catalog", "inventory"))),
            Map.entry("quality", new Definition("Quality", false, List.of("inventory"))),
            Map.entry("finance", new Definition("Finance", false, List.of("sales", "purchasing"))),
            Map.entry("imports", new Definition("Imports", false, List.of("catalog"))),
            Map.entry("team", new Definition("Team", true, List.of())),
            Map.entry("operations", new Definition("Audit and operations", true, List.of()))
    );

    private final TenantModuleEntitlementRepository entitlements;
    private final TenantAuditEventRepository audit;

    public TenantModuleEntitlementService(TenantModuleEntitlementRepository entitlements, TenantAuditEventRepository audit) {
        this.entitlements = entitlements;
        this.audit = audit;
    }

    @Transactional
    public void initialize(UUID tenantId) {
        Set<String> existing = entitlements.findAllByTenantIdOrderByModuleCodeAsc(tenantId).stream()
                .map(TenantModuleEntitlementEntity::getModuleCode).collect(java.util.stream.Collectors.toSet());
        entitlements.saveAll(CATALOG.keySet().stream().filter(code -> !existing.contains(code))
                .map(code -> new TenantModuleEntitlementEntity(tenantId, code)).toList());
    }

    @Transactional(readOnly = true)
    public List<ModuleView> list(UUID tenantId) {
        return entitlements.findAllByTenantIdOrderByModuleCodeAsc(tenantId).stream()
                .map(row -> view(row, CATALOG.get(row.getModuleCode()))).toList();
    }

    @Transactional
    public List<ModuleView> setEnabled(UUID tenantId, UUID actorId, String requestedCode, boolean enabled) {
        String code = requestedCode == null ? "" : requestedCode.trim().toLowerCase(java.util.Locale.ROOT);
        Definition definition = CATALOG.get(code);
        if (definition == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found");
        if (definition.required() && !enabled) throw new ResponseStatusException(HttpStatus.CONFLICT, "This foundation module must remain enabled");
        var tenantModules = entitlements.findAllForUpdate(tenantId);
        var row = tenantModules.stream().filter(candidate -> candidate.getModuleCode().equals(code)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Module entitlement has not been provisioned"));
        if (enabled && !row.isEntitled()) throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "This module is not included in the workspace plan");
        if (enabled) {
            var missingDependencies = definition.dependencies().stream()
                    .filter(dependency -> tenantModules.stream().filter(candidate -> candidate.getModuleCode().equals(dependency))
                            .noneMatch(TenantModuleEntitlementEntity::isEnabled)).toList();
            if (!missingDependencies.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Enable required modules first: " + String.join(", ", missingDependencies.stream().map(dependency -> CATALOG.get(dependency).name()).toList()));
        }
        if (!enabled) {
            var enabledDependents = tenantModules.stream()
                    .filter(TenantModuleEntitlementEntity::isEnabled)
                    .filter(candidate -> CATALOG.get(candidate.getModuleCode()).dependencies().contains(code)).toList();
            if (!enabledDependents.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Disable dependent modules first: " + String.join(", ", enabledDependents.stream().map(candidate -> CATALOG.get(candidate.getModuleCode()).name()).toList()));
        }
        if (row.isEnabled() != enabled) {
            row.setEnabled(enabled);
            audit.save(new TenantAuditEventEntity(tenantId, actorId, enabled ? "TENANT_MODULE_ENABLED" : "TENANT_MODULE_DISABLED",
                    "module", null, Map.of("module", code, "name", definition.name(), "sourcePlan", row.getSourcePlan(), "planVersion", row.getPlanVersion())));
        }
        return list(tenantId);
    }

    public boolean isEnabled(UUID tenantId, String moduleCode) {
        return entitlements.isEnabledAndEntitled(tenantId, moduleCode);
    }

    @Transactional
    public void applyPlan(UUID tenantId,String planCode,int version){
        var rows=entitlements.findAllForUpdate(tenantId);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"Workspace module entitlements are not initialized");
        var included=SubscriptionQuotaService.modulesFor(planCode);
        for(var row:rows)row.applyPlan(planCode,version,included.contains(row.getModuleCode()));
    }

    private ModuleView view(TenantModuleEntitlementEntity row, Definition definition) {
        return new ModuleView(row.getModuleCode(), definition.name(), definition.required(), definition.dependencies(),
                row.isEntitled(), row.isEnabled(), row.getSourcePlan(), row.getPlanVersion());
    }

    public record ModuleView(String code, String name, boolean required, List<String> dependencies,
                             boolean entitled, boolean enabled, String sourcePlan, int planVersion) {}
}
