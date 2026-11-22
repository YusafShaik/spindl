package si.spindl.identity;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import java.util.List;
import jakarta.validation.constraints.NotNull;

public final class TeamDtos {
    private TeamDtos() {}
    public record InviteRequest(@NotBlank @Email @Size(max = 254) String email, @NotBlank String role) {}
    public record AcceptInvitationRequest(@NotBlank @Size(max = 160) String name, @NotBlank @Size(min = 12, max = 72) String password,
                                          @NotBlank String token) {}
    public record ChangeRoleRequest(@NotBlank String role) {}
    public record TransferOwnershipRequest(@jakarta.validation.constraints.NotNull UUID targetMembershipId, @NotBlank @Size(min=12, max=72) String password) {}
    public record ConfirmOwnershipTransferRequest(@NotBlank String token, @NotBlank @Size(min=12, max=72) String password) {}
    public record OwnershipTransferView(UUID id, String email, Instant expiresAt, String transferToken) {}
    public record MembershipView(UUID id, String userId, String name, String email, String role, boolean active,UUID managerUserId,java.util.List<UUID> branchIds) {}
    public record MemberScopeRequest(java.util.List<UUID> branchIds,UUID managerUserId){}
    public record InvitationView(UUID id, String email, String role, Instant expiresAt, boolean accepted, String inviteToken) {}
    public record AcceptInvitationResponse(AuthDtos.AuthResponse session) {}
}
