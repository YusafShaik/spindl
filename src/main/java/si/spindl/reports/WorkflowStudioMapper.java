package si.spindl.reports;

import java.math.BigDecimal;
import si.spindl.reports.WorkflowStudioDtos.WorkflowConfig;
import si.spindl.reports.WorkflowStudioDtos.WorkflowVersionView;
import java.util.Map;

/** Entity and row mapping for WorkflowStudioDtos. The records themselves stay free of persistence types. */
public final class WorkflowStudioMapper {
    private WorkflowStudioMapper() {}

    public static WorkflowVersionView toWorkflowVersionView(TenantWorkflowVersionEntity entity) {
Map<String,Object> config=entity.getConfiguration();return new WorkflowVersionView(entity.getId(),entity.getVersion(),entity.getStatus(),new WorkflowConfig(new BigDecimal(String.valueOf(config.get("amountThreshold"))),((Number)config.get("requiredApprovals")).intValue(),String.valueOf(config.get("approverRole"))),entity.getCreatedBy(),entity.getCreatedAt(),entity.getPublishedAt());
    }
}
