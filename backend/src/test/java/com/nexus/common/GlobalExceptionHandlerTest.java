package com.nexus.common;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void preservesExplicitHttpStatusAndSafeReason() {
        var response = handler.responseStatus(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "LiveKit is not configured."));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).isEqualTo("LiveKit is not configured.");
    }

    @Test
    void missingDatabaseRowsReturnNotFound() {
        var response = handler.notFound(new org.springframework.dao.EmptyResultDataAccessException(1));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
