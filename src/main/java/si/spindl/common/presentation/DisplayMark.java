package si.spindl.common.presentation;

/** Two-letter directory mark derived from a display name. */
public final class DisplayMark {

    private DisplayMark() {
    }

    public static String fromName(String name) {
        String cleaned = name.replaceAll("[^A-Za-z0-9 ]", "").trim();
        String[] words = cleaned.isEmpty() ? new String[]{"?"} : cleaned.split("\\s+");
        if (words.length > 1) {
            return ("" + words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
        }
        return words[0].substring(0, Math.min(2, words[0].length())).toUpperCase();
    }
}
