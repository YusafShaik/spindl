package si.spindl.identity;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;
import si.spindl.config.SpindlProperties;

@Service
public class LoginThrottleService {
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int EMAIL_FAILURE_LIMIT = 5;
    private static final int IP_FAILURE_LIMIT = 20;
    private final AuthLoginLimitRepository limits;
    private final byte[] bucketSecret;
    private final AtomicInteger cleanupCounter = new AtomicInteger();

    public LoginThrottleService(AuthLoginLimitRepository limits, SpindlProperties properties) {
        this.limits = limits;
        this.bucketSecret = properties.getSecurity().getJwtSecret().getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public boolean isBlocked(String email, String remoteAddress) {
        Instant now = Instant.now();
        Instant windowStart = now.minus(WINDOW);
        return limits.isBlocked(emailKey(email), now, windowStart, EMAIL_FAILURE_LIMIT)
                || limits.isBlocked(ipKey(remoteAddress), now, windowStart, IP_FAILURE_LIMIT);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(String email, String remoteAddress) {
        Instant now = Instant.now();
        Instant windowStart = now.minus(WINDOW);
        Instant blockedUntil = now.plus(WINDOW);
        limits.recordFailure(emailKey(email), now, windowStart, blockedUntil, EMAIL_FAILURE_LIMIT);
        limits.recordFailure(ipKey(remoteAddress), now, windowStart, blockedUntil, IP_FAILURE_LIMIT);
        if (cleanupCounter.incrementAndGet() % 100 == 0) limits.deleteOlderThan(now.minus(Duration.ofDays(2)));
    }

    @Transactional
    public void recordSuccess(String email) {
        limits.clearEmail(emailKey(email));
    }

    private String emailKey(String email) { return "email:" + digest(email == null ? "" : email.trim().toLowerCase(Locale.ROOT)); }
    private String ipKey(String ip) { return "ip:" + digest(ip == null ? "unknown" : ip.trim()); }

    public String loginSourceHash(String remoteAddress) { return digest(remoteAddress == null ? "unknown" : remoteAddress.trim()); }

    private String digest(String value) {
        try {
            Mac mac=Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(bucketSecret,"HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA-256 is unavailable", e);
        }
    }
}
