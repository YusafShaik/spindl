package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

public final class NotFoundException extends ApiException {

    public NotFoundException() {
        super(HttpStatus.NOT_FOUND);
    }

    public NotFoundException(String reason) {
        super(HttpStatus.NOT_FOUND, reason);
    }
}
