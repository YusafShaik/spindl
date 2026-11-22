package si.spindl.identity;

import si.spindl.identity.UserNotificationDtos.UserNotificationView;

import java.util.Locale;

/** Entity and row mapping for UserNotificationDtos. The records themselves stay free of persistence types. */
public final class UserNotificationMapper {
    private UserNotificationMapper() {}

    public static UserNotificationView toUserNotificationView(UserNotificationEntity notification) {

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
