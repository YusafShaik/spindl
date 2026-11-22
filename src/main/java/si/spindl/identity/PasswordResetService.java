package si.spindl.identity;

import si.spindl.common.exception.BadRequestException;
import org.springframework.beans.factory.ObjectProvider;
import si.spindl.config.SpindlProperties;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

@Service
public class PasswordResetService {
    private final AppUserRepository users;
    private final PasswordResetTokenRepository resetTokens;
    private final AuthSessionRepository sessions;
    private final PasswordEncoder passwordEncoder;
    private final ObjectProvider<ResetEmailSender> emailSender;
    private final String frontendUrl;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(AppUserRepository users, PasswordResetTokenRepository resetTokens, AuthSessionRepository sessions,
                                PasswordEncoder passwordEncoder, ObjectProvider<ResetEmailSender> emailSender,
                                SpindlProperties properties) {
        this.users = users; this.resetTokens = resetTokens; this.sessions = sessions; this.passwordEncoder = passwordEncoder;
        this.emailSender = emailSender; this.frontendUrl = properties.getFrontendUrl();
    }

    @Transactional
    public void request(String suppliedEmail) {
        var user = users.findByEmail(suppliedEmail.trim().toLowerCase(Locale.ROOT)).filter(AppUserEntity::isActive).orElse(null);
        ResetEmailSender sender = emailSender.getIfAvailable();
        if (user == null || sender == null) return;
        resetTokens.deleteAllByUserIdAndConsumedAtIsNull(user.getId());
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        var reset = resetTokens.save(new PasswordResetTokenEntity(UUID.randomUUID(), user.getId(), sha256(token), Instant.now().plus(30, ChronoUnit.MINUTES)));
        String link = frontendUrl.replaceAll("/$", "") + "/?reset=" + token;
        sender.sendPasswordReset(user.getEmail(), link);
    }

    @Transactional
    public void complete(String rawToken, String newPassword) {
        var reset = resetTokens.findByTokenHashForUpdate(sha256(rawToken)).orElse(null);
        if (reset == null || !reset.isUsable()) throw new BadRequestException("Reset link is invalid or expired");
        var user = users.findById(reset.getUserId()).filter(AppUserEntity::isActive)
                .orElseThrow(() -> new BadRequestException("Reset link is invalid or expired"));
        user.changePassword(passwordEncoder.encode(newPassword));
        reset.consume();
        sessions.findAllByUserIdAndRevokedAtIsNull(user.getId()).forEach(AuthSessionEntity::revoke);
    }

    private String sha256(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException("SHA-256 is unavailable", e); }
    }
}
