package si.spindl.identity;

import si.spindl.common.exception.NotFoundException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import si.spindl.tenant.CurrentTenant;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class UserNotificationService {
    private final UserNotificationRepository notifications;
    private final CurrentTenant tenant;

    public UserNotificationService(UserNotificationRepository notifications, CurrentTenant tenant) {
        this.notifications = notifications;
        this.tenant = tenant;
    }

    @Transactional(readOnly = true)
    public Inbox inbox(UUID userId, int requestedSize) {
        UUID tenantId = tenant.currentTenantId();
        int size = Math.max(1, Math.min(50, requestedSize));
        var events = notifications.findAllByTenantIdAndUserIdOrderByCreatedAtDesc(tenantId, userId, PageRequest.of(0, size))
                .stream().map(UserNotificationView::from).toList();
        return new Inbox(events, notifications.countByTenantIdAndUserIdAndReadAtIsNull(tenantId, userId));
    }

    @Transactional
    public UserNotificationView markRead(UUID userId, UUID id) {
        var notification = notifications.findByTenantIdAndUserIdAndId(tenant.currentTenantId(), userId, id)
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        notification.markRead();
        return UserNotificationView.from(notification);
    }

    @Transactional
    public Inbox markAllRead(UUID userId) {
        notifications.markAllRead(tenant.currentTenantId(), userId);
        return inbox(userId, 30);
    }

    public record Inbox(List<UserNotificationView> items, long unreadCount) {}
    public record UserNotificationView(UUID id, String title, String message, String subjectType,
                                       UUID subjectId, Instant createdAt, Instant readAt) {
        static UserNotificationView from(UserNotificationEntity notification) {
            var event = notification.getAuditEvent();
            String title = label(event.getEventType());
            String subject = label(event.getSubjectType());
            return new UserNotificationView(notification.getId(), title,
                    subject + " activity was recorded in your workspace.", event.getSubjectType(),
                    event.getSubjectId(), notification.getCreatedAt(), notification.getReadAt());
        }
        private static String label(String value) {
            String words = value == null ? "Activity" : value.replaceAll("([a-z0-9])([A-Z])", "$1 $2").replace('_', ' ').toLowerCase(Locale.ROOT);
            return words.isBlank() ? "Activity" : words.substring(0, 1).toUpperCase(Locale.ROOT) + words.substring(1);
        }
    }
}
