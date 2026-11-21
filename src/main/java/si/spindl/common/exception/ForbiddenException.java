package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

public final class ForbiddenException extends ApiException {

    public ForbiddenException() {
        super(HttpStatus.FORBIDDEN);
    }

    public ForbiddenException(String reason) {
        super(HttpStatus.FORBIDDEN, reason);
    }
}
