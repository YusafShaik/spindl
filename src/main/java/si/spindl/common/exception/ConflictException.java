package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

public final class ConflictException extends ApiException {

    public ConflictException() {
        super(HttpStatus.CONFLICT);
    }

    public ConflictException(String reason) {
        super(HttpStatus.CONFLICT, reason);
    }
}
