package si.spindl.identity;

import tools.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.Instant;

/** API contract for TenantCustomFieldService. Mapping to entities lives in the mapper, not here. */
public final class TenantCustomFieldDtos {
    private TenantCustomFieldDtos() {}

    public record CreateFieldRequest(String resourceCode,String fieldKey,String displayName,String fieldType,boolean required,List<String> options,Map<String,Object> validation,JsonNode defaultValue) {}

    public record ImportField(String fieldKey,String displayName,String fieldType,boolean required,List<String> options,Map<String,Object> validation,JsonNode defaultValue) {}

    public record PutValuesRequest(Map<String,JsonNode> values) {}

    public record FieldView(UUID id,String resourceCode,String fieldKey,String displayName,String fieldType,boolean required,List<String> options,Map<String,Object> validation,JsonNode defaultValue,boolean published,int version,java.time.Instant createdAt) {}
}
