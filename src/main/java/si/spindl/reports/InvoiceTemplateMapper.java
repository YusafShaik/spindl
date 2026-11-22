package si.spindl.reports;

import si.spindl.reports.InvoiceTemplateDtos.TemplateConfig;
import si.spindl.reports.InvoiceTemplateDtos.TemplateVersion;
import java.util.List;
import java.util.Map;

/** Entity and row mapping for InvoiceTemplateDtos. The records themselves stay free of persistence types. */
public final class InvoiceTemplateMapper {
    private InvoiceTemplateMapper() {}

    public static TemplateVersion toTemplateVersion(TenantWorkflowVersionEntity e) {
Map<String,Object> m=e.getConfiguration();TemplateConfig c=new TemplateConfig(String.valueOf(m.get("documentType")),String.valueOf(m.get("title")),String.valueOf(m.get("footer")),String.valueOf(m.get("locale")),String.valueOf(m.get("accentColor")),((List<?>)m.get("fields")).stream().map(String::valueOf).toList());return new TemplateVersion(e.getId(),e.getVersion(),e.getStatus(),c,e.getCreatedBy(),e.getCreatedAt(),e.getPublishedAt());
    }
}
