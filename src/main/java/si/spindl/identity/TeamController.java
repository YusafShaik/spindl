package si.spindl.identity;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.security.AuthenticatedActor;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.CurrentTenant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/team")
public class TeamController {
    private final TeamService team;
    private final CurrentTenant tenant;
    public TeamController(TeamService team, CurrentTenant tenant) { this.team = team; this.tenant = tenant; }

    @GetMapping("/members") public List<TeamDtos.MembershipView> members() { return team.listMembers(tenant.currentTenantId()); }
    @GetMapping("/invitations") public List<TeamDtos.InvitationView> invitations() { return team.listInvitations(tenant.currentTenantId()); }
    @PostMapping("/invitations") @ResponseStatus(HttpStatus.CREATED)
    public TeamDtos.InvitationView invite(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TeamDtos.InviteRequest request) {
        return team.invite(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), request);
    }
    @PostMapping("/invitations/{id}/resend")
    public TeamDtos.InvitationView resend(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return team.resend(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), id);
    }
    @PostMapping("/invitations/accept")
    public TeamDtos.AcceptInvitationResponse accept(@Valid @RequestBody TeamDtos.AcceptInvitationRequest request) {
        return new TeamDtos.AcceptInvitationResponse(team.accept(request));
    }
    @PatchMapping("/members/{id}/role")
    public TeamDtos.MembershipView role(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody TeamDtos.ChangeRoleRequest request) {
        return team.changeRole(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), id, request.role());
    }
    @PatchMapping("/members/{id}/active")
    public TeamDtos.MembershipView active(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @RequestBody Map<String, Boolean> request) {
        Boolean active = request.get("active");
        if (active == null) throw new BadRequestException("The active field is required");
        return team.setActive(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), id, active);
    }
    @PatchMapping("/members/{id}/scope")
    public TeamDtos.MembershipView scope(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody TeamDtos.MemberScopeRequest request){return team.assignScope(tenant.currentTenantId(),AuthenticatedActor.userId(jwt),id,request);}
    @PostMapping("/ownership-transfer")
    public TeamDtos.OwnershipTransferView transferOwnership(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TeamDtos.TransferOwnershipRequest request) {
        return team.requestOwnershipTransfer(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), request);
    }
    @PostMapping("/ownership-transfer/confirm")
    public AuthDtos.AuthResponse confirmOwnershipTransfer(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TeamDtos.ConfirmOwnershipTransferRequest request) {
        return team.confirmOwnershipTransfer(tenant.currentTenantId(), AuthenticatedActor.userId(jwt), request);
    }
}
