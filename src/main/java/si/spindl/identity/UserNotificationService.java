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
import si.spindl.identity.UserNotificationDtos.Inbox;
import si.spindl.identity.UserNotificationDtos.UserNotificationView;

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
                .stream().map(UserNotificationMapper::toUserNotificationView).toList();
        return new Inbox(events, notifications.countByTenantIdAndUserIdAndReadAtIsNull(tenantId, userId));
    }

    @Transactional
    public UserNotificationView markRead(UUID userId, UUID id) {
        var notification = notifications.findByTenantIdAndUserIdAndId(tenant.currentTenantId(), userId, id)
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        notification.markRead();
        return UserNotificationMapper.toUserNotificationView(notification);
    }

    @Transactional
    public Inbox markAllRead(UUID userId) {
        notifications.markAllRead(tenant.currentTenantId(), userId);
        return inbox(userId, 30);
    }

}
