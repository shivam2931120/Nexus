package com.nexus.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.dao.DataAccessException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {
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
    ResponseEntity<ApiError> data(DataAccessException ex) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiError.of("DATA_ACCESS_ERROR", "The workspace service could not complete this request.")); }
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception ex) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiError.of("INTERNAL_ERROR", "The workspace service encountered an unexpected error.")); }
}
