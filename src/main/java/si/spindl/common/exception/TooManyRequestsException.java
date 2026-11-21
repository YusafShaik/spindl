package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

public final class TooManyRequestsException extends ApiException {

    public TooManyRequestsException() {
        super(HttpStatus.TOO_MANY_REQUESTS);
    }

    public TooManyRequestsException(String reason) {
        super(HttpStatus.TOO_MANY_REQUESTS, reason);
    }
}
