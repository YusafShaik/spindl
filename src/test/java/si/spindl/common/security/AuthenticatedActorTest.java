package si.spindl.common.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthenticatedActorTest {

    @Test
    void readsTheSubject() {
        UUID id = UUID.randomUUID();
        Jwt jwt = jwt(id.toString());
        assertEquals(id, AuthenticatedActor.userId(jwt));
        assertEquals(id, AuthenticatedActor.optionalUserId(jwt));
    }

    @Test
    void optionalUserIdMatchesTheLenientControllerBehaviour() {
        Jwt missingSubject = mock(Jwt.class);
        when(missingSubject.getSubject()).thenReturn(null);
        assertNull(AuthenticatedActor.optionalUserId(null));
        assertNull(AuthenticatedActor.optionalUserId(missingSubject));
        assertNull(AuthenticatedActor.optionalUserId(jwt("not-a-uuid")));
        assertThrows(IllegalArgumentException.class, () -> AuthenticatedActor.userId(jwt("not-a-uuid")));
    }

    @Test
    void roleGateMatchesClaimMembership() {
        Jwt manager = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(UUID.randomUUID().toString())
                .claim("roles", java.util.List.of("MANAGER"))
                .build();
        assertEquals(true, JwtRoleGate.hasAny(manager, "OWNER", "ADMIN", "MANAGER"));
        assertEquals(false, JwtRoleGate.hasAny(manager, "OWNER", "ADMIN"));
    }

    private static Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "none").subject(subject).build();
    }
}
