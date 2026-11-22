package si.spindl.identity;

import si.spindl.identity.TenantPlanChangeRequestDtos.PlatformRequestView;
import si.spindl.identity.TenantPlanChangeRequestDtos.RequestView;

/** Entity and row mapping for TenantPlanChangeRequestDtos. The records themselves stay free of persistence types. */
public final class TenantPlanChangeRequestMapper {
    private TenantPlanChangeRequestMapper() {}

    public static PlatformRequestView toPlatformRequestView(TenantPlanChangeRequestEntity request,String tenantName) {
return new PlatformRequestView(request.getId(),request.getTenantId(),tenantName,request.getRequestedBy(),request.getCurrentPlanCode(),request.getCurrentPlanVersion(),request.getTargetPlanCode(),request.getTargetPlanVersion(),request.getEffectiveDate(),request.getStatus(),request.getRequestedAt(),request.getReviewedBy(),request.getReviewedAt(),request.getReviewNote(),request.getAppliedAt());
    }

    public static RequestView toRequestView(TenantPlanChangeRequestEntity request) {
return new RequestView(request.getId(),request.getCurrentPlanCode(),request.getCurrentPlanVersion(),request.getTargetPlanCode(),request.getTargetPlanVersion(),request.getEffectiveDate(),request.getStatus(),request.getRequestedAt(),request.getReviewedAt(),request.getReviewNote(),request.getAppliedAt());
    }
}
