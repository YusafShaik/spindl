package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

/**
 * A failure of the runtime (crypto, mail transport, and similar), not a business-state conflict.
 * Mapped to HTTP 500. Business conflicts stay {@link IllegalStateException}.
 */
public class InfrastructureException extends ApiException {

    public InfrastructureException(String reason) {
        super(HttpStatus.INTERNAL_SERVER_ERROR, reason);
    }

    public InfrastructureException(String reason, Throwable cause) {
        super(HttpStatus.INTERNAL_SERVER_ERROR, reason, cause);
    }
}
