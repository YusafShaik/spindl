package si.spindl.identity;

public interface ResetEmailSender {
    void sendPasswordReset(String email, String resetLink);
}
