package si.spindl.reports;
import java.util.UUID;
import java.util.List;
import java.time.Instant;

/** API contract for InvoiceTemplateService. Mapping to entities lives in the mapper, not here. */
public final class InvoiceTemplateDtos {
    private InvoiceTemplateDtos() {}

    public record TemplateConfig(String documentType,String title,String footer,String locale,String accentColor,List<String> fields) {}

    public record TemplateVersion(UUID id,int version,String status,TemplateConfig configuration,UUID createdBy,java.time.Instant createdAt,java.time.Instant publishedAt) {}

    public record TemplateView(String key,TemplateVersion published,TemplateVersion draft,List<TemplateVersion> history) {}

    public record PreviewField(String key,String label,String sampleValue) {}

    public record Preview(TemplateVersion version,List<PreviewField> fields) {}

    public record Validation(boolean valid,List<String> checks,Preview preview) {}
}
