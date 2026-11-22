package si.spindl.identity;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import si.spindl.common.exception.InfrastructureException;
import si.spindl.config.SpindlProperties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SmtpResetEmailSenderTest {

    @Test
    void missingMailSenderIsAServerFailure() {
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> mail = mock(ObjectProvider.class);
        when(mail.getIfAvailable()).thenReturn(null);
        SmtpResetEmailSender sender = new SmtpResetEmailSender(mail, new SpindlProperties());

        InfrastructureException ex = assertThrows(InfrastructureException.class,
                () -> sender.sendPasswordReset("person@example.com", "https://example.test/reset"));

        assertEquals(500, ex.getStatusCode().value());
        assertEquals("SMTP is not configured", ex.getReason());
    }
}
