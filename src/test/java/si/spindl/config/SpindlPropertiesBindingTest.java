package si.spindl.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class SpindlPropertiesBindingTest {

    @Test
    void keepsThePreviousValueDefaultsWhenKeysAreAbsent() {
        SpindlProperties properties = new SpindlProperties();
        assertEquals("http://localhost:5173", properties.getFrontendUrl());
        assertEquals("noreply@spindl.local", properties.getMail().getFrom());
        assertEquals("./var/spindl-attachments", properties.getAttachments().getStoragePath());
        assertEquals(10_485_760L, properties.getAttachments().getMaxFileSizeBytes());
        assertFalse(properties.getAttachments().isClamavEnabled());
        assertEquals(3310, properties.getAttachments().getClamavPort());
        assertEquals(5000, properties.getAttachments().getClamavTimeoutMillis());
        assertEquals("", properties.getPlatformBillingEmails());
        assertEquals("INR", properties.getDefaultCurrency());
    }

    @Test
    void bindsYamlStyleKeysAndFallsBackToTheJwtSecretOnlyWhenEncryptionKeyIsAbsent() {
        var source = new MapConfigurationPropertySource(Map.of(
                "spindl.security.jwt-secret", "local-development-secret-change-before-deploying-2026",
                "spindl.attachments.clamav-enabled", "true",
                "spindl.platform-billing-emails", "billing@example.com"
        ));
        SpindlProperties properties = new Binder(source).bind("spindl", Bindable.of(SpindlProperties.class)).get();

        assertEquals("local-development-secret-change-before-deploying-2026", properties.getSecurity().getJwtSecret());
        assertEquals("local-development-secret-change-before-deploying-2026", properties.encryptionKey());
        assertEquals(true, properties.getAttachments().isClamavEnabled());
        assertEquals("billing@example.com", properties.getPlatformBillingEmails());
        assertEquals("http://localhost:5173", properties.getFrontendUrl());
    }

    @Test
    void usesAnExplicitEncryptionKeyWhenOneIsConfigured() {
        var source = new MapConfigurationPropertySource(Map.of(
                "spindl.security.jwt-secret", "local-development-secret-change-before-deploying-2026",
                "spindl.security.encryption-key", "another-secret-value-that-is-not-the-jwt-secret"
        ));
        SpindlProperties properties = new Binder(source).bind("spindl", Bindable.of(SpindlProperties.class)).get();
        assertEquals("another-secret-value-that-is-not-the-jwt-secret", properties.encryptionKey());
    }
}
