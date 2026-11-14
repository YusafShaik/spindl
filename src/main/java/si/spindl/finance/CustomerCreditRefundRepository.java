package si.spindl.finance;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;

public interface CustomerCreditRefundRepository extends JpaRepository<CustomerCreditRefundEntity,UUID> {
    @Query("select r from CustomerCreditRefundEntity r where r.tenantId=:tenantId and r.creditNote.id=:noteId and r.idempotencyKey=:key")
    Optional<CustomerCreditRefundEntity> findByTenantIdAndNoteAndIdempotencyKey(@Param("tenantId")UUID tenantId,@Param("noteId")UUID noteId,@Param("key")String key);
}
