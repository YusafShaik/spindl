package si.spindl.reports;
import java.util.UUID;
import java.util.List;
import java.time.Instant;

/** API contract for LeadPipelineWorkflowService. Mapping to entities lives in the mapper, not here. */
public final class LeadPipelineWorkflowDtos {
    private LeadPipelineWorkflowDtos() {}

    public record PipelineConfig(String initialState,List<String> states,List<Transition> transitions) {}

    public record Transition(String from,String to,String requiredRole) {}

    public record PreviewResult(String from,String to,String role,boolean transitionExists,boolean allowed,String message) {}

    public record ValidationResult(boolean valid,List<String> checks,int stageCount,int transitionCount) {}

    public record WorkflowView(String key,String name,VersionView published,VersionView draft,List<VersionView> history) {}

    public record VersionView(UUID id,int version,String status,PipelineConfig configuration,UUID createdBy,java.time.Instant createdAt,java.time.Instant publishedAt) {}
}
