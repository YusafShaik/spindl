package si.spindl.attachments;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.ForbiddenException;
import si.spindl.common.exception.InternalServerException;
import si.spindl.common.exception.NotFoundException;
import si.spindl.common.exception.UnsupportedMediaTypeException;
import jakarta.persistence.EntityManager;
import org.springframework.core.io.FileSystemResource;
import si.spindl.config.SpindlProperties;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.identity.SubscriptionPlanRepository;
import si.spindl.identity.TenantSubscriptionRepository;
import si.spindl.identity.TenantAuditEventEntity;
import si.spindl.identity.TenantAuditEventRepository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import si.spindl.attachments.TenantAttachmentDtos.AttachmentView;
import si.spindl.attachments.TenantAttachmentDtos.Download;

@Service
public class TenantAttachmentService {
    private static final Map<String,String> PARENTS = Map.of(
            "customers", "customers", "items", "items", "suppliers", "suppliers", "purchase_orders", "purchase_orders",
            "quotes", "sales_quotes", "sales_orders", "sales_orders", "invoices", "invoices", "work_orders", "work_orders", "leads", "crm_leads");
    private static final Set<String> TYPES = Set.of("application/pdf", "image/png", "image/jpeg", "text/plain");
    private final TenantAttachmentRepository attachments;
    private final TenantStorageUsageRepository usage;
    private final TenantSubscriptionRepository subscriptions;
    private final SubscriptionPlanRepository plans;
    private final TenantAuditEventRepository audit;
    private final EntityManager entityManager;
    private final MalwareScanner scanner;
    private final String storagePath;
    private final long maxFileSize;

    public TenantAttachmentService(TenantAttachmentRepository attachments, TenantStorageUsageRepository usage,
                                   TenantSubscriptionRepository subscriptions, SubscriptionPlanRepository plans,
                                   TenantAuditEventRepository audit, EntityManager entityManager, MalwareScanner scanner,
                                   SpindlProperties properties) {
        this.attachments=attachments; this.usage=usage; this.subscriptions=subscriptions; this.plans=plans;
        this.audit=audit; this.entityManager=entityManager; this.scanner=scanner;
        this.storagePath = properties.getAttachments().getStoragePath();
        this.maxFileSize = properties.getAttachments().getMaxFileSizeBytes();
    }

    @Transactional(readOnly=true)
    public List<AttachmentView> list(UUID tenantId,String resource,UUID recordId) {
        requireParent(tenantId,resource,recordId);
        return attachments.findAllByTenantIdAndResourceCodeAndRecordIdOrderByUploadedAtDesc(tenantId,resource,recordId).stream().map(TenantAttachmentMapper::toAttachmentView).toList();
    }

    @Transactional
    public AttachmentView upload(UUID tenantId,UUID userId,String resource,UUID recordId,String key,MultipartFile file) {
        requireParent(tenantId,resource,recordId);
        if(key==null||key.isBlank()||key.length()>120) throw new BadRequestException("A valid Idempotency-Key header is required");
        if(file==null||file.isEmpty()||file.getSize()>maxFileSize) throw new BadRequestException("Choose a non-empty file up to "+(maxFileSize/1024/1024)+" MB");
        String filename=safeFilename(file.getOriginalFilename());
        String mediaType=mediaType(file,filename);
        Path root=Path.of(storagePath).toAbsolutePath().normalize(); Path temp=null, destination=null;
        try {
            Files.createDirectories(root); temp=Files.createTempFile(root,"scan-",".tmp");
            try(var in=file.getInputStream()){Files.copy(in,temp,StandardCopyOption.REPLACE_EXISTING);}
            long size=Files.size(temp); if(size<=0||size>maxFileSize)throw new BadRequestException("File exceeds the configured upload size");
            try(var in=Files.newInputStream(temp)){scanner.scan(in);}
            String hash=sha256(temp);
            var prior=attachments.findByTenantIdAndIdempotencyKey(tenantId,key).orElse(null);
            if(prior!=null){if(!prior.getSha256().equals(hash)||!prior.getResourceCode().equals(resource)||!prior.getRecordId().equals(recordId))throw new ConflictException("Idempotency-Key was already used for a different file");return TenantAttachmentMapper.toAttachmentView(prior);}
            usage.ensureRow(tenantId); var meter=usage.findForUpdate(tenantId).orElseThrow();
            var subscription=subscriptions.findByTenantId(tenantId).orElseThrow(()->new ConflictException("Workspace plan is unavailable"));
            var plan=plans.findByPlanCodeAndVersionAndActiveTrue(subscription.getPlanCode(),subscription.getPlanVersion()).orElseThrow(()->new ConflictException("Workspace plan is unavailable"));
            long quota=Math.multiplyExact((long)plan.getStorageLimitMb(),1024L*1024L);
            if(size>quota-meter.getUsedBytes())throw new ConflictException("Workspace storage limit reached. Remove files or request a plan change.");
            UUID id=UUID.randomUUID(); String storageKey=tenantId+"/"+id; destination=root.resolve(tenantId.toString()).resolve(id.toString()).normalize();
            if(!destination.startsWith(root))throw new InternalServerException("Invalid storage path");
            Files.createDirectories(destination.getParent());
            try { Files.move(temp,destination,StandardCopyOption.ATOMIC_MOVE); }
            catch(java.nio.file.AtomicMoveNotSupportedException unsupported){ Files.move(temp,destination); }
            temp=null;
            Path finalFile=destination;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCompletion(int status){if(status!=STATUS_COMMITTED)try{Files.deleteIfExists(finalFile);}catch(IOException ignored){}}});
            TenantAttachmentEntity entity=new TenantAttachmentEntity(id,tenantId,resource,recordId,filename,mediaType,size,hash,storageKey,key,userId);
            attachments.save(entity); meter.addBytes(size);
            audit.save(new TenantAuditEventEntity(tenantId,userId,"ATTACHMENT_UPLOADED",resource,id,Map.of("recordId",recordId.toString(),"filename",filename,"sizeBytes",size)));
            return TenantAttachmentMapper.toAttachmentView(entity);
        } catch(ResponseStatusException e){throw e;} catch(Exception e){throw new InternalServerException("Could not store attachment", e);}
        finally{if(temp!=null)try{Files.deleteIfExists(temp);}catch(IOException ignored){}}
    }

    @Transactional(readOnly=true)
    public Download download(UUID tenantId,String resource,UUID recordId,UUID id) {
        requireParent(tenantId,resource,recordId);
        var item=attachments.findByTenantIdAndResourceCodeAndRecordIdAndId(tenantId,resource,recordId,id).orElseThrow(()->new NotFoundException("Attachment not found"));
        if(!"CLEAN".equals(item.getScanStatus()))throw new ForbiddenException("Attachment has not passed scanning");
        Path root=Path.of(storagePath).toAbsolutePath().normalize(); Path path=root.resolve(item.getStorageKey()).normalize();
        if(!path.startsWith(root)||!Files.isRegularFile(path))throw new NotFoundException("Attachment file not found");
        return new Download(new FileSystemResource(path),item.getOriginalFilename(),item.getMediaType(),item.getSizeBytes());
    }

    @Transactional
    public void delete(UUID tenantId,UUID userId,String resource,UUID recordId,UUID id) {
        requireParent(tenantId,resource,recordId);
        var item=attachments.findByTenantIdAndResourceCodeAndRecordIdAndId(tenantId,resource,recordId,id).orElseThrow(()->new NotFoundException("Attachment not found"));
        usage.ensureRow(tenantId); var meter=usage.findForUpdate(tenantId).orElseThrow();
        Path path=Path.of(storagePath).toAbsolutePath().normalize().resolve(item.getStorageKey()).normalize();
        attachments.delete(item); meter.removeBytes(item.getSizeBytes());
        audit.save(new TenantAuditEventEntity(tenantId,userId,"ATTACHMENT_DELETED",resource,id,Map.of("recordId",recordId.toString(),"filename",item.getOriginalFilename(),"sizeBytes",item.getSizeBytes())));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){try{Files.deleteIfExists(path);}catch(IOException ignored){}}});
    }

    private void requireParent(UUID tenantId,String resource,UUID recordId){String table=PARENTS.get(resource);if(table==null)throw new NotFoundException("Unsupported attachment record type");
        Boolean exists=(Boolean)entityManager.createNativeQuery("select exists(select 1 from public."+table+" where tenant_id=:tenantId and id=:recordId)").setParameter("tenantId",tenantId).setParameter("recordId",recordId).getSingleResult();
        if(!exists)throw new NotFoundException("Record not found in this workspace");}
    private String safeFilename(String value){String raw=(value==null?"attachment":value).replace('\\','/').replaceAll("[\\p{Cntrl}]","_");int slash=raw.lastIndexOf('/');String name=(slash>=0?raw.substring(slash+1):raw).replaceAll("[\\r\\n]","_").trim();if(name.isBlank())name="attachment";return name.length()>255?name.substring(name.length()-255):name;}
    private String mediaType(MultipartFile file,String filename){String type=file.getContentType()==null?"application/octet-stream":file.getContentType().split(";",2)[0].toLowerCase();if(!TYPES.contains(type))throw new UnsupportedMediaTypeException("Only PDF, PNG, JPEG, and plain text files are supported");
        try(var in=file.getInputStream()){byte[] b=in.readNBytes(8);boolean valid=switch(type){case "application/pdf"->b.length>=5&&b[0]=='%'&&b[1]=='P'&&b[2]=='D'&&b[3]=='F'&&b[4]=='-';case "image/png"->b.length>=8&&(b[0]&255)==137&&b[1]=='P'&&b[2]=='N'&&b[3]=='G';case "image/jpeg"->b.length>=3&&(b[0]&255)==255&&(b[1]&255)==216&&(b[2]&255)==255;case "text/plain"->true;default->false;};if(!valid)throw new UnsupportedMediaTypeException("File contents do not match the declared file type");}catch(IOException e){throw new BadRequestException("Could not read upload");}return type;}
    private String sha256(Path path)throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path)));}

    @Transactional
    public int moveCustomerAttachments(UUID tenantId, UUID sourceId, UUID targetId) {
        return attachments.moveCustomerAttachments(tenantId, sourceId, targetId);
    }
}
