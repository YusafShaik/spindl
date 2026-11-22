package si.spindl.identity;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.ForbiddenException;
import si.spindl.common.exception.NotFoundException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import si.spindl.identity.TenantCustomFieldDtos.CreateFieldRequest;
import si.spindl.identity.TenantCustomFieldDtos.ImportField;
import si.spindl.identity.TenantCustomFieldDtos.PutValuesRequest;
import si.spindl.identity.TenantCustomFieldDtos.FieldView;

@Service
public class TenantCustomFieldService {
    private static final Set<String> RESOURCES=Set.of("customers","items","suppliers","purchase_orders","quotes","sales_orders","invoices","work_orders");
    private static final Set<String> TYPES=Set.of("TEXT","NUMBER","DATE","BOOLEAN","SELECT","REFERENCE");
    private static final Set<String> RESERVED=Set.of("id","tenant_id","created_at","updated_at","deleted_at","status","name","email","sku","code");
    private final TenantCustomFieldRepository fields;
    private final TenantCustomFieldValueRepository values;
    private final TenantModuleEntitlementService modules;
    private final TenantAuditEventRepository audit;

    public TenantCustomFieldService(TenantCustomFieldRepository fields,TenantCustomFieldValueRepository values,
                                    TenantModuleEntitlementService modules,TenantAuditEventRepository audit){
        this.fields=fields;this.values=values;this.modules=modules;this.audit=audit;
    }

    @Transactional(readOnly=true)
    public List<FieldView> list(UUID tenantId,String requestedResource){
        String resource=resource(requestedResource);ensureModule(tenantId,resource);
        return fields.findAllByTenantIdAndResourceCodeOrderByCreatedAtAsc(tenantId,resource).stream().map(TenantCustomFieldMapper::toFieldView).toList();
    }

    @Transactional(readOnly=true)
    public List<ImportField> importFields(UUID tenantId,String requestedResource){
        String resource=resource(requestedResource);ensureModule(tenantId,resource);
        return fields.findAllByTenantIdAndResourceCodeOrderByCreatedAtAsc(tenantId,resource).stream()
                .filter(TenantCustomFieldEntity::isPublished)
                .map(field->new ImportField(field.getFieldKey(),field.getDisplayName(),field.getFieldType(),field.isRequired(),field.getOptions(),field.getValidation(),field.getDefaultValue()))
                .toList();
    }

    public Map<String,JsonNode> parseImportValues(List<ImportField> definitions,Map<String,String> rawValues){
        var result=new java.util.LinkedHashMap<String,JsonNode>();
        for(ImportField field:definitions){
            String raw=rawValues.get(field.fieldKey());
            JsonNode value;
            if(raw==null||raw.isBlank()) value=field.defaultValue();
            else try{
                value=switch(field.fieldType()){
                    case "TEXT","DATE","SELECT","REFERENCE"->JsonNodeFactory.instance.textNode(raw);
                    case "NUMBER"->JsonNodeFactory.instance.numberNode(new java.math.BigDecimal(raw));
                    case "BOOLEAN"->{if(!raw.equalsIgnoreCase("true")&&!raw.equalsIgnoreCase("false"))throw new IllegalArgumentException();yield JsonNodeFactory.instance.booleanNode(Boolean.parseBoolean(raw));}
                    default->throw new IllegalArgumentException();
                };
            }catch(RuntimeException exception){throw new BadRequestException("Invalid value for custom field: "+field.displayName());}
            if(value==null){if(field.required())throw new BadRequestException("Required custom field is missing: "+field.displayName());continue;}
            validate(field.fieldType(),field.options(),field.validation(),value);
            result.put(field.fieldKey(),value);
        }
        return Map.copyOf(result);
    }

    @Transactional
    public void saveImportedValues(UUID tenantId,UUID actorId,String resource,UUID recordId,Map<String,JsonNode> importedValues){
        if(!importedValues.isEmpty())putValues(tenantId,actorId,resource,recordId,new PutValuesRequest(importedValues));
    }

    @Transactional
    public void mergeImportedValues(UUID tenantId,UUID actorId,String resource,UUID recordId,Map<String,JsonNode> importedValues){
        if(importedValues.isEmpty())return;
        var merged=new java.util.LinkedHashMap<>(getValues(tenantId,resource,recordId));
        merged.putAll(importedValues);
        putValues(tenantId,actorId,resource,recordId,new PutValuesRequest(merged));
    }

    @Transactional
    public FieldView create(UUID tenantId,UUID actorId,CreateFieldRequest request){
        String resource=resource(request.resourceCode());ensureModule(tenantId,resource);
        String key=request.fieldKey()==null?"":request.fieldKey().trim().toLowerCase(Locale.ROOT);
        if(!key.matches("[a-z][a-z0-9_]{0,39}")||RESERVED.contains(key)||key.startsWith("system_")||key.startsWith("spindl_"))
            throw new BadRequestException("Use a valid custom field key that does not collide with a system field");
        if(fields.findByTenantIdAndResourceCodeAndFieldKey(tenantId,resource,key).isPresent())
            throw new ConflictException("A field with this key already exists for the selected resource");
        String type=request.fieldType()==null?"":request.fieldType().trim().toUpperCase(Locale.ROOT);
        if(!TYPES.contains(type)) throw new BadRequestException("Unsupported custom field type");
        String label=request.displayName()==null?"":request.displayName().trim();
        if(label.isBlank()||label.length()>100) throw new BadRequestException("Field name must be between 1 and 100 characters");
        List<String> options=request.options()==null?List.of():request.options().stream().filter(java.util.Objects::nonNull).map(String::trim).filter(s->!s.isBlank()).distinct().toList();
        if(options.size()>100||options.stream().anyMatch(option->option.length()>100))
            throw new BadRequestException("Select fields can have up to 100 options of at most 100 characters each");
        if("SELECT".equals(type)&&options.isEmpty()) throw new BadRequestException("Select fields need at least one option");
        if(!"SELECT".equals(type)&&!options.isEmpty()) throw new BadRequestException("Options can only be configured for select fields");
        Map<String,Object> validation=request.validation()==null?Map.of():Map.copyOf(request.validation());
        validateRules(type,validation);
        if(request.defaultValue()!=null) validate(type,options,validation,request.defaultValue());
        var field=fields.save(new TenantCustomFieldEntity(UUID.randomUUID(),tenantId,resource,key,label,type,request.required(),options,validation,request.defaultValue(),actorId));
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"CUSTOM_FIELD_CREATED","custom_field",field.getId(),Map.of("resource",resource,"fieldKey",key,"fieldType",type)));
        return TenantCustomFieldMapper.toFieldView(field);
    }

    @Transactional
    public FieldView publish(UUID tenantId,UUID actorId,UUID fieldId){
        var field=fields.findByTenantIdAndId(tenantId,fieldId).orElseThrow(()->new NotFoundException("Custom field not found"));
        ensureModule(tenantId,field.getResourceCode());
        if(!field.isPublished()){
            field.publish();
            audit.save(new TenantAuditEventEntity(tenantId,actorId,"CUSTOM_FIELD_PUBLISHED","custom_field",fieldId,Map.of("resource",field.getResourceCode(),"fieldKey",field.getFieldKey(),"version",field.getVersion())));
        }
        return TenantCustomFieldMapper.toFieldView(field);
    }

    @Transactional(readOnly=true)
    public Map<String,JsonNode> getValues(UUID tenantId,String requestedResource,UUID recordId){
        String resource=resource(requestedResource);ensureModule(tenantId,resource);
        var result=new java.util.LinkedHashMap<String,JsonNode>();
        var definitions=fields.findAllByTenantIdAndResourceCodeOrderByCreatedAtAsc(tenantId,resource).stream().filter(TenantCustomFieldEntity::isPublished).toList();
        definitions.forEach(field->{if(field.getDefaultValue()!=null)result.put(field.getFieldKey(),field.getDefaultValue());});
        for(var value:values.findAllByTenantIdAndResourceCodeAndRecordId(tenantId,resource,recordId))
            fields.findByTenantIdAndId(tenantId,value.getFieldId()).ifPresent(field->{if(field.isPublished())result.put(field.getFieldKey(),value.getValue());});
        return Map.copyOf(result);
    }

    @Transactional
    public Map<String,JsonNode> putValues(UUID tenantId,UUID actorId,String requestedResource,UUID recordId,PutValuesRequest request){
        String resource=resource(requestedResource);ensureModule(tenantId,resource);
        var definitions=fields.findAllByTenantIdAndResourceCodeOrderByCreatedAtAsc(tenantId,resource).stream().filter(TenantCustomFieldEntity::isPublished).toList();
        Map<String,JsonNode> submitted=request.values()==null?Map.of():request.values();
        var known=definitions.stream().map(TenantCustomFieldEntity::getFieldKey).collect(java.util.stream.Collectors.toSet());
        var unknown=submitted.keySet().stream().filter(key->!known.contains(key)).toList();
        if(!unknown.isEmpty())throw new BadRequestException("Unknown or unpublished custom field(s): "+String.join(", ",unknown));
        for(var field:definitions){
            JsonNode value=submitted.get(field.getFieldKey());
            if(value==null){if(field.isRequired())throw new BadRequestException("Required custom field is missing: "+field.getDisplayName());continue;}
            validate(field.getFieldType(),field.getOptions(),field.getValidation(),value);
        }
        values.deleteRecordValues(tenantId,resource,recordId);
        var stored=new ArrayList<TenantCustomFieldValueEntity>();
        for(var field:definitions){JsonNode value=submitted.get(field.getFieldKey());if(value!=null)stored.add(new TenantCustomFieldValueEntity(tenantId,resource,recordId,field.getId(),value,actorId));}
        values.saveAll(stored);
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"CUSTOM_FIELD_VALUES_SAVED","custom_record",recordId,Map.of("resource",resource,"fieldCount",stored.size())));
        return getValues(tenantId,resource,recordId);
    }

    private String resource(String value){
        String resource=value==null?"":value.trim().toLowerCase(Locale.ROOT);
        if(!RESOURCES.contains(resource))throw new BadRequestException("Unsupported custom field resource");
        return resource;
    }
    private void ensureModule(UUID tenantId,String resource){
        String module=switch(resource){case "customers"->"crm";case "items"->"catalog";case "suppliers","purchase_orders"->"purchasing";case "sales_orders","quotes"->"sales";case "invoices"->"finance";default->"manufacturing";};
        if(!modules.isEnabled(tenantId,module))throw new ForbiddenException("Enable the "+module+" module to use its custom fields");
    }
    private void validateRules(String type,Map<String,Object> rules){
        Set<String> allowed="TEXT".equals(type)?Set.of("minLength","maxLength","pattern"):"NUMBER".equals(type)?Set.of("min","max"):Set.of();
        if(!allowed.containsAll(rules.keySet()))throw new BadRequestException("Validation rule is not supported for this field type");
        if(rules.containsKey("minLength")&&(number(rules.get("minLength"))<0||number(rules.get("minLength"))>2000)
                ||rules.containsKey("maxLength")&&(number(rules.get("maxLength"))<1||number(rules.get("maxLength"))>2000))
            throw new BadRequestException("Text length bounds are invalid");
        if(rules.containsKey("minLength")&&rules.containsKey("maxLength")&&number(rules.get("minLength"))>number(rules.get("maxLength")))
            throw new BadRequestException("Minimum text length cannot exceed maximum text length");
        if(rules.containsKey("min")&&rules.containsKey("max")&&number(rules.get("min"))>number(rules.get("max")))
            throw new BadRequestException("Minimum value cannot exceed maximum value");
        Object pattern=rules.get("pattern");if(pattern!=null)try{
            String expression=pattern.toString();
            if(expression.length()>128||expression.contains("(")||expression.contains(")")||expression.matches(".*\\\\[1-9].*"))
                throw new IllegalArgumentException("Unsafe or overly complex pattern");
            Pattern.compile(expression);
        }catch(Exception e){throw new BadRequestException("Validation pattern is invalid or too complex");}
    }
    private void validate(String type,List<String> options,Map<String,Object> rules,JsonNode value){
        boolean valid=switch(type){
            case "TEXT"->value.isTextual()&&value.textValue().length()>=number(rules.getOrDefault("minLength",0))&&value.textValue().length()<=number(rules.getOrDefault("maxLength",10000))&&(rules.get("pattern")==null||Pattern.matches(rules.get("pattern").toString(),value.textValue()));
            case "NUMBER"->value.isNumber()&&value.doubleValue()>=decimal(rules.getOrDefault("min",-Double.MAX_VALUE))&&value.doubleValue()<=decimal(rules.getOrDefault("max",Double.MAX_VALUE));
            case "DATE"->value.isTextual()&&validDate(value.textValue());
            case "BOOLEAN"->value.isBoolean();
            case "SELECT"->value.isTextual()&&options.contains(value.textValue());
            case "REFERENCE"->value.isTextual()&&validUuid(value.textValue());
            default->false;
        };
        if(!valid)throw new BadRequestException("Value does not meet the configured custom field type or validation rules");
    }
    private int number(Object value){try{return Integer.parseInt(value.toString());}catch(Exception e){throw new BadRequestException("Validation length must be an integer");}}
    private double decimal(Object value){try{return Double.parseDouble(value.toString());}catch(Exception e){throw new BadRequestException("Numeric validation limit is invalid");}}
    private boolean validDate(String value){try{LocalDate.parse(value);return true;}catch(Exception e){return false;}}
    private boolean validUuid(String value){try{UUID.fromString(value);return true;}catch(Exception e){return false;}}


    @Transactional
    public int moveCustomerValues(UUID tenantId, UUID sourceId, UUID targetId, UUID actorId) {
        values.deleteConflictingCustomerValues(tenantId, sourceId, targetId);
        return values.moveCustomerValues(tenantId, sourceId, targetId, actorId);
    }
}
