package si.spindl.identity;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PlatformSupportAccessService {
    private final PlatformSupportAccessRequestRepository requests;
    private final TenantRepository tenants;
    private final SubscriptionQuotaService plans;
    private final TenantModuleEntitlementService modules;
    private final TenantAuditEventRepository audit;

    public PlatformSupportAccessService(PlatformSupportAccessRequestRepository requests,TenantRepository tenants,SubscriptionQuotaService plans,TenantModuleEntitlementService modules,TenantAuditEventRepository audit){this.requests=requests;this.tenants=tenants;this.plans=plans;this.modules=modules;this.audit=audit;}

    @Transactional
    public SupportRequestView request(UUID tenantId,UUID requesterId,String requesterEmail,String reason,int durationMinutes){
        if(!tenants.existsById(tenantId))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Workspace not found");
        String cleanReason=clean(reason);if(cleanReason==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Describe the support issue");
        if(cleanReason.length()>500)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Reason must be 500 characters or less");
        if(durationMinutes<5||durationMinutes>60)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Support access must be between 5 and 60 minutes");
        if(requests.existsByTenantIdAndStatus(tenantId,"REQUESTED")||requests.existsByTenantIdAndStatusAndExpiresAtAfter(tenantId,"APPROVED",Instant.now()))throw new ResponseStatusException(HttpStatus.CONFLICT,"A support request is already pending or active for this workspace");
        try{
            var request=requests.saveAndFlush(new PlatformSupportAccessRequestEntity(tenantId,requesterId,requesterEmail.toLowerCase(java.util.Locale.ROOT),cleanReason,durationMinutes));
            audit.save(new TenantAuditEventEntity(tenantId,requesterId,"PLATFORM_SUPPORT_REQUESTED","support_access",request.getId(),Map.of("requestId",request.getId().toString(),"durationMinutes",durationMinutes)));
            return SupportRequestView.from(request,tenantName(tenantId));
        }catch(DataIntegrityViolationException concurrent){throw new ResponseStatusException(HttpStatus.CONFLICT,"A support request was submitted at the same time; refresh and retry");}
    }

    @Transactional(readOnly=true)
    public List<SupportRequestView> tenantQueue(UUID tenantId){return requests.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream().map(request->SupportRequestView.from(request,tenantName(tenantId))).toList();}

    @Transactional(readOnly=true)
    public List<SupportRequestView> platformQueue(UUID supportActorId){return requests.findAllByStatusInOrderByCreatedAtAsc(List.of("REQUESTED","APPROVED")).stream().filter(request->request.getRequestedBy().equals(supportActorId)).map(request->SupportRequestView.from(request,tenantName(request.getTenantId()))).toList();}

    @Transactional
    public SupportRequestView approve(UUID tenantId,UUID id,UUID reviewerId,String note){var request=tenantRequest(tenantId,id);if(request.getStatus().equals("APPROVED")&&request.hasActiveConsent(Instant.now()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Support access is already active");if(!"REQUESTED".equals(request.getStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"This support request is no longer pending");request.approve(reviewerId,clean(note));audit(request,reviewerId,"PLATFORM_SUPPORT_CONSENT_GRANTED",request.getReviewNote());return SupportRequestView.from(request,tenantName(tenantId));}

    @Transactional
    public SupportRequestView reject(UUID tenantId,UUID id,UUID reviewerId,String note){String reason=clean(note);if(reason==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Add a reason for rejecting this request");var request=tenantRequest(tenantId,id);if(!"REQUESTED".equals(request.getStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"This support request is no longer pending");request.reject(reviewerId,reason);audit(request,reviewerId,"PLATFORM_SUPPORT_CONSENT_REJECTED",reason);return SupportRequestView.from(request,tenantName(tenantId));}

    @Transactional
    public SupportRequestView revoke(UUID tenantId,UUID id,UUID reviewerId,String note){var request=tenantRequest(tenantId,id);if(!request.hasActiveConsent(Instant.now()))throw new ResponseStatusException(HttpStatus.CONFLICT,"There is no active support access to revoke");request.revoke(reviewerId,clean(note));audit(request,reviewerId,"PLATFORM_SUPPORT_CONSENT_REVOKED",request.getReviewNote());return SupportRequestView.from(request,tenantName(tenantId));}

    @Transactional
    public Diagnostics diagnostics(UUID requestId,UUID supportActorId,String supportEmail){
        var request=requests.findById(requestId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Support request not found"));
        if(!request.getRequestedBy().equals(supportActorId)||!request.getRequesterEmail().equalsIgnoreCase(supportEmail))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This support consent is bound to a different support operator");
        if(!request.hasActiveConsent(Instant.now()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Tenant consent is missing or expired");
        var workspace=tenants.findById(request.getTenantId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Workspace not found"));
        if("closed".equalsIgnoreCase(workspace.getStatus()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Support access is unavailable for a closed workspace");
        var plan=plans.current(request.getTenantId());
        var moduleList=modules.list(request.getTenantId()).stream().map(module->new ModuleDiagnostic(module.code(),module.entitled(),module.enabled())).toList();
        Map<String,Object> details=new LinkedHashMap<>();details.put("requestId",requestId.toString());details.put("supportEmail",supportEmail);details.put("consentExpiresAt",request.getExpiresAt().toString());
        audit.save(new TenantAuditEventEntity(request.getTenantId(),supportActorId,"PLATFORM_SUPPORT_DIAGNOSTICS_VIEWED","support_access",requestId,details));
        return new Diagnostics(requestId,workspace.getId(),workspace.getDisplayName(),workspace.getStatus(),workspace.getTimezone(),workspace.getCountryCode(),workspace.getCurrencyCode(),plan.planCode(),plan.version(),plan.status(),plan.activeSeats(),plan.pendingInvitations(),plan.seatLimit(),plan.storageUsedBytes(),plan.storageLimitMb(),plan.apiCallsUsed(),plan.apiCallsPerMonth(),request.getExpiresAt(),moduleList);
    }

    private PlatformSupportAccessRequestEntity tenantRequest(UUID tenantId,UUID id){return requests.findByTenantIdAndIdForUpdate(tenantId,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Support request not found"));}
    private void audit(PlatformSupportAccessRequestEntity request,UUID actor,String event,String note){Map<String,Object> detail=new LinkedHashMap<>();detail.put("requestId",request.getId().toString());detail.put("status",request.getStatus());detail.put("expiresAt",request.getExpiresAt()==null?"":request.getExpiresAt().toString());audit.save(new TenantAuditEventEntity(request.getTenantId(),actor,event,"support_access",request.getId(),detail));}
    private String tenantName(UUID tenantId){return tenants.findSummaryById(tenantId).map(TenantRepository.TenantSummary::getDisplayName).orElse("Workspace unavailable");}
    private String clean(String value){if(value==null||value.isBlank())return null;String result=value.trim();if(result.length()>500)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Text must be 500 characters or less");return result;}

    public record CreateRequest(UUID tenantId,String reason,int durationMinutes){}
    public record ReviewRequest(String note){}
    public record SupportRequestView(UUID id,UUID tenantId,String tenantName,UUID requestedBy,String requesterEmail,String reason,int durationMinutes,String status,Instant expiresAt,UUID reviewedBy,Instant reviewedAt,String reviewNote,Instant createdAt){static SupportRequestView from(PlatformSupportAccessRequestEntity request,String name){return new SupportRequestView(request.getId(),request.getTenantId(),name,request.getRequestedBy(),request.getRequesterEmail(),request.getReason(),request.getDurationMinutes(),request.getStatus(),request.getExpiresAt(),request.getReviewedBy(),request.getReviewedAt(),request.getReviewNote(),request.getCreatedAt());}}
    public record ModuleDiagnostic(String code,boolean entitled,boolean enabled){}
    public record Diagnostics(UUID consentRequestId,UUID tenantId,String workspace,String accountStatus,String timezone,String countryCode,String currencyCode,String planCode,int planVersion,String subscriptionStatus,long activeSeats,long pendingInvitations,int seatLimit,long storageUsedBytes,int storageLimitMb,long apiCallsUsed,long apiCallsLimit,Instant consentExpiresAt,List<ModuleDiagnostic> modules){}
}
