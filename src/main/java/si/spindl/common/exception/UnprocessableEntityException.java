package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

public final class UnprocessableEntityException extends ApiException {

    public UnprocessableEntityException() {
        super(HttpStatus.UNPROCESSABLE_ENTITY);
    }

    public UnprocessableEntityException(String reason) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, reason);
    }
}
