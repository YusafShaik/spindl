package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

public final class ServiceUnavailableException extends ApiException {

    public ServiceUnavailableException() {
        super(HttpStatus.SERVICE_UNAVAILABLE);
    }

    public ServiceUnavailableException(String reason) {
        super(HttpStatus.SERVICE_UNAVAILABLE, reason);
    }
}
