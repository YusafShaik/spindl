package si.spindl.reports;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.List;
import java.time.Instant;

/** API contract for WorkflowStudioService. Mapping to entities lives in the mapper, not here. */
public final class WorkflowStudioDtos {
    private WorkflowStudioDtos() {}

    public record WorkflowConfig(BigDecimal amountThreshold,int requiredApprovals,String approverRole) {}

    public record Policy(BigDecimal amountThreshold,int requiredApprovals,String approverRole,int version) {}

    public record PreviewResult(BigDecimal amount,int requiredApprovals,String approverRole,boolean thresholdTriggered) {}

    public record ValidationResult(boolean valid,List<String> checks,PreviewResult highValuePreview) {}

    public record WorkflowVersionView(UUID id,int version,String status,WorkflowConfig configuration,UUID createdBy,java.time.Instant createdAt,java.time.Instant publishedAt) {}

    public record WorkflowView(String key,String name,WorkflowVersionView published,WorkflowVersionView draft,List<WorkflowVersionView> history) {}
}
