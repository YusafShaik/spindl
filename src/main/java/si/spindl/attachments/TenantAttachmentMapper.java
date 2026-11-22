package si.spindl.attachments;

import si.spindl.attachments.TenantAttachmentDtos.AttachmentView;

/** Entity and row mapping for TenantAttachmentDtos. The records themselves stay free of persistence types. */
public final class TenantAttachmentMapper {
    private TenantAttachmentMapper() {}

    public static AttachmentView toAttachmentView(TenantAttachmentEntity e) {
return new AttachmentView(e.getId(),e.getOriginalFilename(),e.getMediaType(),e.getSizeBytes(),e.getScanStatus(),e.getUploadedBy(),e.getUploadedAt());
    }
}
