package si.spindl.common.security;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/** Reads the authenticated user id from a server-issued JWT without changing failure modes. */
public final class AuthenticatedActor {

    private AuthenticatedActor() {
    }

    public static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    /**
     * Same null and parse behaviour as the workforce and ledger controllers:
     * a missing token or an unparseable subject becomes a null actor.
     */
    public static UUID optionalUserId(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null) {
            return null;
        }
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (Exception ignored) {
            return null;
        }
    }
}
