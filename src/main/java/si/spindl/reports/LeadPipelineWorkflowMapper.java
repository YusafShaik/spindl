package si.spindl.reports;

import si.spindl.reports.LeadPipelineWorkflowDtos.PipelineConfig;
import si.spindl.reports.LeadPipelineWorkflowDtos.Transition;
import si.spindl.reports.LeadPipelineWorkflowDtos.VersionView;
import java.util.List;
import java.util.Map;

/** Entity and row mapping for LeadPipelineWorkflowDtos. The records themselves stay free of persistence types. */
public final class LeadPipelineWorkflowMapper {
    private LeadPipelineWorkflowMapper() {}

    public static VersionView toVersionView(TenantWorkflowVersionEntity v) {
Map<String,Object> values=v.getConfiguration();List<String> states=((List<?>)values.get("states")).stream().map(String::valueOf).toList();List<Transition> transitions=((List<?>)values.get("transitions")).stream().map(row->{Map<?,?> item=(Map<?,?>)row;return new Transition(String.valueOf(item.get("from")),String.valueOf(item.get("to")),String.valueOf(item.get("requiredRole")));}).toList();return new VersionView(v.getId(),v.getVersion(),v.getStatus(),new PipelineConfig(String.valueOf(values.get("initialState")),states,transitions),v.getCreatedBy(),v.getCreatedAt(),v.getPublishedAt());
    }
}
