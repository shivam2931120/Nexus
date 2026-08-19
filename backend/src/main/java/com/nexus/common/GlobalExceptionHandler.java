package com.nexus.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.dao.DataAccessException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.stream.Collectors;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ApiError> responseStatus(ResponseStatusException ex) { return ResponseEntity.status(ex.getStatusCode()).body(ApiError.of("REQUEST_FAILED", ex.getReason()==null?"The request could not be completed.":ex.getReason())); }
    @ExceptionHandler(EmptyResultDataAccessException.class)
    ResponseEntity<ApiError> notFound(EmptyResultDataAccessException ex) { return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiError.of("NOT_FOUND", "The requested record does not exist or is no longer available.")); }
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> badRequest(IllegalArgumentException ex) { return ResponseEntity.badRequest().body(ApiError.of("BAD_REQUEST", ex.getMessage())); }
    @ExceptionHandler(SecurityException.class)
    ResponseEntity<ApiError> forbidden(SecurityException ex) { return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiError.of("FORBIDDEN", ex.getMessage())); }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException ex) {
        var fields = ex.getBindingResult().getFieldErrors().stream().collect(Collectors.toMap(e -> e.getField(), e -> String.valueOf(e.getDefaultMessage()), (a,b)->a));
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", "Please check the highlighted fields.", java.time.Instant.now(), fields));
    }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> malformed(Exception ex) { return ResponseEntity.badRequest().body(ApiError.of("BAD_REQUEST", "The request body or identifier is invalid.")); }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiError> data(DataAccessException ex) { log.error("Database request failed", ex); return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiError.of("DATA_ACCESS_ERROR", "The workspace service could not complete this request.")); }
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception ex) { log.error("Unhandled request failure", ex); return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiError.of("INTERNAL_ERROR", "The workspace service encountered an unexpected error.")); }
}
