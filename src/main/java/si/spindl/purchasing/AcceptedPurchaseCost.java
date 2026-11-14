package si.spindl.purchasing;

import java.math.BigDecimal;
import java.util.UUID;

public interface AcceptedPurchaseCost {
    UUID getItemId();
    BigDecimal getTotalValue();
    Long getTotalUnits();
}
