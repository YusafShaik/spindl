package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

public final class PayloadTooLargeException extends ApiException {

    public PayloadTooLargeException() {
        super(HttpStatus.PAYLOAD_TOO_LARGE);
    }

    public PayloadTooLargeException(String reason) {
        super(HttpStatus.PAYLOAD_TOO_LARGE, reason);
    }
}
