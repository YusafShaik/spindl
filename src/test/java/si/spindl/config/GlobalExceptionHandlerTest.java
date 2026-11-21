package si.spindl.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void translatesIllegalArgumentExceptionToProblemDetail() {
        IllegalArgumentException ex = new IllegalArgumentException("Resource not found or invalid");
        ProblemDetail detail = handler.handleIllegalArgumentException(ex);

        assertEquals(HttpStatus.BAD_REQUEST.value(), detail.getStatus());
        assertEquals("Invalid Request", detail.getTitle());
        assertEquals("Resource not found or invalid", detail.getDetail());
        assertNotNull(detail.getProperties().get("timestamp"));
    }

    @Test
    void translatesIllegalStateExceptionToProblemDetail() {
        IllegalStateException ex = new IllegalStateException("Action cannot be performed in current state");
        ProblemDetail detail = handler.handleIllegalStateException(ex);

        assertEquals(HttpStatus.CONFLICT.value(), detail.getStatus());
        assertEquals("State Conflict", detail.getTitle());
        assertEquals("Action cannot be performed in current state", detail.getDetail());
        assertNotNull(detail.getProperties().get("timestamp"));
    }

    @Test
    void translatesResponseStatusExceptionToProblemDetail() {
        ResponseStatusException ex = new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found");
        ProblemDetail detail = handler.handleResponseStatusException(ex);

        assertEquals(HttpStatus.NOT_FOUND.value(), detail.getStatus());
        assertEquals("Item not found", detail.getDetail());
        assertNotNull(detail.getProperties().get("timestamp"));
    }

    @Test
    void translatesAccessDeniedExceptionToProblemDetail() {
        AccessDeniedException ex = new AccessDeniedException("Forbidden");
        ProblemDetail detail = handler.handleAccessDeniedException(ex);

        assertEquals(HttpStatus.FORBIDDEN.value(), detail.getStatus());
        assertEquals("Access Denied", detail.getTitle());
        assertEquals("Forbidden", detail.getDetail());
        assertNotNull(detail.getProperties().get("timestamp"));
    }

    @Test
    void translatesGenericExceptionToProblemDetail() {
        RuntimeException ex = new RuntimeException("Unexpected error");
        ProblemDetail detail = handler.handleGenericException(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), detail.getStatus());
        assertEquals("Internal Server Error", detail.getTitle());
        assertEquals("Internal server error", detail.getDetail());
        assertNotNull(detail.getProperties().get("timestamp"));
    }
}
