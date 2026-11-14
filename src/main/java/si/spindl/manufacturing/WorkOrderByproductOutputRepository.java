package si.spindl.manufacturing;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface WorkOrderByproductOutputRepository extends JpaRepository<WorkOrderByproductOutputEntity,UUID> {}
