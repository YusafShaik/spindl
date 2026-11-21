package si.spindl.imports;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.inventory.InventoryMovementEntity;
import si.spindl.inventory.InventoryMovementRepository;
import si.spindl.catalog.ItemEntity;
import si.spindl.catalog.ItemRepository;
import si.spindl.inventory.WarehouseEntity;
import si.spindl.inventory.WarehouseRepository;
import si.spindl.inventory.WarehouseStockEntity;
import si.spindl.inventory.WarehouseStockRepository;
import si.spindl.party.CustomerEntity;
import si.spindl.party.CustomerRepository;
import si.spindl.tenant.DevelopmentTenant;
import si.spindl.identity.TenantCustomFieldService;
import si.spindl.identity.TenantCustomFieldRepository;
import si.spindl.identity.TenantCustomFieldValueRepository;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.purchasing.SupplierEntity;
import si.spindl.purchasing.SupplierRepository;
import si.spindl.manufacturing.WorkOrderRepository;
import si.spindl.purchasing.PurchaseOrderRepository;
import si.spindl.sales.SalesQuoteRepository;
import si.spindl.sales.SalesOrderRepository;
import si.spindl.finance.InvoiceRepository;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@Service
public class CsvImportService {
    private static final int MAX_BYTES=2*1024*1024;
    private static final int MAX_ROWS=500;
    private static final Set<String> CUSTOMER_HEADERS=Set.of("code","name","email");
    private static final Set<String> ITEM_HEADERS=Set.of("sku","name","category","openingstock","unit","unitprice");
    private static final Set<String> SUPPLIER_HEADERS=Set.of("code","name","email");
    private final CustomerRepository customers;
    private final ItemRepository items;
    private final InventoryMovementRepository movements;
    private final ImportBatchRepository batches;
    private final DevelopmentTenant tenant;
    private final TenantCustomFieldService customFields;
    private final TenantCustomFieldRepository customFieldDefinitions;
    private final TenantCustomFieldValueRepository customFieldValues;
    private final TenantAuditEventRepository audit;
    private final SupplierRepository suppliers;
    private final WorkOrderRepository workOrders;
    private final PurchaseOrderRepository purchaseOrders;
    private final SalesQuoteRepository quotes;
    private final SalesOrderRepository salesOrders;
    private final InvoiceRepository invoices;
    private final WarehouseRepository warehouses;
    private final WarehouseStockRepository warehouseStock;
    public CsvImportService(CustomerRepository customers,ItemRepository items,InventoryMovementRepository movements,ImportBatchRepository batches,DevelopmentTenant tenant,TenantCustomFieldService customFields,TenantCustomFieldRepository customFieldDefinitions,TenantCustomFieldValueRepository customFieldValues,TenantAuditEventRepository audit,SupplierRepository suppliers,WorkOrderRepository workOrders,PurchaseOrderRepository purchaseOrders,SalesQuoteRepository quotes,SalesOrderRepository salesOrders,InvoiceRepository invoices,WarehouseRepository warehouses,WarehouseStockRepository warehouseStock){this.customers=customers;this.items=items;this.movements=movements;this.batches=batches;this.tenant=tenant;this.customFields=customFields;this.customFieldDefinitions=customFieldDefinitions;this.customFieldValues=customFieldValues;this.audit=audit;this.suppliers=suppliers;this.workOrders=workOrders;this.purchaseOrders=purchaseOrders;this.quotes=quotes;this.salesOrders=salesOrders;this.invoices=invoices;this.warehouses=warehouses;this.warehouseStock=warehouseStock;}

    @Transactional(readOnly=true)
    public PreviewResult preview(String resource,byte[] file){return validate(normalizeResource(resource),file).preview();}

    @Transactional
    public String export(String resource,UUID actorId){
        String type=normalizeExportResource(resource);UUID tenantId=tenant.currentTenantId();String resourceCode=resourceCode(type);
        var definitions=customFieldDefinitions.findAllByTenantIdAndResourceCodeOrderByCreatedAtAsc(tenantId,resourceCode).stream().filter(si.spindl.identity.TenantCustomFieldEntity::isPublished).toList();
        StringBuilder csv=new StringBuilder();List<String> headers=new ArrayList<>(switch(type){case "CUSTOMERS"->List.of("code","name","email","status","customerType","contactName","phone","addressLine1","addressLine2","city","region","postalCode","countryCode","taxId","paymentTermsDays","creditLimit","tags","creditHold");case "ITEMS"->List.of("sku","name","category","openingStock","unit","unitPrice","lowStockThreshold","itemType");case "SUPPLIERS"->List.of("code","name","email","contactName","phone","addressLine1","addressLine2","city","region","postalCode","countryCode","taxId","paymentTermsDays","leadTimeDays","rating","notes");case "WORK_ORDERS"->List.of("orderNumber","bomId","finishedItemId","outputWarehouseId","targetQuantity","goodQuantity","scrapQuantity","status","priority","plannedStart","dueDate","createdAt");case "PURCHASE_ORDERS"->List.of("orderNumber","supplier","status","createdAt","lines","notes");case "QUOTES"->List.of("quoteNumber","customer","status","validUntil","total","createdAt","lines","notes");case "SALES_ORDERS"->List.of("orderNumber","customer","quoteNumber","status","createdAt","total","lines");default->List.of("invoiceNumber","customer","salesOrder","issuedAt","dueDate","status","subtotal","taxCode","taxRate","taxTotal","total","amountPaid","creditTotal","balance");});
        definitions.forEach(field->headers.add(field.getFieldKey()));appendCsvRow(csv,headers,Collections.nCopies(headers.size(),false));
        Map<UUID,String> keyByFieldId=new HashMap<>();definitions.forEach(field->keyByFieldId.put(field.getId(),field.getFieldKey()));
        int rowCount;
        if(type.equals("CUSTOMERS")){
            var page=customers.findAllByTenantIdAndActiveTrueOrderByName(tenantId,PageRequest.of(0,10001));if(page.getTotalElements()>10000)throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Export is limited to 10,000 active records; narrow the export and try again");
            var records=page.getContent();rowCount=records.size();var customValues=loadExportValues(tenantId,resourceCode,records.stream().map(CustomerEntity::getId).toList(),keyByFieldId,definitions);
            for(CustomerEntity record:records){List<String> row=new ArrayList<>(List.of(record.getCode(),record.getName(),record.getEmail(),record.getStatus(),record.getCustomerType(),Objects.toString(record.getContactName(),""),Objects.toString(record.getPhone(),""),Objects.toString(record.getAddressLine1(),""),Objects.toString(record.getAddressLine2(),""),Objects.toString(record.getCity(),""),Objects.toString(record.getRegion(),""),Objects.toString(record.getPostalCode(),""),Objects.toString(record.getCountryCode(),""),Objects.toString(record.getTaxId(),""),Integer.toString(record.getPaymentTermsDays()),record.getCreditLimit().toPlainString(),Objects.toString(record.getTags(),""),Boolean.toString(record.isCreditHold())));appendCustomValues(row,definitions,customValues.get(record.getId()));List<Boolean> safe=new ArrayList<>(List.of(true,true,true,true,true,true,true,true,true,true,true,true,true,true,false,false,true,false));definitions.forEach(field->safe.add(!Set.of("NUMBER","BOOLEAN").contains(field.getFieldType())));appendCsvRow(csv,row,safe);}
        }else if(type.equals("ITEMS")){
            var page=items.findAllByTenantIdAndActiveTrueOrderByName(tenantId,PageRequest.of(0,10001));if(page.getTotalElements()>10000)throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Export is limited to 10,000 active records; narrow the export and try again");
            var records=page.getContent();rowCount=records.size();var customValues=loadExportValues(tenantId,resourceCode,records.stream().map(ItemEntity::getId).toList(),keyByFieldId,definitions);
            for(ItemEntity record:records){List<String> row=new ArrayList<>(List.of(record.getSku(),record.getName(),record.getCategory(),Integer.toString(record.getOnHand()),record.getUnit(),record.getUnitPrice().toPlainString(),Integer.toString(record.getLowStockThreshold()),record.getItemType()));appendCustomValues(row,definitions,customValues.get(record.getId()));List<Boolean> safe=new ArrayList<>(List.of(true,true,true,false,true,false,false,true));definitions.forEach(field->safe.add(!Set.of("NUMBER","BOOLEAN").contains(field.getFieldType())));appendCsvRow(csv,row,safe);}
        }else if(type.equals("SUPPLIERS")){
            var page=suppliers.findAllByTenantIdAndActiveTrueOrderByName(tenantId,PageRequest.of(0,10001));if(page.getTotalElements()>10000)throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Export is limited to 10,000 active records; narrow the export and try again");
            var records=page.getContent();rowCount=records.size();var customValues=loadExportValues(tenantId,resourceCode,records.stream().map(SupplierEntity::getId).toList(),keyByFieldId,definitions);
            for(SupplierEntity record:records){List<String> row=new ArrayList<>(List.of(record.getCode(),record.getName(),record.getEmail(),Objects.toString(record.getContactName(),""),Objects.toString(record.getPhone(),""),Objects.toString(record.getAddressLine1(),""),Objects.toString(record.getAddressLine2(),""),Objects.toString(record.getCity(),""),Objects.toString(record.getRegion(),""),Objects.toString(record.getPostalCode(),""),Objects.toString(record.getCountryCode(),""),Objects.toString(record.getTaxId(),""),Integer.toString(record.getPaymentTermsDays()),Integer.toString(record.getLeadTimeDays()),Objects.toString(record.getRating(),""),Objects.toString(record.getNotes(),"")));appendCustomValues(row,definitions,customValues.get(record.getId()));List<Boolean> safe=new ArrayList<>(List.of(true,true,true,true,true,true,true,true,true,true,true,true,false,false,false,true));definitions.forEach(field->safe.add(!Set.of("NUMBER","BOOLEAN").contains(field.getFieldType())));appendCsvRow(csv,row,safe);}
        }else if(type.equals("WORK_ORDERS")){
            var page=workOrders.findPageByTenantIdOrderByCreatedAtDesc(tenantId,PageRequest.of(0,10001));if(page.getTotalElements()>10000)throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Export is limited to 10,000 work orders; narrow the export and try again");
            var records=page.getContent();rowCount=records.size();var customValues=loadExportValues(tenantId,resourceCode,records.stream().map(si.spindl.manufacturing.WorkOrderEntity::getId).toList(),keyByFieldId,definitions);
            for(var record:records){List<String> row=new ArrayList<>(List.of(record.getOrderNumber(),record.getBomId().toString(),record.getFinishedItemId().toString(),record.getOutputWarehouse().getId().toString(),Integer.toString(record.getTargetQuantity()),Integer.toString(record.getGoodQuantity()),Integer.toString(record.getScrapQuantity()),record.getStatus(),record.getPriority(),Objects.toString(record.getPlannedStart(),""),Objects.toString(record.getDueDate(),""),record.getCreatedAt().toString()));appendCustomValues(row,definitions,customValues.get(record.getId()));List<Boolean> safe=new ArrayList<>(List.of(true,true,true,true,false,false,false,true,true,false,false,false));definitions.forEach(field->safe.add(!Set.of("NUMBER","BOOLEAN").contains(field.getFieldType())));appendCsvRow(csv,row,safe);}
        }else if(type.equals("PURCHASE_ORDERS")){
            if(purchaseOrders.countByTenantId(tenantId)>10000)throw exportLimit();var records=purchaseOrders.findAllByTenantIdOrderByCreatedAtDesc(tenantId);rowCount=records.size();var customValues=loadExportValues(tenantId,resourceCode,records.stream().map(si.spindl.purchasing.PurchaseOrderEntity::getId).toList(),keyByFieldId,definitions);
            for(var record:records){String lineSummary=record.getLines().stream().map(line->line.getItem().getSku()+" × "+line.getOrderedQuantity()+" @ "+line.getUnitPrice().toPlainString()).collect(java.util.stream.Collectors.joining("; "));List<String> row=new ArrayList<>(List.of(record.getOrderNumber(),record.getSupplier().getName(),record.getStatus(),record.getCreatedAt().toString(),lineSummary,Objects.toString(record.getNotes(),"")));appendCustomValues(row,definitions,customValues.get(record.getId()));List<Boolean> safe=new ArrayList<>(List.of(true,true,true,false,true,true));definitions.forEach(field->safe.add(!Set.of("NUMBER","BOOLEAN").contains(field.getFieldType())));appendCsvRow(csv,row,safe);}
        }else if(type.equals("QUOTES")){
            if(quotes.countByTenantId(tenantId)>10000)throw exportLimit();var records=quotes.findAllByTenantIdOrderByCreatedAtDesc(tenantId);rowCount=records.size();var customValues=loadExportValues(tenantId,resourceCode,records.stream().map(si.spindl.sales.SalesQuoteEntity::getId).toList(),keyByFieldId,definitions);
            for(var record:records){String lineSummary=record.getLines().stream().map(line->line.getItem().getSku()+" × "+line.getQuantity()+" @ "+line.getUnitPrice().toPlainString()).collect(java.util.stream.Collectors.joining("; "));List<String> row=new ArrayList<>(List.of(record.getQuoteNumber(),record.getCustomer().getName(),record.getStatus(),Objects.toString(record.getValidUntil(),""),record.getTotal().toPlainString(),record.getCreatedAt().toString(),lineSummary,Objects.toString(record.getNotes(),"")));appendCustomValues(row,definitions,customValues.get(record.getId()));List<Boolean> safe=new ArrayList<>(List.of(true,true,true,false,false,false,true,true));definitions.forEach(field->safe.add(!Set.of("NUMBER","BOOLEAN").contains(field.getFieldType())));appendCsvRow(csv,row,safe);}
        }else if(type.equals("SALES_ORDERS")){
            if(salesOrders.countByTenantId(tenantId)>10000)throw exportLimit();var records=salesOrders.findAllByTenantIdOrderByCreatedAtDesc(tenantId);rowCount=records.size();var customValues=loadExportValues(tenantId,resourceCode,records.stream().map(si.spindl.sales.SalesOrderEntity::getId).toList(),keyByFieldId,definitions);
            for(var record:records){String lineSummary=record.getLines().stream().map(line->line.getItem().getSku()+" × "+line.getQuantity()+" @ "+line.getUnitPrice().toPlainString()).collect(java.util.stream.Collectors.joining("; "));List<String> row=new ArrayList<>(List.of(record.getOrderNumber(),record.getCustomer().getName(),record.getQuote().getQuoteNumber(),record.getStatus(),record.getCreatedAt().toString(),record.getTotal().toPlainString(),lineSummary));appendCustomValues(row,definitions,customValues.get(record.getId()));List<Boolean> safe=new ArrayList<>(List.of(true,true,true,true,false,false,true));definitions.forEach(field->safe.add(!Set.of("NUMBER","BOOLEAN").contains(field.getFieldType())));appendCsvRow(csv,row,safe);}
        }else{
            if(invoices.countByTenantId(tenantId)>10000)throw exportLimit();var records=invoices.findAllByTenantIdOrderByIssuedAtDesc(tenantId);rowCount=records.size();var customValues=loadExportValues(tenantId,resourceCode,records.stream().map(si.spindl.finance.InvoiceEntity::getId).toList(),keyByFieldId,definitions);
            for(var record:records){List<String> row=new ArrayList<>(List.of(record.getInvoiceNumber(),record.getCustomer().getName(),record.getSalesOrder().getOrderNumber(),record.getIssuedAt().toString(),record.getDueDate().toString(),record.getStatus(),record.getSubtotal().toPlainString(),record.getTaxCode(),record.getTaxRate().toPlainString(),record.getTaxTotal().toPlainString(),record.getTotal().toPlainString(),record.getAmountPaid().toPlainString(),record.getCreditTotal().toPlainString(),record.getBalance().toPlainString()));appendCustomValues(row,definitions,customValues.get(record.getId()));List<Boolean> safe=new ArrayList<>(List.of(true,true,true,false,false,true,false,true,false,false,false,false,false,false));definitions.forEach(field->safe.add(!Set.of("NUMBER","BOOLEAN").contains(field.getFieldType())));appendCsvRow(csv,row,safe);}
        }
        audit.save(new TenantAuditEventEntity(tenantId,actorId,"CSV_DATA_EXPORTED","import_export",null,Map.of("resource",resourceCode,"rowCount",rowCount,"customFieldCount",definitions.size())));
        return csv.toString();
    }

    private Map<UUID,Map<String,String>> loadExportValues(UUID tenantId,String resource,List<UUID> recordIds,Map<UUID,String> keyByFieldId,List<si.spindl.identity.TenantCustomFieldEntity> definitions){
        Map<UUID,Map<String,String>> result=new HashMap<>();for(UUID recordId:recordIds){Map<String,String> values=new HashMap<>();for(var field:definitions)if(field.getDefaultValue()!=null)values.put(field.getFieldKey(),jsonValue(field.getDefaultValue()));result.put(recordId,values);}
        if(!recordIds.isEmpty())for(var value:customFieldValues.findAllByTenantIdAndResourceCodeAndRecordIdIn(tenantId,resource,recordIds)){String key=keyByFieldId.get(value.getFieldId());if(key!=null)result.get(value.getRecordId()).put(key,jsonValue(value.getValue()));}
        return result;
    }
    private static String jsonValue(tools.jackson.databind.JsonNode value){return value==null||value.isNull()?"":value.isTextual()?value.textValue():value.toString();}
    private void appendCustomValues(List<String> row,List<si.spindl.identity.TenantCustomFieldEntity> definitions,Map<String,String> values){for(var field:definitions)row.add(values==null?"":values.getOrDefault(field.getFieldKey(),""));}
    private static void appendCsvRow(StringBuilder csv,List<String> cells,List<Boolean> formulaSensitive){for(int i=0;i<cells.size();i++){if(i>0)csv.append(',');String value=Objects.requireNonNullElse(cells.get(i),"");String trimmed=value.stripLeading();if(formulaSensitive.get(i)&&!trimmed.isEmpty()&&"=+-@\t\r".indexOf(trimmed.charAt(0))>=0)value="'"+value;csv.append('"').append(value.replace("\"","\"\"")).append('"');}csv.append("\r\n");}

    @Transactional
    public CommitResult commit(String resource,String idempotencyKey,byte[] file,UUID actorId){
        String type=normalizeResource(resource);
        if(idempotencyKey==null||idempotencyKey.isBlank()||idempotencyKey.length()>120)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A valid Idempotency-Key header is required (max 120 characters)");
        if(file==null||file.length==0||file.length>MAX_BYTES)return CommitResult.rejected(validate(type,file));
        String hash=sha256(file);
        UUID tenantId=tenant.currentTenantId();
        ImportBatchEntity prior=batches.findByTenantIdAndResourceTypeAndIdempotencyKey(tenantId,type,idempotencyKey).orElse(null);
        if(prior!=null){if(!prior.getContentSha256().equals(hash))throw new ResponseStatusException(HttpStatus.CONFLICT,"Idempotency key was reused with a different file");return CommitResult.replayed(prior);}
        Validation validation=validate(type,file);
        if(!validation.errors().isEmpty())return CommitResult.rejected(validation);
        if(validation.rows().isEmpty())return CommitResult.rejected(validation.withError(new ImportError(1,"File has no data rows")));
        try{
            if(type.equals("CUSTOMERS")){
                List<CustomerEntity> rows=validation.rows().stream().map(row->{CustomerRow c=(CustomerRow)row;CustomerEntity e=new CustomerEntity(tenantId,c.code(),c.name(),c.email(),c.status(),actorId);e.applyProfile(c.customerType(),c.contactName(),c.phone(),c.addressLine1(),c.addressLine2(),c.city(),c.region(),c.postalCode(),c.countryCode(),c.taxId(),c.paymentTermsDays(),c.creditLimit(),c.tags(),c.creditHold(),actorId);return e;}).toList();
                List<CustomerEntity> saved=customers.saveAllAndFlush(rows);
                Map<String,CustomerRow> customValues=validation.rows().stream().map(CustomerRow.class::cast).collect(java.util.stream.Collectors.toMap(CustomerRow::code,row->row));
                for(CustomerEntity customer:saved)customFields.saveImportedValues(tenantId,actorId,"customers",customer.getId(),customValues.get(customer.getCode()).customValues());
            }else if(type.equals("ITEMS")){
                List<ItemEntity> rows=validation.rows().stream().map(row->{ItemRow item=(ItemRow)row;ItemEntity entity=new ItemEntity(tenantId,item.sku(),item.name(),item.category(),item.openingStock(),item.unit(),item.unitPrice(),item.lowStockThreshold());entity.updateType(item.itemType());return entity;}).toList();
                List<ItemEntity> saved=items.saveAllAndFlush(rows);
                Map<String,ItemRow> customValues=validation.rows().stream().map(ItemRow.class::cast).collect(java.util.stream.Collectors.toMap(ItemRow::sku,row->row));
                for(ItemEntity item:saved)customFields.saveImportedValues(tenantId,actorId,"items",item.getId(),customValues.get(item.getSku()).customValues());
                WarehouseEntity defaultWarehouse=warehouses.findByTenantIdAndIsDefaultTrueAndActiveTrue(tenantId).orElse(null);
                for(ItemEntity item:saved){
                    if(item.getOnHand()>0){
                        if(defaultWarehouse!=null){
                            warehouseStock.findForUpdate(tenantId,defaultWarehouse.getId(),item.getId()).ifPresent(ws->ws.receiveStock(item.getOnHand()));
                        }
                        movements.save(new InventoryMovementEntity(tenantId,item,item.getOnHand(),"Opening balance","IMPORT-OPENING-"+item.getSku()));
                    }
                }
                movements.flush();
            }else{
                List<SupplierEntity> rows=validation.rows().stream().map(row->{SupplierRow r=(SupplierRow)row;SupplierEntity e=new SupplierEntity(tenantId,r.code(),r.name(),r.email());e.updateProfile(r.contactName(),r.phone(),r.addressLine1(),r.addressLine2(),r.city(),r.region(),r.postalCode(),r.countryCode(),r.taxId(),r.paymentTermsDays(),r.leadTimeDays(),r.rating(),r.notes());return e;}).toList();
                List<SupplierEntity> saved=suppliers.saveAllAndFlush(rows);
                Map<String,SupplierRow> customValues=validation.rows().stream().map(SupplierRow.class::cast).collect(java.util.stream.Collectors.toMap(SupplierRow::code,row->row));
                for(SupplierEntity supplier:saved)customFields.saveImportedValues(tenantId,actorId,"suppliers",supplier.getId(),customValues.get(supplier.getCode()).customValues());
            }
            ImportBatchEntity batch=batches.saveAndFlush(new ImportBatchEntity(tenantId,type,idempotencyKey,hash,validation.rows().size()));
            return CommitResult.created(batch);
        }catch(DataIntegrityViolationException exception){throw new ResponseStatusException(HttpStatus.CONFLICT,"A customer code or item SKU now exists; refresh the preview and resolve duplicates");}
    }

    private Validation validate(String type,byte[] file){
        if(file==null||file.length==0)return Validation.invalid(0,new ImportError(1,"Choose a CSV file"));
        if(file.length>MAX_BYTES)return Validation.invalid(0,new ImportError(1,"CSV file must be 2 MB or smaller"));
        String content;
        try{content=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(file)).toString();}
        catch(CharacterCodingException exception){return Validation.invalid(0,new ImportError(1,"File must use UTF-8 encoding"));}
        if(content.startsWith("\uFEFF"))content=content.substring(1);
        CsvRecords csv=parse(content);
        if(csv.error()!=null)return Validation.invalid(0,csv.error());
        if(csv.records().isEmpty())return Validation.invalid(0,new ImportError(1,"CSV file is empty"));
        List<String> header=csv.records().getFirst().stream().map(value->value.trim().toLowerCase(Locale.ROOT)).toList();
        if(csv.records().size()==1)return Validation.invalid(0,new ImportError(1,"File has no data rows"));
        Set<String> required=type.equals("CUSTOMERS")?CUSTOMER_HEADERS:type.equals("ITEMS")?ITEM_HEADERS:SUPPLIER_HEADERS;
        List<ImportError> errors=new ArrayList<>();
        if(new HashSet<>(header).size()!=header.size())errors.add(new ImportError(1,"Header contains duplicate column names"));
        for(String requiredHeader:required)if(!header.contains(requiredHeader))errors.add(new ImportError(1,"Missing required column: "+requiredHeader));
        if(!errors.isEmpty())return new Validation(csv.records().size()-1,List.of(),errors,previewRows(header,csv.records().stream().skip(1).limit(10).toList()));
        if(csv.records().size()-1>MAX_ROWS)return Validation.invalid(csv.records().size()-1,new ImportError(1,"Import is limited to 500 data rows"));
        Map<String,Integer> indexes=new HashMap<>();for(int i=0;i<header.size();i++)indexes.put(header.get(i),i);
        List<TenantCustomFieldService.ImportField> customDefinitions=customFields.importFields(tenant.currentTenantId(),resourceCode(type));
        List<ImportRow> validRows=new ArrayList<>();Set<String> seen=new HashSet<>();int total=csv.records().size()-1;
        for(int recordIndex=1;recordIndex<csv.records().size();recordIndex++){
            List<String> values=csv.records().get(recordIndex);int rowNumber=recordIndex+1;
            if(values.stream().allMatch(String::isBlank))continue;
            if(values.size()!=header.size()){errors.add(new ImportError(rowNumber,"Expected "+header.size()+" columns but found "+values.size()));continue;}
            Map<String,String> row=new HashMap<>();for(int i=0;i<header.size();i++)row.put(header.get(i),values.get(i).trim());
            String code=type.equals("ITEMS")?row.get("sku"):row.get("code");
            String normalized=code.toLowerCase(Locale.ROOT);
            if(!seen.add(normalized)){errors.add(new ImportError(rowNumber,"Duplicate code/SKU in this file: "+code));continue;}
            Map<String,String> customValues=new HashMap<>();for(var definition:customDefinitions)if(row.containsKey(definition.fieldKey()))customValues.put(definition.fieldKey(),row.get(definition.fieldKey()));
            Map<String,tools.jackson.databind.JsonNode> parsedCustomValues;
            try{parsedCustomValues=customFields.parseImportValues(customDefinitions,customValues);}
            catch(ResponseStatusException exception){errors.add(new ImportError(rowNumber,exception.getReason()==null?"Invalid custom field value":exception.getReason()));continue;}
            if(type.equals("CUSTOMERS"))validateCustomer(tenant.currentTenantId(),row,rowNumber,validRows,errors,parsedCustomValues);
            else if(type.equals("ITEMS"))validateItem(tenant.currentTenantId(),row,rowNumber,validRows,errors,parsedCustomValues);
            else validateSupplier(tenant.currentTenantId(),row,rowNumber,validRows,errors,parsedCustomValues);
        }
        return new Validation(total,validRows,errors,previewRows(header,csv.records().stream().skip(1).filter(row->row.stream().anyMatch(value->!value.isBlank())).limit(10).toList()));
    }

    private void validateCustomer(UUID tenantId,Map<String,String> row,int number,List<ImportRow> valid,List<ImportError> errors,Map<String,tools.jackson.databind.JsonNode> customValues){
        String code=row.get("code"),name=row.get("name"),email=row.get("email"),status=row.getOrDefault("status","");
        if(code.isBlank()||code.length()>64){errors.add(new ImportError(number,"Code is required and must be at most 64 characters"));return;}
        if(name.isBlank()||name.length()>180){errors.add(new ImportError(number,"Name is required and must be at most 180 characters"));return;}
        if(email.isBlank()||email.length()>254||!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")){errors.add(new ImportError(number,"Email is missing or invalid"));return;}
        if(status.length()>32){errors.add(new ImportError(number,"Status must be at most 32 characters"));return;}
        if(customers.existsByTenantIdAndCodeIgnoreCase(tenantId,code)){errors.add(new ImportError(number,"Customer code already exists: "+code));return;}
        String customerType=row.getOrDefault("customertype","COMPANY").isBlank()?"COMPANY":row.get("customertype").toUpperCase(Locale.ROOT);if(!Set.of("COMPANY","INDIVIDUAL").contains(customerType)){errors.add(new ImportError(number,"customerType must be COMPANY or INDIVIDUAL"));return;}String country=optional(row,"countrycode").toUpperCase(Locale.ROOT);if(!country.isEmpty()&&!country.matches("[A-Z]{2}")){errors.add(new ImportError(number,"countryCode must be a 2-letter code"));return;}try{int terms=optionalInt(row,"paymenttermsdays",0);BigDecimal credit=optionalDecimal(row,"creditlimit",BigDecimal.ZERO);if(terms<0||terms>365||credit.signum()<0||credit.scale()>2||credit.precision()>14)throw new IllegalArgumentException();valid.add(new CustomerRow(code,name,email,status.isBlank()?"Active":status,customerType,optional(row,"contactname"),optional(row,"phone"),optional(row,"addressline1"),optional(row,"addressline2"),optional(row,"city"),optional(row,"region"),optional(row,"postalcode"),country.isBlank()?null:country,optional(row,"taxid"),terms,credit,optional(row,"tags"),Boolean.parseBoolean(optional(row,"credithold")),customValues));}catch(RuntimeException ex){errors.add(new ImportError(number,"paymentTermsDays must be 0–365 and creditLimit a non-negative amount with up to 2 decimals"));}
    }

    private void validateItem(UUID tenantId,Map<String,String> row,int number,List<ImportRow> valid,List<ImportError> errors,Map<String,tools.jackson.databind.JsonNode> customValues){
        String sku=row.get("sku"),name=row.get("name"),category=row.get("category"),unit=row.get("unit");
        if(sku.isBlank()||sku.length()>64){errors.add(new ImportError(number,"SKU is required and must be at most 64 characters"));return;}
        if(name.isBlank()||name.length()>180){errors.add(new ImportError(number,"Name is required and must be at most 180 characters"));return;}
        if(category.isBlank()||category.length()>100){errors.add(new ImportError(number,"Category is required and must be at most 100 characters"));return;}
        if(unit.isBlank()||unit.length()>24){errors.add(new ImportError(number,"Unit is required and must be at most 24 characters"));return;}
        try{
            int stock=integer(row.get("openingstock"),"openingStock"),threshold=row.containsKey("lowstockthreshold")&&!row.get("lowstockthreshold").isBlank()?integer(row.get("lowstockthreshold"),"lowStockThreshold"):10;
            BigDecimal price=new BigDecimal(row.get("unitprice"));
            if(stock<0||threshold<0||price.signum()<0||price.scale()>2||price.precision()>14)throw new IllegalArgumentException();
            String itemType=optional(row,"itemtype").isBlank()?"FINISHED":optional(row,"itemtype").toUpperCase(Locale.ROOT);if(!Set.of("RAW","WIP","FINISHED","SERVICE").contains(itemType))throw new IllegalArgumentException("itemType");
            if(items.existsByTenantIdAndSkuIgnoreCase(tenantId,sku)){errors.add(new ImportError(number,"SKU already exists: "+sku));return;}
            valid.add(new ItemRow(sku,name,category,stock,unit,price,threshold,itemType,customValues));
        }catch(RuntimeException exception){errors.add(new ImportError(number,"openingStock and lowStockThreshold must be non-negative integers; unitPrice must be a non-negative amount with up to 2 decimals"));}
    }

    private void validateSupplier(UUID tenantId,Map<String,String> row,int number,List<ImportRow> valid,List<ImportError> errors,Map<String,tools.jackson.databind.JsonNode> customValues){
        String code=row.get("code"),name=row.get("name"),email=row.get("email");
        if(code.isBlank()||code.length()>64){errors.add(new ImportError(number,"Supplier code is required and must be at most 64 characters"));return;}
        if(name.isBlank()||name.length()>180){errors.add(new ImportError(number,"Supplier name is required and must be at most 180 characters"));return;}
        if(email.isBlank()||email.length()>254||!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")){errors.add(new ImportError(number,"Supplier email is missing or invalid"));return;}
        if(suppliers.existsByTenantIdAndCodeIgnoreCase(tenantId,code)){errors.add(new ImportError(number,"Supplier code already exists: "+code));return;}
        String country=optional(row,"countrycode").toUpperCase(Locale.ROOT);if(!country.isEmpty()&&!country.matches("[A-Z]{2}")){errors.add(new ImportError(number,"countryCode must be a 2-letter code"));return;}try{int terms=optionalInt(row,"paymenttermsdays",0),leadTime=optionalInt(row,"leadtimedays",0);BigDecimal rating=optional(row,"rating").isBlank()?null:new BigDecimal(optional(row,"rating"));if(terms<0||terms>365||leadTime<0||leadTime>3650||(rating!=null&&(rating.signum()<0||rating.compareTo(BigDecimal.valueOf(5))>0||rating.scale()>1)))throw new IllegalArgumentException();valid.add(new SupplierRow(code,name,email,optional(row,"contactname"),optional(row,"phone"),optional(row,"addressline1"),optional(row,"addressline2"),optional(row,"city"),optional(row,"region"),optional(row,"postalcode"),country.isBlank()?null:country,optional(row,"taxid"),terms,leadTime,rating,optional(row,"notes"),customValues));}catch(RuntimeException ex){errors.add(new ImportError(number,"Supplier payment terms, lead time, or rating is invalid"));}
    }

    private static String optional(Map<String,String> row,String key){return row.getOrDefault(key,"").trim();}
    private static int optionalInt(Map<String,String> row,String key,int fallback){String value=optional(row,key);return value.isEmpty()?fallback:Integer.parseInt(value);}
    private static BigDecimal optionalDecimal(Map<String,String> row,String key,BigDecimal fallback){String value=optional(row,key);return value.isEmpty()?fallback:new BigDecimal(value);}
    private static int integer(String value,String field){try{return Integer.parseInt(value);}catch(RuntimeException exception){throw new IllegalArgumentException(field);}}
    private static List<Map<String,String>> previewRows(List<String> headers,List<List<String>> records){return records.stream().filter(row->row.stream().anyMatch(value->!value.isBlank())).map(values->{Map<String,String> result=new LinkedHashMap<>();for(int i=0;i<Math.min(headers.size(),values.size());i++)result.put(headers.get(i),values.get(i));return result;}).toList();}
    private static String normalizeResource(String resource){String type=resource==null?"":resource.trim().toUpperCase(Locale.ROOT);if(!Set.of("CUSTOMERS","ITEMS","SUPPLIERS").contains(type))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Imports support CUSTOMERS, ITEMS, and SUPPLIERS");return type;}
    private static String normalizeExportResource(String resource){String type=resource==null?"":resource.trim().toUpperCase(Locale.ROOT);if(!Set.of("CUSTOMERS","ITEMS","SUPPLIERS","WORK_ORDERS","PURCHASE_ORDERS","QUOTES","SALES_ORDERS","INVOICES").contains(type))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a supported export resource");return type;}
    private static String resourceCode(String type){return switch(type){case "CUSTOMERS"->"customers";case "ITEMS"->"items";case "SUPPLIERS"->"suppliers";case "WORK_ORDERS"->"work_orders";case "PURCHASE_ORDERS"->"purchase_orders";case "QUOTES"->"quotes";case "SALES_ORDERS"->"sales_orders";case "INVOICES"->"invoices";default->throw new IllegalArgumentException("Unsupported import/export resource");};}
    private ResponseStatusException exportLimit(){return new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Export is limited to 10,000 records; narrow the export and try again");}
    private static String sha256(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception exception){throw new IllegalStateException(exception);}}

    private static CsvRecords parse(String content){
        List<List<String>> records=new ArrayList<>();List<String> record=new ArrayList<>();StringBuilder field=new StringBuilder();boolean quoted=false,afterQuote=false;
        for(int i=0;i<content.length();i++){
            char ch=content.charAt(i);
            if(quoted){if(ch=='"'){if(i+1<content.length()&&content.charAt(i+1)=='"'){field.append('"');i++;}else{quoted=false;afterQuote=true;}}else field.append(ch);continue;}
            if(afterQuote&&ch!=' '&&ch!='\t'&&ch!=','&&ch!='\r'&&ch!='\n')return new CsvRecords(List.of(),new ImportError(records.size()+1,"Unexpected character after closing quote"));
            if(ch=='"'){if(field.length()!=0)return new CsvRecords(List.of(),new ImportError(records.size()+1,"Unexpected quote in an unquoted field"));quoted=true;afterQuote=false;}
            else if(ch==','){record.add(field.toString());field.setLength(0);afterQuote=false;}
            else if(ch=='\n'||ch=='\r'){
                if(ch=='\r'&&i+1<content.length()&&content.charAt(i+1)=='\n')i++;
                record.add(field.toString());field.setLength(0);afterQuote=false;
                if(record.stream().anyMatch(value->!value.isBlank()))records.add(List.copyOf(record));record.clear();
            }else if(afterQuote){/* whitespace after a quoted value is ignored */}else field.append(ch);
        }
        if(quoted)return new CsvRecords(List.of(),new ImportError(records.size()+1,"CSV contains an unclosed quoted field"));
        if(field.length()>0||!record.isEmpty()){record.add(field.toString());if(record.stream().anyMatch(value->!value.isBlank()))records.add(List.copyOf(record));}
        return new CsvRecords(records,null);
    }

    private sealed interface ImportRow permits CustomerRow,ItemRow,SupplierRow{}
    private record CustomerRow(String code,String name,String email,String status,String customerType,String contactName,String phone,String addressLine1,String addressLine2,String city,String region,String postalCode,String countryCode,String taxId,int paymentTermsDays,BigDecimal creditLimit,String tags,boolean creditHold,Map<String,tools.jackson.databind.JsonNode> customValues)implements ImportRow{}
    private record ItemRow(String sku,String name,String category,int openingStock,String unit,BigDecimal unitPrice,int lowStockThreshold,String itemType,Map<String,tools.jackson.databind.JsonNode> customValues)implements ImportRow{}
    private record SupplierRow(String code,String name,String email,String contactName,String phone,String addressLine1,String addressLine2,String city,String region,String postalCode,String countryCode,String taxId,int paymentTermsDays,int leadTimeDays,BigDecimal rating,String notes,Map<String,tools.jackson.databind.JsonNode> customValues)implements ImportRow{}
    private record CsvRecords(List<List<String>> records,ImportError error){}
    private record Validation(int totalRows,List<ImportRow> rows,List<ImportError> errors,List<Map<String,String>> sampleRows){
        static Validation invalid(int rows,ImportError error){return new Validation(rows,List.of(),List.of(error),List.of());}
        Validation withError(ImportError error){List<ImportError> updated=new ArrayList<>(errors);updated.add(error);return new Validation(totalRows,rows,updated,sampleRows);}
        PreviewResult preview(){return new PreviewResult(totalRows,rows.size(),errors,sampleRows);}
    }
    public record ImportError(int row,String message){}
    public record PreviewResult(int totalRows,int validRows,List<ImportError> errors,List<Map<String,String>> sampleRows){}
    public record BatchView(UUID id,String resourceType,String contentSha256,int rowsImported,java.time.Instant createdAt){}
    @Transactional(readOnly=true)
    public List<BatchView> listBatches(UUID tenantId){
        return batches.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .map(b->new BatchView(b.getId(),b.getResourceType(),b.getContentSha256(),b.getRowsImported(),b.getCreatedAt())).toList();
    }
    public record CommitResult(boolean imported,boolean replayed,String resourceType,int rowsImported,UUID batchId,java.time.Instant createdAt,List<ImportError> errors){
        static CommitResult created(ImportBatchEntity batch){return new CommitResult(true,false,batch.getResourceType(),batch.getRowsImported(),batch.getId(),batch.getCreatedAt(),List.of());}
        static CommitResult replayed(ImportBatchEntity batch){return new CommitResult(true,true,batch.getResourceType(),batch.getRowsImported(),batch.getId(),batch.getCreatedAt(),List.of());}
        static CommitResult rejected(Validation result){return new CommitResult(false,false,"",0,null,null,result.errors());}
    }
}
