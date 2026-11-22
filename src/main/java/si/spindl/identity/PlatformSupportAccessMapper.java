package si.spindl.identity;

import si.spindl.identity.PlatformSupportAccessDtos.SupportRequestView;

/** Entity and row mapping for PlatformSupportAccessDtos. The records themselves stay free of persistence types. */
public final class PlatformSupportAccessMapper {
    private PlatformSupportAccessMapper() {}

    public static SupportRequestView toSupportRequestView(PlatformSupportAccessRequestEntity request,String name) {
return new SupportRequestView(request.getId(),request.getTenantId(),name,request.getRequestedBy(),request.getRequesterEmail(),request.getReason(),request.getDurationMinutes(),request.getStatus(),request.getExpiresAt(),request.getReviewedBy(),request.getReviewedAt(),request.getReviewNote(),request.getCreatedAt());
    }
}
