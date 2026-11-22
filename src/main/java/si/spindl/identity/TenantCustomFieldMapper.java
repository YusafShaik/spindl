package si.spindl.identity;

import si.spindl.identity.TenantCustomFieldDtos.FieldView;

/** Entity and row mapping for TenantCustomFieldDtos. The records themselves stay free of persistence types. */
public final class TenantCustomFieldMapper {
    private TenantCustomFieldMapper() {}

    public static FieldView toFieldView(TenantCustomFieldEntity f) {
return new FieldView(f.getId(),f.getResourceCode(),f.getFieldKey(),f.getDisplayName(),f.getFieldType(),f.isRequired(),f.getOptions(),f.getValidation(),f.getDefaultValue(),f.isPublished(),f.getVersion(),f.getCreatedAt());
    }
}
