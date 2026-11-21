package si.spindl.common.text;

/** Profile-field update rule: null keeps the previous value, blank clears it. */
public final class TextValues {

    private TextValues() {
    }

    public static String keepOrTrim(String incoming, String previous) {
        return incoming == null ? previous : incoming.isBlank() ? null : incoming.trim();
    }
}
