package si.spindl.common.exception;

import org.springframework.http.HttpStatus;

public final class UnsupportedMediaTypeException extends ApiException {

    public UnsupportedMediaTypeException() {
        super(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }

    public UnsupportedMediaTypeException(String reason) {
        super(HttpStatus.UNSUPPORTED_MEDIA_TYPE, reason);
    }
}
