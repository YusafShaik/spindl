package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

public final class InternalServerException extends ApiException {

    public InternalServerException() {
        super(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public InternalServerException(String reason) {
        super(HttpStatus.INTERNAL_SERVER_ERROR, reason);
    }

    public InternalServerException(String reason, Throwable cause) {
        super(HttpStatus.INTERNAL_SERVER_ERROR, reason, cause);
    }
}
