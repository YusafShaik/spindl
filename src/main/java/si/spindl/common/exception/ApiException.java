package si.spindl.common.exception;

import org.springframework.http.HttpStatusCode;
import org.springframework.web.server.ResponseStatusException;

/**
 * API failure whose HTTP contract matches {@link ResponseStatusException}:
 * the problem title is the status text and the detail is the reason.
 * Subtypes exist so callers name the failure without changing that payload.
 */
public class ApiException extends ResponseStatusException {

    public ApiException(HttpStatusCode status) {
        super(status);
    }

    public ApiException(HttpStatusCode status, String reason) {
        super(status, reason);
    }

    public ApiException(HttpStatusCode status, String reason, Throwable cause) {
        super(status, reason, cause);
    }
}
