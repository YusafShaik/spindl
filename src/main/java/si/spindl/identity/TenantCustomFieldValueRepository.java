package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface TenantCustomFieldValueRepository extends JpaRepository<TenantCustomFieldValueEntity,UUID> {
    List<TenantCustomFieldValueEntity> findAllByTenantIdAndResourceCodeAndRecordId(UUID tenantId,String resourceCode,UUID recordId);
    List<TenantCustomFieldValueEntity> findAllByTenantIdAndResourceCodeAndRecordIdIn(UUID tenantId,String resourceCode,List<UUID> recordIds);
    @Modifying
    @Query("delete from TenantCustomFieldValueEntity v where v.tenantId=:tenantId and v.resourceCode=:resource and v.recordId=:recordId")
    int deleteRecordValues(@Param("tenantId") UUID tenantId,@Param("resource") String resource,@Param("recordId") UUID recordId);
    @Modifying
    @Query(value="delete from tenant_custom_field_values source where source.tenant_id=:tenantId and source.resource_code='customers' and source.record_id=:sourceId and exists (select 1 from tenant_custom_field_values target where target.tenant_id=source.tenant_id and target.resource_code=source.resource_code and target.record_id=:targetId and target.field_id=source.field_id)",nativeQuery=true)
    int deleteConflictingCustomerValues(@Param("tenantId") UUID tenantId,@Param("sourceId") UUID sourceId,@Param("targetId") UUID targetId);
    @Modifying
    @Query(value="update tenant_custom_field_values set record_id=:targetId,updated_by=:actorId,updated_at=now() where tenant_id=:tenantId and resource_code='customers' and record_id=:sourceId",nativeQuery=true)
    int moveCustomerValues(@Param("tenantId") UUID tenantId,@Param("sourceId") UUID sourceId,@Param("targetId") UUID targetId,@Param("actorId") UUID actorId);
}
