package si.spindl.attachments;

import org.springframework.core.io.Resource;
import java.util.UUID;
import java.time.Instant;

/** API contract for TenantAttachmentService. Mapping to entities lives in the mapper, not here. */
public final class TenantAttachmentDtos {
    private TenantAttachmentDtos() {}

    public record AttachmentView(UUID id,String filename,String mediaType,long sizeBytes,String scanStatus,UUID uploadedBy,java.time.Instant uploadedAt) {}

    public record Download(Resource resource,String filename,String mediaType,long sizeBytes) {}
}
