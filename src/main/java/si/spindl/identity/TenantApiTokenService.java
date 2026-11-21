package si.spindl.identity;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ForbiddenException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.tenant.CurrentTenant;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class TenantApiTokenService {
    private static final Set<String> ALLOWED_SCOPES=Set.of("crm:customers:view","crm:customers:create","crm:customers:edit","purchasing:suppliers:view","catalog:items:view","catalog:items:create","catalog:items:edit","purchasing:orders:view","purchasing:orders:create","purchasing:orders:approve","inventory:stock:view","sales:quotes:view","sales:orders:view","finance:invoices:view","finance:transactions:view","manufacturing:work-orders:view","quality:inspections:view");
    private final TenantApiTokenRepository tokens;private final TenantMembershipRepository memberships;private final TenantRolePermissionRepository permissions;private final TenantAuditEventRepository audit;private final CurrentTenant tenant;private final SecureRandom random=new SecureRandom();
    public TenantApiTokenService(TenantApiTokenRepository tokens,TenantMembershipRepository memberships,TenantRolePermissionRepository permissions,TenantAuditEventRepository audit,CurrentTenant tenant){this.tokens=tokens;this.memberships=memberships;this.permissions=permissions;this.audit=audit;this.tenant=tenant;}
    @Transactional(readOnly=true) public List<TokenView> list(UUID actorId){UUID tenantId=tenant.currentTenantId();requireAdmin(tenantId,actorId);return tokens.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream().map(TokenView::from).toList();}
    @Transactional public CreatedToken create(UUID actorId,CreateTokenRequest request){UUID tenantId=tenant.currentTenantId();String role=memberships.findActiveRole(tenantId,actorId).orElseThrow(()->forbidden("Active workspace membership is required"));if(!Set.of("OWNER","ADMIN").contains(role))throw forbidden("Only workspace owners and admins can issue API tokens");String name=cleanName(request.name());List<String> scopes=validateScopes(request.scopes(),tenantId,role);Instant expiresAt=request.expiresInDays()==null?null:Instant.now().plus(request.expiresInDays(),ChronoUnit.DAYS);byte[] secretBytes=new byte[32];random.nextBytes(secretBytes);String secret="spk_live_"+Base64.getUrlEncoder().withoutPadding().encodeToString(secretBytes);String prefix=secret.substring(0,16);var entity=tokens.save(new TenantApiTokenEntity(tenantId,actorId,name,prefix,hash(secret),scopes,expiresAt));audit.save(new TenantAuditEventEntity(tenantId,actorId,"API_TOKEN_CREATED","api_token",entity.getId(),Map.of("name",name,"scopes",scopes,"expiresAt",expiresAt==null?"never":expiresAt.toString())));return new CreatedToken(TokenView.from(entity),secret);}
    @Transactional public void revoke(UUID actorId,UUID id){UUID tenantId=tenant.currentTenantId();requireAdmin(tenantId,actorId);TenantApiTokenEntity token=tokens.findByTenantIdAndId(tenantId,id).orElseThrow(()->new NotFoundException("API token not found"));if(token.getRevokedAt()!=null)return;token.revoke();audit.save(new TenantAuditEventEntity(tenantId,actorId,"API_TOKEN_REVOKED","api_token",id,Map.of("name",token.getName())));}
    @Transactional public ApiIdentity authenticate(String secret){if(secret==null||!secret.startsWith("spk_live_")||secret.length()>128)return null;TenantApiTokenEntity token=tokens.findByTokenHashAndRevokedAtIsNull(hash(secret)).orElse(null);if(token==null||token.getExpiresAt()!=null&&!token.getExpiresAt().isAfter(Instant.now()))return null;String role=memberships.findActiveRole(token.getTenantId(),token.getCreatedBy()).orElse(null);if(role==null)return null;token.touch();return new ApiIdentity(token.getId(),token.getTenantId(),token.getCreatedBy(),role,token.getScopes());}
    public List<String> supportedScopes(UUID actorId){requireAdmin(tenant.currentTenantId(),actorId);return ALLOWED_SCOPES.stream().sorted().toList();}
    private List<String> validateScopes(List<String> values,UUID tenantId,String role){if(values==null||values.isEmpty()||values.size()>20)throw badRequest("Choose between 1 and 20 API scopes");if(values.stream().distinct().count()!=values.size())throw badRequest("API scopes must be unique");for(String scope:values){if(!ALLOWED_SCOPES.contains(scope))throw badRequest("Unsupported API scope: "+scope);String[] parts=scope.split(":");if(!permissions.allows(tenantId,role,parts[0],parts[1],parts[2],"ALL"))throw forbidden("Your role does not have the permission required for scope "+scope);}return values.stream().sorted().toList();}
    private void requireAdmin(UUID tenantId,UUID actorId){String role=memberships.findActiveRole(tenantId,actorId).orElseThrow(()->forbidden("Active workspace membership is required"));if(!Set.of("OWNER","ADMIN").contains(role))throw forbidden("Only workspace owners and admins can manage API tokens");}
    private String cleanName(String value){if(value==null||value.isBlank()||value.trim().length()>120)throw badRequest("Token name is required and must be at most 120 characters");return value.trim();}
    private String hash(String secret){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8)));}catch(Exception exception){throw new IllegalStateException("SHA-256 unavailable",exception);}}
    private ResponseStatusException badRequest(String message){return new BadRequestException(message);}private ResponseStatusException forbidden(String message){return new ForbiddenException(message);}
    public record CreateTokenRequest(String name,List<String> scopes,Integer expiresInDays){}
    public record TokenView(UUID id,String name,String tokenPrefix,List<String> scopes,Instant expiresAt,Instant revokedAt,Instant lastUsedAt,Instant createdAt){static TokenView from(TenantApiTokenEntity entity){return new TokenView(entity.getId(),entity.getName(),entity.getTokenPrefix(),entity.getScopes(),entity.getExpiresAt(),entity.getRevokedAt(),entity.getLastUsedAt(),entity.getCreatedAt());}}
    public record CreatedToken(TokenView token,String secret){}
    public record ApiIdentity(UUID tokenId,UUID tenantId,UUID userId,String role,List<String> scopes){}
}
