package si.spindl.identity;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.ForbiddenException;
import si.spindl.common.exception.NotFoundException;
import org.springframework.security.authentication.BadCredentialsException;
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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class TeamService {
    private static final Set<String> INVITABLE_ROLES = Set.of("ADMIN", "MANAGER", "OPERATOR", "VIEWER");
    private static final Set<String> ASSIGNABLE_ROLES = Set.of("ADMIN", "MANAGER", "OPERATOR", "VIEWER");
    private static final Set<String> ADMIN_ROLES = Set.of("OWNER", "ADMIN");
    private final AppUserRepository users;
    private final TenantMembershipRepository memberships;
    private final TenantInvitationRepository invitations;
    private final TenantRepository tenants;
    private final TenantAuditEventRepository auditEvents;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final TenantOwnershipTransferRepository ownershipTransfers;
    private final SubscriptionQuotaService subscriptionQuotas;
    private final TenantRoleRepository tenantRoles;
    private final TenantBranchRepository branches;
    private final TenantMembershipBranchRepository memberBranches;
    private final SecureRandom secureRandom = new SecureRandom();

    public TeamService(AppUserRepository users, TenantMembershipRepository memberships, TenantInvitationRepository invitations,
                       TenantRepository tenants, TenantAuditEventRepository auditEvents, PasswordEncoder passwordEncoder, AuthService authService,
                       TenantOwnershipTransferRepository ownershipTransfers, SubscriptionQuotaService subscriptionQuotas,
                       TenantRoleRepository tenantRoles,TenantBranchRepository branches,TenantMembershipBranchRepository memberBranches) {
        this.users = users; this.memberships = memberships; this.invitations = invitations; this.tenants = tenants;
        this.auditEvents = auditEvents; this.passwordEncoder = passwordEncoder; this.authService = authService;
        this.ownershipTransfers = ownershipTransfers;
        this.subscriptionQuotas = subscriptionQuotas;
        this.tenantRoles = tenantRoles;
        this.branches=branches;this.memberBranches=memberBranches;
    }

    @Transactional(readOnly = true)
    public List<TeamDtos.MembershipView> listMembers(UUID tenantId) {
        return memberships.findAllByTenantIdOrderByCreatedAtAsc(tenantId).stream().map(membership -> {
            var user = users.findById(membership.getUserId()).orElseThrow();
            return view(membership,user);
        }).toList();
    }

    @Transactional
    public TeamDtos.InvitationView invite(UUID tenantId, UUID actorId, TeamDtos.InviteRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String role = normalizeRole(tenantId,request.role(), INVITABLE_ROLES);
        var existingUser = users.findByEmail(email).orElse(null);
        if (existingUser != null && memberships.existsByTenantIdAndUserId(tenantId, existingUser.getId()))
            throw new ConflictException("This user already belongs to the workspace");
        invitations.deleteAllByTenantIdAndEmailAndAcceptedAtIsNull(tenantId, email);
        subscriptionQuotas.reserveSeatForInvite(tenantId);
        byte[] bytes = new byte[32]; secureRandom.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);
        var invitation = invitations.save(new TenantInvitationEntity(tenantId, email, role, sha256(rawToken), actorId, expiresAt));
        auditEvents.save(new TenantAuditEventEntity(tenantId, actorId, "MEMBER_INVITED", "invitation", invitation.getId(), Map.of("email", email, "role", role)));
        return new TeamDtos.InvitationView(invitation.getId(), email, role, expiresAt, false, rawToken);
    }

    @Transactional(readOnly = true)
    public List<TeamDtos.InvitationView> listInvitations(UUID tenantId) {
        return invitations.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .map(invitation -> new TeamDtos.InvitationView(invitation.getId(), invitation.getEmail(), invitation.getRole(), invitation.getExpiresAt(), invitation.isAccepted(), null))
                .toList();
    }

    @Transactional
    public AuthDtos.AuthResponse accept(TeamDtos.AcceptInvitationRequest request) {
        var invitation = invitations.findByTokenHash(sha256(request.token())).orElseThrow(() -> new BadRequestException("Invitation is invalid or expired"));
        if (invitation.isAccepted() || invitation.isExpired()) throw new BadRequestException("Invitation is invalid or expired");
        var user = users.findByEmail(invitation.getEmail()).orElse(null);
        if (user == null) user = users.save(new AppUserEntity(invitation.getEmail(), passwordEncoder.encode(request.password()), request.name().trim()));
        else if (!user.isActive() || !passwordEncoder.matches(request.password(), user.getPasswordHash())) throw new BadCredentialsException("Invalid email or password");
        if (memberships.existsByTenantIdAndUserId(invitation.getTenantId(), user.getId())) throw new ConflictException("This account already belongs to the workspace");
        subscriptionQuotas.assertSeatAvailableForAcceptance(invitation.getTenantId());
        memberships.save(new TenantMembershipEntity(invitation.getTenantId(), user.getId(), invitation.getRole()));
        UUID acceptedUserId=user.getId();branches.findFirstByTenantIdAndDefaultBranchTrue(invitation.getTenantId()).ifPresent(branch->memberBranches.save(new TenantMembershipBranchEntity(invitation.getTenantId(),acceptedUserId,branch.getId())));
        invitation.accept(user.getId());
        auditEvents.save(new TenantAuditEventEntity(invitation.getTenantId(), user.getId(), "MEMBER_JOINED", "membership", null, Map.of("email", user.getEmail(), "role", invitation.getRole())));
        var tenant = tenants.findSummaryById(invitation.getTenantId()).orElseThrow();
        return authService.issueToken(user, tenant, invitation.getRole());
    }

    @Transactional
    public TeamDtos.InvitationView resend(UUID tenantId, UUID actorId, UUID invitationId) {
        var previous=invitations.findByIdAndTenantId(invitationId,tenantId)
                .orElseThrow(()->new NotFoundException("Invitation not found"));
        if(previous.isAccepted()) throw new ConflictException("An accepted invitation cannot be resent");
        return invite(tenantId,actorId,new TeamDtos.InviteRequest(previous.getEmail(),previous.getRole()));
    }

    @Transactional
    public TeamDtos.MembershipView changeRole(UUID tenantId, UUID actorId, UUID membershipId, String requestedRole) {
        var target = membership(tenantId, membershipId);
        String role = normalizeRole(tenantId,requestedRole, ASSIGNABLE_ROLES);
        if (target.getRole().equals("OWNER")) throw new ConflictException("Workspace ownership cannot be changed here");
        if (ADMIN_ROLES.contains(target.getRole()) && !ADMIN_ROLES.contains(role)) ensureAnotherActiveAdmin(tenantId, target);
        target.changeRole(role);
        auditEvents.save(new TenantAuditEventEntity(tenantId, actorId, "MEMBER_ROLE_CHANGED", "membership", membershipId, Map.of("role", role)));
        var user = users.findById(target.getUserId()).orElseThrow();
        return view(target, user);
    }

    @Transactional
    public TeamDtos.MembershipView assignScope(UUID tenantId,UUID actorId,UUID membershipId,TeamDtos.MemberScopeRequest request){
        var target=membership(tenantId,membershipId);
        if("OWNER".equals(target.getRole()))throw new ConflictException("The workspace owner cannot be assigned a restricted branch or team scope");
        List<UUID> branchIds=request.branchIds()==null?List.of():request.branchIds().stream().distinct().toList();
        for(UUID branchId:branchIds)if(branches.findByTenantIdAndId(tenantId,branchId).filter(TenantBranchEntity::isActive).isEmpty())throw new BadRequestException("Choose active branches in this workspace");
        UUID managerId=request.managerUserId();
        if(managerId!=null){if(managerId.equals(target.getUserId()))throw new BadRequestException("A member cannot manage themselves");if(memberships.findActiveRole(tenantId,managerId).isEmpty())throw new BadRequestException("The team manager must be an active member of this workspace");java.util.Set<UUID> visited=new java.util.HashSet<>();UUID cursor=managerId;while(cursor!=null){if(cursor.equals(target.getUserId()))throw new BadRequestException("Team reporting lines cannot contain a cycle");if(!visited.add(cursor))throw new ConflictException("The existing reporting lines contain a cycle");cursor=memberships.findByTenantIdAndUserId(tenantId,cursor).map(TenantMembershipEntity::getManagerUserId).orElse(null);}}
        target.setManagerUserId(managerId);
        memberBranches.deleteAssignments(tenantId,target.getUserId());
        memberBranches.saveAll(branchIds.stream().map(branchId->new TenantMembershipBranchEntity(tenantId,target.getUserId(),branchId)).toList());
        auditEvents.save(new TenantAuditEventEntity(tenantId,actorId,"MEMBER_SCOPE_CHANGED","membership",membershipId,Map.of("branchCount",branchIds.size(),"managerAssigned",managerId!=null)));
        return view(target,users.findById(target.getUserId()).orElseThrow());
    }

    @Transactional
    public TeamDtos.MembershipView setActive(UUID tenantId, UUID actorId, UUID membershipId, boolean active) {
        var target = membership(tenantId, membershipId);
        if (!active && target.getRole().equals("OWNER")) throw new ConflictException("The workspace owner cannot be deactivated");
        if (!active && target.isActive() && ADMIN_ROLES.contains(target.getRole())) ensureAnotherActiveAdmin(tenantId, target);
        target.setActive(active);
        if (!active) authService.revokeAllSessions(target.getUserId());
        auditEvents.save(new TenantAuditEventEntity(tenantId, actorId, active ? "MEMBER_REACTIVATED" : "MEMBER_DEACTIVATED", "membership", membershipId, Map.of()));
        var user = users.findById(target.getUserId()).orElseThrow();
        return view(target, user);
    }

    @Transactional
    public TeamDtos.OwnershipTransferView requestOwnershipTransfer(UUID tenantId, UUID actorId, TeamDtos.TransferOwnershipRequest request) {
        var actorMembership = memberships.findAllForUpdate(tenantId).stream().filter(m -> m.getUserId().equals(actorId) && m.isActive()).findFirst()
                .orElseThrow(() -> new ForbiddenException("An active workspace owner is required"));
        if (!"OWNER".equals(actorMembership.getRole())) throw new ForbiddenException("Only the workspace owner can transfer ownership");
        var actor = users.findById(actorId).orElseThrow();
        if (!passwordEncoder.matches(request.password(), actor.getPasswordHash())) throw new BadCredentialsException("Re-authentication failed");
        var target = membership(tenantId, request.targetMembershipId());
        if (!target.isActive() || !"ADMIN".equals(target.getRole()))
            throw new ConflictException("Choose an active workspace admin as the new owner");
        ownershipTransfers.cancelExpired(tenantId);
        if (ownershipTransfers.existsByTenantIdAndAcceptedAtIsNullAndCancelledAtIsNull(tenantId))
            throw new ConflictException("A transfer is already pending for this workspace");
        byte[] bytes = new byte[32]; secureRandom.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expiresAt = Instant.now().plus(24, ChronoUnit.HOURS);
        UUID transferId = UUID.randomUUID();
        ownershipTransfers.save(new TenantOwnershipTransferEntity(transferId, tenantId, actorId, target.getUserId(), sha256(token), expiresAt));
        var targetUser = users.findById(target.getUserId()).orElseThrow();
        auditEvents.save(new TenantAuditEventEntity(tenantId, actorId, "OWNERSHIP_TRANSFER_REQUESTED", "membership", target.getId(), Map.of("targetEmail", maskEmail(targetUser.getEmail()), "expiresAt", expiresAt.toString())));
        return new TeamDtos.OwnershipTransferView(transferId, targetUser.getEmail(), expiresAt, token);
    }

    @Transactional
    public AuthDtos.AuthResponse confirmOwnershipTransfer(UUID tenantId, UUID actorId, TeamDtos.ConfirmOwnershipTransferRequest request) {
        var transfer = ownershipTransfers.findByTokenHashForUpdate(sha256(request.token()))
                .orElseThrow(() -> new BadRequestException("Transfer link is invalid or expired"));
        Instant now = Instant.now();
        if (!transfer.getTenantId().equals(tenantId) || !transfer.isPending(now) || !transfer.getToUserId().equals(actorId))
            throw new BadRequestException("Transfer link is invalid or expired");
        var targetUser = users.findById(actorId).orElseThrow();
        if (!targetUser.isActive() || !passwordEncoder.matches(request.password(), targetUser.getPasswordHash()))
            throw new BadCredentialsException("Re-authentication failed");
        var lockedMemberships = memberships.findAllForUpdate(tenantId);
        var oldOwner = lockedMemberships.stream().filter(m -> m.getUserId().equals(transfer.getFromUserId()) && m.isActive() && "OWNER".equals(m.getRole())).findFirst()
                .orElseThrow(() -> new ConflictException("The initiating owner is no longer the workspace owner"));
        var newOwner = lockedMemberships.stream().filter(m -> m.getUserId().equals(actorId) && m.isActive()).findFirst()
                .orElseThrow(() -> new ConflictException("The new owner must remain an active member"));
        oldOwner.changeRole("ADMIN");
        newOwner.changeRole("OWNER");
        transfer.accept(now);
        auditEvents.save(new TenantAuditEventEntity(tenantId, actorId, "OWNERSHIP_TRANSFERRED", "membership", newOwner.getId(),
                Map.of("previousOwnerUserId", transfer.getFromUserId().toString(), "newOwnerUserId", actorId.toString())));
        authService.revokeAllSessions(actorId);
        var tenant=tenants.findSummaryById(tenantId).orElseThrow();
        return authService.issueToken(targetUser,tenant,"OWNER");
    }

    private TenantMembershipEntity membership(UUID tenantId, UUID id) {
        return memberships.findByIdAndTenantId(id, tenantId).orElseThrow(() -> new NotFoundException("Workspace member not found"));
    }

    private void ensureAnotherActiveAdmin(UUID tenantId, TenantMembershipEntity target) {
        long activeAdmins = memberships.countByTenantIdAndRoleInAndActiveTrue(tenantId, ADMIN_ROLES);
        if (target.isActive() && activeAdmins <= 1) throw new ConflictException("The workspace must retain at least one active owner or admin");
    }

    private String normalizeRole(UUID tenantId,String value, Set<String> allowed) {
        String role = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        boolean custom=tenantRoles.findByTenantIdAndRoleCode(tenantId,role).filter(candidate->!candidate.isSystemRole()).isPresent();
        if (!allowed.contains(role)&&!custom) throw new BadRequestException("Unsupported workspace role");
        return role;
    }

    private String sha256(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException("SHA-256 is unavailable", e); }
    }

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) return "***" + (at >= 0 ? email.substring(at) : "");
        return email.substring(0, 1) + "***" + email.substring(at);
    }

    private TeamDtos.MembershipView view(TenantMembershipEntity membership, AppUserEntity user) {
        return new TeamDtos.MembershipView(membership.getId(), user.getId().toString(), user.getDisplayName(), user.getEmail(), membership.getRole(), membership.isActive(),membership.getManagerUserId(),memberBranches.findAllByTenantIdAndUserId(membership.getTenantId(),membership.getUserId()).stream().map(TenantMembershipBranchEntity::getBranchId).toList());
    }
}
