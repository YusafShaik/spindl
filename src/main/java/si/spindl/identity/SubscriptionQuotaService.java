package si.spindl.identity;

import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import si.spindl.attachments.TenantStorageUsageRepository;
import si.spindl.identity.SubscriptionQuotaDtos.PlanSummary;
import si.spindl.identity.SubscriptionQuotaDtos.PlanChangePreview;

@Service
public class SubscriptionQuotaService {
    private final TenantSubscriptionRepository subscriptions;
    private final SubscriptionPlanRepository plans;
    private final TenantMembershipRepository memberships;
    private final TenantInvitationRepository invitations;
    private final TenantModuleEntitlementRepository moduleEntitlements;
    private final ApiUsageQuotaService apiUsage;
    private final TenantStorageUsageRepository storageUsage;

    public SubscriptionQuotaService(TenantSubscriptionRepository subscriptions, SubscriptionPlanRepository plans,
                                    TenantMembershipRepository memberships, TenantInvitationRepository invitations,
                                    TenantModuleEntitlementRepository moduleEntitlements,ApiUsageQuotaService apiUsage,TenantStorageUsageRepository storageUsage) {
        this.subscriptions=subscriptions; this.plans=plans; this.memberships=memberships; this.invitations=invitations;
        this.moduleEntitlements=moduleEntitlements;
        this.apiUsage=apiUsage;
        this.storageUsage=storageUsage;
    }

    @Transactional
    public void initialize(UUID tenantId) {
        if (!subscriptions.existsById(tenantId)) subscriptions.save(new TenantSubscriptionEntity(tenantId,"TRIAL",1,"TRIAL"));
    }

    @Transactional
    public void reserveSeatForInvite(UUID tenantId) {
        var subscription=subscriptions.findByTenantIdForUpdate(tenantId)
                .orElseThrow(()->new ConflictException("Workspace plan has not been provisioned"));
        var plan=plans.findByPlanCodeAndVersionAndActiveTrue(subscription.getPlanCode(),subscription.getPlanVersion())
                .orElseThrow(()->new ConflictException("Workspace plan version is unavailable"));
        long occupied=memberships.countByTenantIdAndActiveTrue(tenantId)+invitations.countByTenantIdAndAcceptedAtIsNullAndExpiresAtAfter(tenantId,Instant.now());
        if(occupied>=plan.getSeatLimit()) throw new ConflictException("The "+plan.getDisplayName()+" plan allows "+plan.getSeatLimit()+" seats. Remove a pending invite or update the plan to add another teammate.");
    }

    @Transactional
    public void assertSeatAvailableForAcceptance(UUID tenantId) {
        var subscription=subscriptions.findByTenantIdForUpdate(tenantId)
                .orElseThrow(()->new ConflictException("Workspace plan has not been provisioned"));
        var plan=plans.findByPlanCodeAndVersionAndActiveTrue(subscription.getPlanCode(),subscription.getPlanVersion())
                .orElseThrow(()->new ConflictException("Workspace plan version is unavailable"));
        if(memberships.countByTenantIdAndActiveTrue(tenantId)>=plan.getSeatLimit())
            throw new ConflictException("The workspace has reached its "+plan.getSeatLimit()+" seat limit.");
    }

    @Transactional(readOnly = true)
    public PlanSummary current(UUID tenantId) {
        var subscription=subscriptions.findByTenantId(tenantId).orElseThrow(()->new NotFoundException("Workspace plan not found"));
        var plan=plans.findByPlanCodeAndVersionAndActiveTrue(subscription.getPlanCode(),subscription.getPlanVersion())
                .orElseThrow(()->new ConflictException("Workspace plan version is unavailable"));
        long active=memberships.countByTenantIdAndActiveTrue(tenantId);
        long pending=invitations.countByTenantIdAndAcceptedAtIsNullAndExpiresAtAfter(tenantId,Instant.now());
        long storageBytes=storageUsage.findById(tenantId).map(si.spindl.attachments.TenantStorageUsageEntity::getUsedBytes).orElse(0L);
        return new PlanSummary(plan.getPlanCode(),plan.getVersion(),plan.getDisplayName(),subscription.getStatus(),plan.getSeatLimit(),active,pending,
                plan.getStorageLimitMb(),storageBytes,plan.getApiCallsPerMonth(),apiUsage.currentMonthUsage(tenantId));
    }

    @Transactional(readOnly = true)
    public PlanChangePreview preview(UUID tenantId,String requestedCode) {
        PlanSummary current=current(tenantId);
        var choices=plans.findAll().stream().filter(SubscriptionPlanEntity::isActive)
                .filter(p->p.getPlanCode().equalsIgnoreCase(requestedCode==null?"":requestedCode.trim()))
                .sorted(java.util.Comparator.comparingInt(SubscriptionPlanEntity::getVersion).reversed()).toList();
        if(choices.isEmpty()) throw new NotFoundException("Plan not found");
        var target=choices.getFirst();
        long seats=current.activeSeats()+current.pendingInvitations();
        var targetModules=modulesFor(target.getPlanCode());
        var blockedModules=moduleEntitlements.findAllByTenantIdOrderByModuleCodeAsc(tenantId).stream()
                .filter(TenantModuleEntitlementEntity::isEnabled).map(TenantModuleEntitlementEntity::getModuleCode)
                .filter(code->!targetModules.contains(code)).toList();
        long storageLimitBytes=Math.multiplyExact((long)target.getStorageLimitMb(),1024L*1024L);
        boolean downgrade=target.getSeatLimit()<current.seatLimit()||target.getStorageLimitMb()<current.storageLimitMb()
                ||target.getApiCallsPerMonth()<current.apiCallsPerMonth()||!blockedModules.isEmpty();
        java.util.ArrayList<String> overages=new java.util.ArrayList<>();
        if(seats>target.getSeatLimit())overages.add((seats-target.getSeatLimit())+" seat(s) exceed the target plan");
        if(current.storageUsedBytes()>storageLimitBytes)overages.add(formatBytes(current.storageUsedBytes()-storageLimitBytes)+" of storage exceed the target plan");
        if(current.apiCallsUsed()>target.getApiCallsPerMonth())overages.add((current.apiCallsUsed()-target.getApiCallsPerMonth())+" API calls exceed the target plan for the current billing month");
        String effective=downgrade?LocalDate.now(ZoneOffset.UTC).plusMonths(1).withDayOfMonth(1).toString():"immediate after commercial approval";
        return new PlanChangePreview(current.planCode(),current.version(),target.getPlanCode(),target.getVersion(),target.getDisplayName(),
                target.getSeatLimit(),seats,target.getStorageLimitMb(),current.storageUsedBytes(),target.getApiCallsPerMonth(),current.apiCallsUsed(),overages,blockedModules,effective,
                "Preview only. A plan change requires platform billing approval.");
    }

    private static String formatBytes(long bytes){if(bytes<1024)return bytes+" B";if(bytes<1024*1024)return String.format(java.util.Locale.ROOT,"%.1f KB",bytes/1024.0);return String.format(java.util.Locale.ROOT,"%.1f MB",bytes/(1024.0*1024.0));}

    static java.util.Set<String> modulesFor(String planCode) {
        var foundation=java.util.Set.of("dashboard","team","operations");
        return switch(planCode) {
            case "TRIAL", "MANUFACTURING" -> java.util.Set.of("dashboard","crm","catalog","inventory","sales","purchasing","manufacturing","quality","finance","imports","team","operations");
            case "STARTER_CRM" -> java.util.Set.of("dashboard","crm","team","operations");
            case "INVENTORY_LITE" -> java.util.Set.of("dashboard","crm","catalog","inventory","team","operations");
            case "COMMERCE_OPS" -> java.util.Set.of("dashboard","crm","catalog","inventory","sales","purchasing","finance","imports","team","operations");
            default -> foundation;
        };
    }

}
