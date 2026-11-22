package si.spindl.common.presentation;

import java.math.BigDecimal;
import java.util.Currency;
import java.util.Locale;

/** Directory amount string: currency symbol, a space, then the plain amount. */
public final class MoneyFormat {

    private MoneyFormat() {
    }

    public static String inr(BigDecimal amount) {
        return format(amount, "INR");
    }

    public static String format(BigDecimal amount, String currencyCode) {
        String code = currencyCode == null || currencyCode.isBlank() ? "INR" : currencyCode.trim().toUpperCase(Locale.ROOT);
        return symbol(code) + " " + amount.stripTrailingZeros().toPlainString();
    }

    private static String symbol(String code) {
        if ("INR".equals(code)) {
            return "₹";
        }
        try {
            Currency currency = Currency.getInstance(code);
            String localized = currency.getSymbol(Locale.US);
            return code.equals(localized) ? code : localized;
        } catch (IllegalArgumentException invalid) {
            return code;
        }
    }
}
