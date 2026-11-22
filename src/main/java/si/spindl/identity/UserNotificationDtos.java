package si.spindl.identity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** API contract for UserNotificationService. Mapping to entities lives in the mapper, not here. */
public final class UserNotificationDtos {
    private UserNotificationDtos() {}

    public record Inbox(List<UserNotificationView> items, long unreadCount) {}

    public record UserNotificationView(UUID id, String title, String message, String subjectType,
                                       UUID subjectId, Instant createdAt, Instant readAt) {}
}
