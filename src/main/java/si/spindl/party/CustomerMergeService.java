package si.spindl.party;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.attachments.TenantAttachmentRepository;
import si.spindl.crm.LeadRepository;
import si.spindl.finance.InvoiceRepository;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;
import si.spindl.identity.TenantCustomFieldValueRepository;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.sales.SalesOrderRepository;
import si.spindl.sales.SalesQuoteRepository;
import si.spindl.tenant.DevelopmentTenant;
import java.util.*;

@Service
public class CustomerMergeService {
    private final CustomerRepository customers; private final TenantMembershipRepository memberships; private final SalesQuoteRepository quotes; private final SalesOrderRepository orders; private final InvoiceRepository invoices; private final LeadRepository leads; private final TenantCustomFieldValueRepository customValues; private final TenantAttachmentRepository attachments; private final TenantAuditEventRepository audit; private final DevelopmentTenant tenant;
    public CustomerMergeService(CustomerRepository customers,TenantMembershipRepository memberships,SalesQuoteRepository quotes,SalesOrderRepository orders,InvoiceRepository invoices,LeadRepository leads,TenantCustomFieldValueRepository customValues,TenantAttachmentRepository attachments,TenantAuditEventRepository audit,DevelopmentTenant tenant){this.customers=customers;this.memberships=memberships;this.quotes=quotes;this.orders=orders;this.invoices=invoices;this.leads=leads;this.customValues=customValues;this.attachments=attachments;this.audit=audit;this.tenant=tenant;}

    @Transactional
    public MergeResult merge(UUID actorId,UUID sourceId,UUID targetId){
        UUID tenantId=tenant.currentTenantId();String role=memberships.findActiveRole(tenantId,actorId).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"Workspace membership is inactive"));
        if(!Set.of("OWNER","ADMIN").contains(role))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only workspace owners and admins can merge customers");
        if(sourceId.equals(targetId))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose two different customer records");
        List<UUID> lockOrder=List.of(sourceId,targetId).stream().sorted().toList();Map<UUID,CustomerEntity> locked=new HashMap<>();for(UUID id:lockOrder)locked.put(id,customers.findForUpdate(tenantId,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Customer not found")));
        CustomerEntity source=locked.get(sourceId),target=locked.get(targetId);
        if(!source.isActive()||source.getMergedIntoCustomerId()!=null)throw new ResponseStatusException(HttpStatus.CONFLICT,"This customer has already been archived or merged");
        if(!target.isActive()||target.getMergedIntoCustomerId()!=null)throw new ResponseStatusException(HttpStatus.CONFLICT,"Choose an active customer as the destination");
        int quoteCount=quotes.reassignCustomer(tenantId,sourceId,target),orderCount=orders.reassignCustomer(tenantId,sourceId,target),invoiceCount=invoices.reassignCustomer(tenantId,sourceId,target),leadCount=leads.reassignConvertedCustomer(tenantId,sourceId,targetId);
        customValues.deleteConflictingCustomerValues(tenantId,sourceId,targetId);int customFieldCount=customValues.moveCustomerValues(tenantId,sourceId,targetId,actorId);int attachmentCount=attachments.moveCustomerAttachments(tenantId,sourceId,targetId);
        source.mergeInto(targetId);audit.save(new TenantAuditEventEntity(tenantId,actorId,"CUSTOMER_MERGED","customer",sourceId,Map.of("mergedIntoCustomerId",targetId.toString(),"quotesMoved",quoteCount,"ordersMoved",orderCount,"invoicesMoved",invoiceCount,"leadsReassigned",leadCount,"customFieldsMoved",customFieldCount,"attachmentsMoved",attachmentCount)));
        return new MergeResult(sourceId,targetId,quoteCount,orderCount,invoiceCount,leadCount,customFieldCount,attachmentCount);
    }
    public record MergeResult(UUID archivedCustomerId,UUID survivingCustomerId,int quotesMoved,int ordersMoved,int invoicesMoved,int leadsReassigned,int customFieldsMoved,int attachmentsMoved){}
}
