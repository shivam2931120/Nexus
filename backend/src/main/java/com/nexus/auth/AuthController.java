package com.nexus.auth;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;

@RestController @RequestMapping("/api/auth")
public class AuthController {
    private final AuthService service; public AuthController(AuthService service){this.service=service;}
    @PostMapping("/register") public AuthModels.AuthResponse register(@Valid @RequestBody AuthModels.RegisterRequest req){return service.register(req);}
    @PostMapping("/login") public AuthModels.AuthResponse login(@Valid @RequestBody AuthModels.LoginRequest req){return service.login(req);}
    @GetMapping("/me") public AuthModels.UserView me(Authentication auth){var u=service.user(java.util.UUID.fromString(auth.getName()));return new AuthModels.UserView(u.getId(),u.getEmail(),u.getName());}
}
