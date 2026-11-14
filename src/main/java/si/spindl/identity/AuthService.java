package si.spindl.identity;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {
    private static final long TOKEN_TTL_SECONDS = 3600;
    private final AppUserRepository users;
    private final TenantRepository tenants;
    private final TenantMembershipRepository memberships;
    private final TenantAuditEventRepository auditEvents;
    private final TenantRolePermissionRepository rolePermissions;
    private final TenantModuleEntitlementService moduleEntitlements;
    private final AuthSessionRepository sessions;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final LoginThrottleService loginThrottle;
    private final String dummyPasswordHash;
    private final SubscriptionQuotaService subscriptionQuotas;
    private final TenantRoleService tenantRoles;

    public AuthService(AppUserRepository users, TenantRepository tenants, TenantMembershipRepository memberships,
                       TenantAuditEventRepository auditEvents, TenantRolePermissionRepository rolePermissions,
                       AuthSessionRepository sessions, PasswordEncoder passwordEncoder, JwtEncoder jwtEncoder,
                       TenantModuleEntitlementService moduleEntitlements, LoginThrottleService loginThrottle,
                       SubscriptionQuotaService subscriptionQuotas, TenantRoleService tenantRoles) {
        this.users = users; this.tenants = tenants; this.memberships = memberships; this.auditEvents = auditEvents;
        this.rolePermissions = rolePermissions;
        this.moduleEntitlements = moduleEntitlements;
        this.loginThrottle = loginThrottle;
        this.subscriptionQuotas = subscriptionQuotas;
        this.tenantRoles = tenantRoles;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder; this.jwtEncoder = jwtEncoder;
        this.dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public AuthDtos.AuthResponse register(AuthDtos.RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(email)) throw new ResponseStatusException(HttpStatus.CONFLICT, "An account already exists for this email");
        var user = users.save(new AppUserEntity(email, passwordEncoder.encode(request.password()), request.name().trim()));
        String slug = slug(request.workspaceName());
        if (slug.isBlank()) slug = "workspace";
        String uniqueSlug = slug;
        for (int suffix = 2; tenants.existsBySlug(uniqueSlug); suffix++) uniqueSlug = slug + "-" + suffix;
        UUID tenantId = UUID.randomUUID();
        tenants.saveAndFlush(new TenantEntity(tenantId, uniqueSlug, request.workspaceName().trim()));
        memberships.save(new TenantMembershipEntity(tenantId, user.getId(), "OWNER"));
        rolePermissions.saveAll(defaultPermissions(tenantId));
        tenantRoles.initialize(tenantId);
        moduleEntitlements.initialize(tenantId);
        subscriptionQuotas.initialize(tenantId);
        auditEvents.save(new TenantAuditEventEntity(tenantId, user.getId(), "TENANT_CREATED", "tenant", tenantId, Map.of("ownerEmail", email)));
        return issueToken(user, tenants.findSummaryById(tenantId).orElseThrow(), "OWNER");
    }

    @Transactional
    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request, String remoteAddress) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (loginThrottle.isBlocked(email, remoteAddress)) throw new BadCredentialsException("Invalid email or password");
        var user = users.findByEmail(email).orElse(null);
        boolean passwordMatches = passwordEncoder.matches(request.password(), user == null ? dummyPasswordHash : user.getPasswordHash());
        if (user == null || !user.isActive() || !passwordMatches) {
            loginThrottle.recordFailure(email, remoteAddress);
            throw new BadCredentialsException("Invalid email or password");
        }
        var membership = memberships.findFirstByUserIdAndActiveTrueOrderByCreatedAtAsc(user.getId())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));
        var tenant = tenants.findSummaryById(membership.getTenantId()).orElseThrow(() -> new BadCredentialsException("Invalid email or password"));
        loginThrottle.recordSuccess(email);
        String sourceHash = loginThrottle.loginSourceHash(remoteAddress);
        if (sessions.existsByUserIdAndLoginSourceHashIsNotNullAndLoginSourceHashNot(user.getId(), sourceHash)) {
            auditEvents.save(new TenantAuditEventEntity(tenant.getId(), user.getId(), "LOGIN_FROM_NEW_NETWORK", "account", user.getId(),
                    Map.of("message", "A successful sign-in came from a network not used by this account before.")));
        }
        return issueToken(user, tenant, membership.getRole(), sourceHash);
    }

    public AuthDtos.AuthResponse issueToken(AppUserEntity user, TenantRepository.TenantSummary tenant, String role) {
        return issueToken(user, tenant, role, null);
    }

    private AuthDtos.AuthResponse issueToken(AppUserEntity user, TenantRepository.TenantSummary tenant, String role, String loginSourceHash) {
        Instant now = Instant.now();
        UUID sessionId = UUID.randomUUID();
        Instant expiresAt = now.plusSeconds(TOKEN_TTL_SECONDS);
        sessions.save(new AuthSessionEntity(sessionId, user.getId(), tenant.getId(), expiresAt, loginSourceHash));
        var claims = JwtClaimsSet.builder().issuer("spindl").id(sessionId.toString()).issuedAt(now).expiresAt(expiresAt)
                .subject(user.getId().toString()).claim("email", user.getEmail()).claim("name", user.getDisplayName())
                .claim("tenant_id", tenant.getId().toString()).claim("tenant_name", tenant.getDisplayName()).claim("roles", java.util.List.of(role)).build();
        var headers = JwsHeader.with(MacAlgorithm.HS256).build();
        String encoded = jwtEncoder.encode(JwtEncoderParameters.from(headers, claims)).getTokenValue();
        return new AuthDtos.AuthResponse(encoded, "Bearer", TOKEN_TTL_SECONDS, user.getId().toString(), user.getEmail(), user.getDisplayName(), tenant.getId().toString(), tenant.getDisplayName(), role);
    }

    @Transactional
    public void revokeSession(UUID userId, UUID sessionId) {
        sessions.findById(sessionId).filter(session -> session.getUserId().equals(userId)).ifPresent(AuthSessionEntity::revoke);
    }

    @Transactional
    public void revokeAllSessions(UUID userId) { sessions.findAllByUserIdAndRevokedAtIsNull(userId).forEach(AuthSessionEntity::revoke); }

    @Transactional(readOnly = true)
    public java.util.List<AuthDtos.SessionView> listSessions(UUID userId, UUID currentSessionId) {
        Instant now = Instant.now();
        return sessions.findAllByUserIdAndRevokedAtIsNull(userId).stream().filter(session -> session.getExpiresAt().isAfter(now))
                .map(session -> new AuthDtos.SessionView(session.getId(), session.getCreatedAt(), session.getExpiresAt(), session.getId().equals(currentSessionId))).toList();
    }

    private String slug(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        return normalized.substring(0, Math.min(70, normalized.length()));
    }

    private java.util.List<TenantRolePermissionEntity> defaultPermissions(UUID tenantId) {
        var grants = new java.util.ArrayList<TenantRolePermissionEntity>();
        for (String role : java.util.List.of("OWNER", "ADMIN")) addGrant(grants, tenantId, role, "*", "*", "*");
        addGrant(grants, tenantId, "VIEWER", "*", "*", "view");
        addGrant(grants, tenantId, "MANAGER", "*", "*", "view");
        for (String module : java.util.List.of("crm", "catalog", "inventory", "purchasing", "sales", "finance", "imports")) {
            for (String action : java.util.List.of("create", "edit", "approve", "export", "import"))
                if (!module.equals("finance") || action.equals("export")) addGrant(grants, tenantId, "MANAGER", module, "*", action);
        }
        addGrant(grants, tenantId, "MANAGER", "inventory", "*", "adjust");
        addGrant(grants, tenantId, "MANAGER", "purchasing", "*", "receive");
        addGrant(grants, tenantId, "MANAGER", "purchasing", "*", "return");
        addGrant(grants, tenantId, "MANAGER", "sales", "*", "fulfill");
        addGrant(grants, tenantId, "MANAGER", "finance", "*", "pay");
        addGrant(grants, tenantId, "MANAGER", "finance", "*", "credit");
        addGrant(grants, tenantId, "MANAGER", "operations", "audit", "view");
        for(String action:java.util.List.of("view","create","edit","approve"))addGrant(grants,tenantId,"MANAGER","quality","*",action);
        for(String action:java.util.List.of("create","edit","approve","release","issue","return","receive","export","start","complete","assign"))addGrant(grants,tenantId,"MANAGER","manufacturing","*",action);
        addGrant(grants, tenantId, "OPERATOR", "*", "*", "view");
        for (String module : java.util.List.of("crm", "catalog", "inventory", "purchasing", "sales")) {
            addGrant(grants, tenantId, "OPERATOR", module, "*", "create");
            addGrant(grants, tenantId, "OPERATOR", module, "*", "edit");
        }
        addGrant(grants, tenantId, "OPERATOR", "inventory", "*", "adjust");
        addGrant(grants,tenantId,"OPERATOR","quality","*","view");
        addGrant(grants,tenantId,"OPERATOR","quality","inspections","create");
        for(String action:java.util.List.of("view","issue","return","receive"))addGrant(grants,tenantId,"OPERATOR","manufacturing","*",action);
        addGrant(grants,tenantId,"OPERATOR","manufacturing","work-orders","edit");
        addGrant(grants,tenantId,"OPERATOR","manufacturing","work-orders","start");
        addGrant(grants,tenantId,"OPERATOR","manufacturing","work-orders","complete");
        return grants;
    }

    private void addGrant(java.util.List<TenantRolePermissionEntity> grants, UUID tenantId,
                          String role, String module, String resource, String action) {
        grants.add(new TenantRolePermissionEntity(tenantId, role, module, resource, action, "ALL"));
    }
}
