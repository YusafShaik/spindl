package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

public final class UnauthorizedException extends ApiException {

    public UnauthorizedException() {
        super(HttpStatus.UNAUTHORIZED);
    }

    public UnauthorizedException(String reason) {
        super(HttpStatus.UNAUTHORIZED, reason);
    }
}
