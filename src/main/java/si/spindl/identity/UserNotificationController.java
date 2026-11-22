package si.spindl.identity;

import si.spindl.common.security.AuthenticatedActor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class UserNotificationController {
    private final UserNotificationService service;

    public UserNotificationController(UserNotificationService service) { this.service = service; }

    @GetMapping
    public UserNotificationDtos.Inbox inbox(@AuthenticationPrincipal Jwt jwt,
                                                @RequestParam(defaultValue = "30") int size) {
        return service.inbox(AuthenticatedActor.userId(jwt), size);
    }

    @PatchMapping("/{id}/read")
    public UserNotificationDtos.UserNotificationView markRead(@AuthenticationPrincipal Jwt jwt,
                                                                  @PathVariable UUID id) {
        return service.markRead(AuthenticatedActor.userId(jwt), id);
    }

    @PatchMapping("/read-all")
    public UserNotificationDtos.Inbox markAllRead(@AuthenticationPrincipal Jwt jwt) {
        return service.markAllRead(AuthenticatedActor.userId(jwt));
    }
}
