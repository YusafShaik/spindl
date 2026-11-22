package si.spindl.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed view of the {@code spindl.*} settings already declared in application.yaml.
 * Defaults match the previous {@code @Value} fallbacks.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "spindl")
public class SpindlProperties {

    private String platformBillingEmails = "";
    private String platformSupportEmails = "";
    /** Matches {@code ${spindl.frontend-url:http://localhost:5173}}. */
    private String frontendUrl = "http://localhost:5173";
    /** Used when a workspace has no currency code. */
    private String defaultCurrency = "INR";
    private Security security = new Security();
    private Mail mail = new Mail();
    private Attachments attachments = new Attachments();

    /**
     * Same fallback as {@code spindl.security.encryption-key:${spindl.security.jwt-secret}}
     * when the encryption key property is absent.
     */
    public String encryptionKey() {
        if (security.getEncryptionKey() != null) {
            return security.getEncryptionKey();
        }
        return security.getJwtSecret();
    }

    @Getter
    @Setter
    public static class Security {
        private String jwtSecret;
        private String encryptionKey;
    }

    @Getter
    @Setter
    public static class Mail {
        private String from = "noreply@spindl.local";
    }

    @Getter
    @Setter
    public static class Attachments {
        private String storagePath = "./var/spindl-attachments";
        private long maxFileSizeBytes = 10_485_760L;
        private boolean clamavEnabled = false;
        private String clamavHost = "";
        private int clamavPort = 3310;
        private int clamavTimeoutMillis = 5000;
    }
}
