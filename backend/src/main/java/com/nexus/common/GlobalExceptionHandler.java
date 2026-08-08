package com.nexus.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
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
}
