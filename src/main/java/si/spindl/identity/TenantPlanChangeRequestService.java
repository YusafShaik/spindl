package si.spindl.identity;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.Instant;
import java.time.ZoneOffset;
import org.springframework.scheduling.annotation.Scheduled;

@Service
public class TenantPlanChangeRequestService {
    private final TenantPlanChangeRequestRepository requests;
    private final SubscriptionQuotaService plans;
    private final TenantAuditEventRepository audit;
    private final TenantSubscriptionRepository subscriptions;
    private final SubscriptionPlanRepository planCatalog;
    private final TenantModuleEntitlementService moduleEntitlements;
    private final TenantRepository tenants;

    public TenantPlanChangeRequestService(TenantPlanChangeRequestRepository requests,SubscriptionQuotaService plans,TenantAuditEventRepository audit,
            TenantSubscriptionRepository subscriptions,SubscriptionPlanRepository planCatalog,TenantModuleEntitlementService moduleEntitlements,TenantRepository tenants){this.requests=requests;this.plans=plans;this.audit=audit;this.subscriptions=subscriptions;this.planCatalog=planCatalog;this.moduleEntitlements=moduleEntitlements;this.tenants=tenants;}

    @Transactional(readOnly=true)
    public List<RequestView> list(UUID tenantId){return requests.findAllByTenantIdOrderByRequestedAtDesc(tenantId).stream().map(RequestView::from).toList();}

    @Transactional
    public RequestView create(UUID tenantId,UUID actorId,String requestedPlan){
        if(requestedPlan==null||requestedPlan.isBlank())throw new BadRequestException("Choose a plan to request");
        if(requests.existsByTenantIdAndStatusIn(tenantId,List.of("REQUESTED","APPROVED")))throw new ConflictException("A plan change request is already awaiting review or scheduled to apply");
        var preview=plans.preview(tenantId,requestedPlan);
        if(preview.currentPlanCode().equals(preview.targetPlanCode())&&preview.currentVersion()==preview.targetVersion())throw new BadRequestException("This workspace is already on that plan version");
        LocalDate effectiveDate;
        try{effectiveDate=LocalDate.parse(preview.effectiveDate());}catch(java.time.format.DateTimeParseException immediate){effectiveDate=LocalDate.now(java.time.ZoneOffset.UTC);}
        TenantPlanChangeRequestEntity request;
        try{request=requests.saveAndFlush(new TenantPlanChangeRequestEntity(tenantId,actorId,preview.currentPlanCode(),preview.currentVersion(),preview.targetPlanCode(),preview.targetVersion(),effectiveDate));}
        catch(DataIntegrityViolationException exception){throw new ConflictException("A plan change request was submitted by another workspace admin");}
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"PLAN_CHANGE_REQUESTED","subscription",request.getId(),Map.of("currentPlan",request.getCurrentPlanCode(),"targetPlan",request.getTargetPlanCode(),"effectiveDate",request.getEffectiveDate().toString())));
        return RequestView.from(request);
    }

    @Transactional
    public RequestView cancel(UUID tenantId,UUID actorId,UUID id){
        var request=requests.findByTenantIdAndIdForUpdate(tenantId,id).orElseThrow(()->new NotFoundException("Plan change request not found"));
        if(!"REQUESTED".equals(request.getStatus()))throw new ConflictException("This plan request is no longer pending");
        request.cancel();audit.save(new TenantAuditEventEntity(tenantId,actorId,"PLAN_CHANGE_REQUEST_CANCELLED","subscription",id,Map.of("targetPlan",request.getTargetPlanCode())));
        return RequestView.from(request);
    }

    @Transactional(readOnly=true)
    public List<PlatformRequestView> platformQueue(){
        return requests.findAllByStatusInOrderByRequestedAtAsc(List.of("REQUESTED","APPROVED")).stream().map(request->{
            String tenantName=tenants.findSummaryById(request.getTenantId()).map(TenantRepository.TenantSummary::getDisplayName).orElse("Workspace unavailable");
            return PlatformRequestView.from(request,tenantName);
        }).toList();
    }

    @Transactional
    public PlatformRequestView approve(UUID id,UUID reviewerId,String reviewerEmail,String note){
        var request=requests.findByIdForUpdate(id).orElseThrow(()->new NotFoundException("Plan change request not found"));
        if(!"REQUESTED".equals(request.getStatus()))throw new ConflictException("This plan request has already been reviewed");
        var subscription=subscriptions.findByTenantIdForUpdate(request.getTenantId()).orElseThrow(()->new ConflictException("Workspace subscription is unavailable"));
        if(!subscription.getPlanCode().equals(request.getCurrentPlanCode())||subscription.getPlanVersion()!=request.getCurrentPlanVersion())throw new ConflictException("Workspace plan changed after this request was submitted; ask the workspace admin to preview again");
        var target=planCatalog.findByPlanCodeAndVersion(request.getTargetPlanCode(),request.getTargetPlanVersion()).orElseThrow(()->new ConflictException("Requested plan version is unavailable"));
        request.approve(reviewerId,cleanNote(note));
        saveTenantAudit(request,reviewerId,"PLAN_CHANGE_APPROVED",reviewerEmail,cleanNote(note));
        if(!request.getEffectiveDate().isAfter(LocalDate.now(ZoneOffset.UTC)))apply(request,subscription,target,reviewerId,reviewerEmail);
        String tenantName=tenants.findSummaryById(request.getTenantId()).map(TenantRepository.TenantSummary::getDisplayName).orElse("Workspace unavailable");
        return PlatformRequestView.from(request,tenantName);
    }

    @Transactional
    public PlatformRequestView reject(UUID id,UUID reviewerId,String reviewerEmail,String note){
        String reason=cleanNote(note);if(reason==null)throw new BadRequestException("A reason is required when rejecting a plan request");
        var request=requests.findByIdForUpdate(id).orElseThrow(()->new NotFoundException("Plan change request not found"));
        if(!"REQUESTED".equals(request.getStatus()))throw new ConflictException("This plan request has already been reviewed");
        request.reject(reviewerId,reason);saveTenantAudit(request,reviewerId,"PLAN_CHANGE_REJECTED",reviewerEmail,reason);
        String tenantName=tenants.findSummaryById(request.getTenantId()).map(TenantRepository.TenantSummary::getDisplayName).orElse("Workspace unavailable");
        return PlatformRequestView.from(request,tenantName);
    }

    @Scheduled(fixedDelayString="${spindl.plan-change-apply-delay-ms:60000}")
    @Transactional
    public void applyDueApprovedRequests(){
        var due=requests.findDueApprovedForUpdate(LocalDate.now(ZoneOffset.UTC));
        for(var request:due){
            var subscription=subscriptions.findByTenantIdForUpdate(request.getTenantId()).orElse(null);
            if(subscription==null)continue;
            if(!subscription.getPlanCode().equals(request.getCurrentPlanCode())||subscription.getPlanVersion()!=request.getCurrentPlanVersion()){
                request.rejectApplication("Workspace plan changed before the approved plan request reached its effective date");
                saveTenantAudit(request,request.getReviewedBy(),"PLAN_CHANGE_REJECTED","system","Approved request became stale before its effective date");continue;
            }
            var target=planCatalog.findByPlanCodeAndVersion(request.getTargetPlanCode(),request.getTargetPlanVersion()).orElse(null);
            if(target==null){request.rejectApplication("Requested plan version is no longer available");saveTenantAudit(request,request.getReviewedBy(),"PLAN_CHANGE_REJECTED","system","Requested plan version is unavailable");continue;}
            apply(request,subscription,target,request.getReviewedBy(),"system");
        }
    }

    private void apply(TenantPlanChangeRequestEntity request,TenantSubscriptionEntity subscription,SubscriptionPlanEntity target,UUID actorId,String actorEmail){
        subscription.applyPlan(target.getPlanCode(),target.getVersion());moduleEntitlements.applyPlan(request.getTenantId(),target.getPlanCode(),target.getVersion());request.markApplied();
        saveTenantAudit(request,actorId,"PLAN_CHANGE_APPLIED",actorEmail,"Plan "+target.getPlanCode()+" v"+target.getVersion()+" applied");
    }
    private void saveTenantAudit(TenantPlanChangeRequestEntity request,UUID actorId,String event,String actorEmail,String note){
        Map<String,Object> details=new java.util.LinkedHashMap<>();details.put("requestId",request.getId().toString());details.put("currentPlan",request.getCurrentPlanCode());details.put("targetPlan",request.getTargetPlanCode());details.put("targetVersion",request.getTargetPlanVersion());details.put("effectiveDate",request.getEffectiveDate().toString());details.put("reviewerEmail",actorEmail);if(note!=null)details.put("note",note);
        audit.save(new TenantAuditEventEntity(request.getTenantId(),actorId,event,"subscription",request.getId(),details));
    }
    private String cleanNote(String note){if(note==null||note.isBlank())return null;String value=note.trim();if(value.length()>500)throw new BadRequestException("Review note must be 500 characters or less");return value;}

    public record CreateRequest(String planCode){}
    public record RequestView(UUID id,String currentPlanCode,int currentPlanVersion,String targetPlanCode,int targetPlanVersion,LocalDate effectiveDate,String status,java.time.Instant requestedAt,java.time.Instant reviewedAt,String reviewNote,java.time.Instant appliedAt){
        static RequestView from(TenantPlanChangeRequestEntity request){return new RequestView(request.getId(),request.getCurrentPlanCode(),request.getCurrentPlanVersion(),request.getTargetPlanCode(),request.getTargetPlanVersion(),request.getEffectiveDate(),request.getStatus(),request.getRequestedAt(),request.getReviewedAt(),request.getReviewNote(),request.getAppliedAt());}
    }
    public record PlatformRequestView(UUID id,UUID tenantId,String tenantName,UUID requestedBy,String currentPlanCode,int currentPlanVersion,String targetPlanCode,int targetPlanVersion,LocalDate effectiveDate,String status,java.time.Instant requestedAt,UUID reviewedBy,java.time.Instant reviewedAt,String reviewNote,java.time.Instant appliedAt){static PlatformRequestView from(TenantPlanChangeRequestEntity request,String tenantName){return new PlatformRequestView(request.getId(),request.getTenantId(),tenantName,request.getRequestedBy(),request.getCurrentPlanCode(),request.getCurrentPlanVersion(),request.getTargetPlanCode(),request.getTargetPlanVersion(),request.getEffectiveDate(),request.getStatus(),request.getRequestedAt(),request.getReviewedBy(),request.getReviewedAt(),request.getReviewNote(),request.getAppliedAt());}}
}
