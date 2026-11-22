package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

public final class PaymentRequiredException extends ApiException {

    public PaymentRequiredException() {
        super(HttpStatus.PAYMENT_REQUIRED);
    }

    public PaymentRequiredException(String reason) {
        super(HttpStatus.PAYMENT_REQUIRED, reason);
    }
}
