package si.spindl.identity;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import jakarta.persistence.EntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.imports.ImportBatchEntity;
import si.spindl.imports.ImportBatchRepository;
import si.spindl.tenant.CurrentTenant;
import tools.jackson.databind.JsonNode;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import si.spindl.identity.CustomFieldCsvImportDtos.RowError;
import si.spindl.identity.CustomFieldCsvImportDtos.Preview;
import si.spindl.identity.CustomFieldCsvImportDtos.CommitResult;

@Service
public class CustomFieldCsvImportService {
    private static final int MAX_BYTES=2*1024*1024,MAX_ROWS=500;
    private static final Map<String,String> TABLES=Map.of("customers","customers","items","items","suppliers","suppliers","purchase_orders","purchase_orders","quotes","sales_quotes","sales_orders","sales_orders","invoices","invoices","work_orders","work_orders");
    private final TenantCustomFieldService fields;
    private final TenantCustomFieldRepository definitions;
    private final TenantCustomFieldValueRepository values;
    private final ImportBatchRepository batches;
    private final TenantAuditEventRepository audit;
    private final EntityManager entityManager;
    private final CurrentTenant tenant;

    public CustomFieldCsvImportService(TenantCustomFieldService fields,TenantCustomFieldRepository definitions,TenantCustomFieldValueRepository values,
                                      ImportBatchRepository batches,TenantAuditEventRepository audit,EntityManager entityManager,CurrentTenant tenant){
        this.fields=fields;this.definitions=definitions;this.values=values;this.batches=batches;this.audit=audit;this.entityManager=entityManager;this.tenant=tenant;
    }

    @Transactional(readOnly=true)
    public Preview preview(String resource,byte[] file){return validate(resource,file).preview();}

    @Transactional
    public CommitResult commit(String resource,String key,byte[] file,UUID actorId){
        String code=resource(resource);UUID tenantId=tenant.currentTenantId();
        if(key==null||key.isBlank()||key.length()>120)throw new BadRequestException("A valid Idempotency-Key header is required");
        if(file==null||file.length==0||file.length>MAX_BYTES)return rejectedCommit(validate(code,file));
        String hash=sha256(file),batchType="CUSTOM_FIELD_"+code.toUpperCase(Locale.ROOT);
        var prior=batches.findByTenantIdAndResourceTypeAndIdempotencyKey(tenantId,batchType,key).orElse(null);
        if(prior!=null){if(!prior.getContentSha256().equals(hash))throw new ConflictException("Idempotency key was reused with a different file");return new CommitResult(true,true,prior.getRowsImported(),List.of());}
        Validation result=validate(code,file);
        if(!result.errors().isEmpty())return rejectedCommit(result);
        if(result.rows().isEmpty())return rejectedCommit(result.withError(new RowError(1,"File has no data rows")));
        for(var row:result.rows())fields.mergeImportedValues(tenantId,actorId,code,row.recordId(),row.values());
        try{
            var batch=batches.saveAndFlush(new ImportBatchEntity(tenantId,batchType,key,hash,result.rows().size()));
            audit.save(new TenantAuditEventEntity(tenantId,actorId,"CUSTOM_FIELD_CSV_IMPORTED","custom_field_import",batch.getId(),Map.of("resource",code,"rows",result.rows().size(),"fields",result.fieldCount())));
            return new CommitResult(true,false,result.rows().size(),List.of());
        }catch(DataIntegrityViolationException duplicate){throw new ConflictException("This custom-field import was submitted concurrently; retry with the same key");}
    }

    private Validation validate(String requested,byte[] file){
        String code=resource(requested);UUID tenantId=tenant.currentTenantId();
        if(file==null||file.length==0)return Validation.invalid(0,new RowError(1,"Choose a CSV file"));
        if(file.length>MAX_BYTES)return Validation.invalid(0,new RowError(1,"CSV file must be 2 MB or smaller"));
        String content;
        try{content=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(file)).toString();}
        catch(CharacterCodingException ex){return Validation.invalid(0,new RowError(1,"File must use UTF-8 encoding"));}
        if(content.startsWith("\uFEFF"))content=content.substring(1);
        Parsed parsed=parse(content);if(parsed.error()!=null)return Validation.invalid(0,parsed.error());
        if(parsed.records().isEmpty())return Validation.invalid(0,new RowError(1,"CSV file is empty"));
        List<String> headers=parsed.records().getFirst().stream().map(v->v.trim().toLowerCase(Locale.ROOT)).toList();
        List<RowError> errors=new ArrayList<>();
        if(new HashSet<>(headers).size()!=headers.size())errors.add(new RowError(1,"Header contains duplicate columns"));
        if(!headers.contains("id"))errors.add(new RowError(1,"Missing required column: id"));
        List<TenantCustomFieldDtos.ImportField> available=fields.importFields(tenantId,code);
        Map<String,TenantCustomFieldDtos.ImportField> byKey=new HashMap<>();available.forEach(f->byKey.put(f.fieldKey(),f));
        List<String> selected=headers.stream().filter(h->!h.equals("id")).toList();
        if(selected.isEmpty())errors.add(new RowError(1,"Include at least one published custom-field key as a column"));
        for(String header:selected)if(!byKey.containsKey(header))errors.add(new RowError(1,"Unknown or unpublished custom-field column: "+header));
        if(parsed.records().size()==1)return Validation.invalid(0,new RowError(1,"File has no data rows"));
        int total=parsed.records().size()-1;if(total>MAX_ROWS)return Validation.invalid(total,new RowError(1,"Import is limited to 500 data rows"));
        if(!errors.isEmpty())return new Validation(total,List.of(),errors,previewRows(headers,parsed.records().stream().skip(1).limit(10).toList()),selected.size());
        List<TenantCustomFieldDtos.ImportField> selectedFields=selected.stream().map(byKey::get).toList();
        Map<String,Integer> index=new HashMap<>();for(int i=0;i<headers.size();i++)index.put(headers.get(i),i);
        Set<UUID> seen=new HashSet<>();List<ImportRow> rows=new ArrayList<>();
        for(int i=1;i<parsed.records().size();i++){
            List<String> cells=parsed.records().get(i);int rowNumber=i+1;
            if(cells.stream().allMatch(String::isBlank))continue;
            if(cells.size()!=headers.size()){errors.add(new RowError(rowNumber,"Expected "+headers.size()+" columns but found "+cells.size()));continue;}
            UUID id;try{id=UUID.fromString(cells.get(index.get("id")).trim());}catch(RuntimeException invalid){errors.add(new RowError(rowNumber,"Record id must be a UUID"));continue;}
            if(!seen.add(id)){errors.add(new RowError(rowNumber,"Record id appears more than once in this file"));continue;}
            if(!recordExists(tenantId,code,id)){errors.add(new RowError(rowNumber,"Record was not found in this workspace"));continue;}
            Map<String,String> raw=new LinkedHashMap<>();for(String field:selected)raw.put(field,cells.get(index.get(field)).trim());
            try{Map<String,JsonNode> parsedValues=fields.parseImportValues(selectedFields,raw);rows.add(new ImportRow(id,parsedValues));}
            catch(ResponseStatusException invalid){errors.add(new RowError(rowNumber,invalid.getReason()==null?"Invalid custom-field value":invalid.getReason()));}
        }
        return new Validation(total,rows,errors,previewRows(headers,parsed.records().stream().skip(1).filter(r->r.stream().anyMatch(v->!v.isBlank())).limit(10).toList()),selected.size());
    }

    private boolean recordExists(UUID tenantId,String resource,UUID recordId){String table=TABLES.get(resource);Boolean exists=(Boolean)entityManager.createNativeQuery("select exists(select 1 from public."+table+" where tenant_id=:tenant and id=:id)").setParameter("tenant",tenantId).setParameter("id",recordId).getSingleResult();return exists;}
    private String resource(String value){String code=value==null?"":value.trim().toLowerCase(Locale.ROOT);if(!TABLES.containsKey(code))throw new BadRequestException("Unsupported custom-field import resource");return code;}
    private static List<Map<String,String>> previewRows(List<String> headers,List<List<String>> rows){return rows.stream().map(row->{Map<String,String> values=new LinkedHashMap<>();for(int i=0;i<Math.min(headers.size(),row.size());i++)values.put(headers.get(i),row.get(i));return values;}).toList();}
    private static String sha256(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new si.spindl.common.exception.InfrastructureException("SHA-256 is unavailable", e);}}
    private static Parsed parse(String text){List<List<String>> records=new ArrayList<>();List<String> row=new ArrayList<>();StringBuilder field=new StringBuilder();boolean quoted=false,afterQuote=false;
        for(int i=0;i<text.length();i++){char c=text.charAt(i);if(quoted){if(c=='"'){if(i+1<text.length()&&text.charAt(i+1)=='"'){field.append('"');i++;}else{quoted=false;afterQuote=true;}}else field.append(c);continue;}
            if(afterQuote&&c!=' '&&c!='\t'&&c!=','&&c!='\r'&&c!='\n')return new Parsed(List.of(),new RowError(records.size()+1,"Unexpected character after a closing quote"));
            if(c=='"'){if(field.length()>0)return new Parsed(List.of(),new RowError(records.size()+1,"Unexpected quote in an unquoted field"));quoted=true;afterQuote=false;}
            else if(c==','){row.add(field.toString());field.setLength(0);afterQuote=false;}
            else if(c=='\n'||c=='\r'){if(c=='\r'&&i+1<text.length()&&text.charAt(i+1)=='\n')i++;row.add(field.toString());field.setLength(0);afterQuote=false;if(row.stream().anyMatch(v->!v.isBlank()))records.add(List.copyOf(row));row.clear();}
            else if(afterQuote){/* ignore whitespace after quoted cell */}else field.append(c);
        }
        if(quoted)return new Parsed(List.of(),new RowError(records.size()+1,"CSV contains an unclosed quoted field"));
        if(field.length()>0||!row.isEmpty()){row.add(field.toString());if(row.stream().anyMatch(v->!v.isBlank()))records.add(List.copyOf(row));}
        return new Parsed(records,null);
    }
    private record Parsed(List<List<String>> records,RowError error){}
    private record ImportRow(UUID recordId,Map<String,JsonNode> values){}
    private record Validation(int totalRows,List<ImportRow> rows,List<RowError> errors,List<Map<String,String>> sampleRows,int fieldCount){static Validation invalid(int count,RowError error){return new Validation(count,List.of(),List.of(error),List.of(),0);}Validation withError(RowError error){var next=new ArrayList<>(errors);next.add(error);return new Validation(totalRows,rows,next,sampleRows,fieldCount);}Preview preview(){return new Preview(totalRows,rows.size(),errors,sampleRows,fieldCount);}}
    private CommitResult rejectedCommit(Validation result){return new CommitResult(false,false,0,result.errors());}
}
