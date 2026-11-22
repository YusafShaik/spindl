package si.spindl.common.presentation;

import java.math.BigDecimal;

/** Rupee display string used by directory responses. */
public final class MoneyFormat {

    private MoneyFormat() {
    }

    public static String inr(BigDecimal amount) {
        return "₹ " + amount.stripTrailingZeros().toPlainString();
    }
}
