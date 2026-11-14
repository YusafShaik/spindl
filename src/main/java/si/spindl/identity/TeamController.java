package si.spindl.identity;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.DevelopmentTenant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/team")
public class TeamController {
    private final TeamService team;
    private final DevelopmentTenant tenant;
    public TeamController(TeamService team, DevelopmentTenant tenant) { this.team = team; this.tenant = tenant; }

    @GetMapping("/members") public List<TeamDtos.MembershipView> members() { return team.listMembers(tenant.currentTenantId()); }
    @GetMapping("/invitations") public List<TeamDtos.InvitationView> invitations() { return team.listInvitations(tenant.currentTenantId()); }
    @PostMapping("/invitations") @ResponseStatus(HttpStatus.CREATED)
    public TeamDtos.InvitationView invite(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TeamDtos.InviteRequest request) {
        return team.invite(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), request);
    }
    @PostMapping("/invitations/{id}/resend")
    public TeamDtos.InvitationView resend(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return team.resend(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), id);
    }
    @PostMapping("/invitations/accept")
    public TeamDtos.AcceptInvitationResponse accept(@Valid @RequestBody TeamDtos.AcceptInvitationRequest request) {
        return new TeamDtos.AcceptInvitationResponse(team.accept(request));
    }
    @PatchMapping("/members/{id}/role")
    public TeamDtos.MembershipView role(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody TeamDtos.ChangeRoleRequest request) {
        return team.changeRole(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), id, request.role());
    }
    @PatchMapping("/members/{id}/active")
    public TeamDtos.MembershipView active(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @RequestBody Map<String, Boolean> request) {
        Boolean active = request.get("active");
        if (active == null) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "The active field is required");
        return team.setActive(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), id, active);
    }
    @PatchMapping("/members/{id}/scope")
    public TeamDtos.MembershipView scope(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody TeamDtos.MemberScopeRequest request){return team.assignScope(tenant.currentTenantId(),UUID.fromString(jwt.getSubject()),id,request);}
    @PostMapping("/ownership-transfer")
    public TeamDtos.OwnershipTransferView transferOwnership(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TeamDtos.TransferOwnershipRequest request) {
        return team.requestOwnershipTransfer(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), request);
    }
    @PostMapping("/ownership-transfer/confirm")
    public AuthDtos.AuthResponse confirmOwnershipTransfer(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TeamDtos.ConfirmOwnershipTransferRequest request) {
        return team.confirmOwnershipTransfer(tenant.currentTenantId(), UUID.fromString(jwt.getSubject()), request);
    }
}
