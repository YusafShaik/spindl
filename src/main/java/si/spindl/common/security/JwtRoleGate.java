package si.spindl.common.security;

import org.springframework.security.oauth2.jwt.Jwt;
import si.spindl.common.exception.ForbiddenException;

import java.util.List;
import java.util.Set;

/** Role check shared by controllers that gate configuration on JWT role claims. */
public final class JwtRoleGate {

    private JwtRoleGate() {
    }

    public static boolean hasAny(Jwt jwt, String... allowed) {
        List<String> roles = jwt.getClaimAsStringList("roles");
        if (roles == null) {
            return false;
        }
        Set<String> allowedRoles = Set.of(allowed);
        return roles.stream().anyMatch(allowedRoles::contains);
    }

    public static void requireAny(Jwt jwt, String denialMessage, String... allowed) {
        if (!hasAny(jwt, allowed)) {
            throw new ForbiddenException(denialMessage);
        }
    }
}
