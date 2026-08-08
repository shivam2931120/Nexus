package com.nexus.auth;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.UUID;

@Service
public class AuthService {
    private final UserRepository users; private final PasswordEncoder encoder; private final JwtService jwt;
    public AuthService(UserRepository users,PasswordEncoder encoder,JwtService jwt){this.users=users;this.encoder=encoder;this.jwt=jwt;}
    public AuthModels.AuthResponse register(AuthModels.RegisterRequest req){if(users.findByEmailIgnoreCase(req.email()).isPresent()) throw new IllegalArgumentException("An account with this email already exists.");var u=users.save(new User(req.email().toLowerCase(),encoder.encode(req.password()),req.name()));return response(u);}
    public AuthModels.AuthResponse login(AuthModels.LoginRequest req){var u=users.findByEmailIgnoreCase(req.email()).orElseThrow(()->new IllegalArgumentException("Invalid email or password."));if(!encoder.matches(req.password(),u.getPasswordHash())) throw new IllegalArgumentException("Invalid email or password.");return response(u);}
    private AuthModels.AuthResponse response(User u){return new AuthModels.AuthResponse(jwt.accessToken(u),"local-refresh-placeholder",new AuthModels.UserView(u.getId(),u.getEmail(),u.getName()));}
    public User user(UUID id){return users.findById(id).orElseThrow(()->new IllegalArgumentException("User not found."));}
}
