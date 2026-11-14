package si.spindl.identity;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "spindl.mail.enabled", havingValue = "true")
public class SmtpResetEmailSender implements ResetEmailSender {
    private final ObjectProvider<JavaMailSender> mailSender;
    private final String from;
    public SmtpResetEmailSender(ObjectProvider<JavaMailSender> mailSender, @Value("${spindl.mail.from:noreply@spindl.local}") String from) { this.mailSender = mailSender; this.from = from; }
    @Override public void sendPasswordReset(String email, String resetLink) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) throw new IllegalStateException("SMTP is not configured");
        var message = new SimpleMailMessage(); message.setFrom(from); message.setTo(email);
        message.setSubject("Reset your Spindl password");
        message.setText("Use this one-time link within 30 minutes to reset your Spindl password:\n\n" + resetLink + "\n\nIf you did not request this, you can ignore this email.");
        sender.send(message);
    }
}
