package com.nexus.security;

import com.nexus.auth.JwtService; import com.nexus.auth.User; import com.nexus.auth.UserRepository;
import jakarta.servlet.FilterChain; import jakarta.servlet.ServletException; import jakarta.servlet.http.*;
import org.springframework.context.annotation.*; import org.springframework.http.HttpMethod; import org.springframework.security.config.annotation.web.builders.HttpSecurity; import org.springframework.security.config.http.SessionCreationPolicy; import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder; import org.springframework.security.crypto.password.PasswordEncoder; import org.springframework.security.authentication.UsernamePasswordAuthenticationToken; import org.springframework.security.core.authority.SimpleGrantedAuthority; import org.springframework.security.core.userdetails.UserDetailsService; import org.springframework.security.core.userdetails.UsernameNotFoundException; import org.springframework.security.web.*; import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter; import org.springframework.stereotype.Component; import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException; import java.util.List;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder(){return new BCryptPasswordEncoder();}
    @Bean UserDetailsService unusedBasicAuthFallback(){return username -> {throw new UsernameNotFoundException(username);};}
    @Bean SecurityFilterChain security(HttpSecurity http,JwtFilter filter,ClerkJwtFilter clerkFilter)throws Exception{return http.csrf(c->c.disable()).cors(c->{}).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS)).authorizeHttpRequests(a->a.requestMatchers("/api/auth/**","/actuator/health/**","/v3/api-docs/**","/swagger-ui/**").permitAll().anyRequest().authenticated()).addFilterBefore(clerkFilter, UsernamePasswordAuthenticationFilter.class).addFilterBefore(filter, UsernamePasswordAuthenticationFilter.class).build();}
}

@Component class JwtFilter extends OncePerRequestFilter {
    private final JwtService jwt; JwtFilter(JwtService jwt){this.jwt=jwt;}
    protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException{var h=req.getHeader("Authorization");if(h!=null&&h.startsWith("Bearer ")){try{var id=jwt.parse(h.substring(7));var auth=new UsernamePasswordAuthenticationToken(id.toString(),null,List.of(new SimpleGrantedAuthority("ROLE_USER")));org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);}catch(Exception ignored){}}chain.doFilter(req,res);}
}

@Component
class ClerkJwtFilter extends OncePerRequestFilter {
    private final org.springframework.security.oauth2.jwt.JwtDecoder decoder; private final UserRepository users;
    ClerkJwtFilter(org.springframework.beans.factory.ObjectProvider<org.springframework.security.oauth2.jwt.JwtDecoder> decoder,UserRepository users){this.decoder=decoder.getIfAvailable();this.users=users;}
    protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException{
        if(org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication()!=null){chain.doFilter(req,res);return;}
        var h=req.getHeader("Authorization"); if(decoder!=null&&h!=null&&h.startsWith("Bearer ")){try{var token=decoder.decode(h.substring(7));var sub=token.getSubject();var email=claim(token,"email");if(email.isBlank())email=sub+"@clerk.local";var resolvedEmail=email;var u=users.findByClerkId(sub).orElseGet(()->users.findByEmailIgnoreCase(resolvedEmail).orElseGet(()->users.save(new User(resolvedEmail,"{clerk}"+java.util.UUID.randomUUID(),displayName(token),sub))));var auth=new UsernamePasswordAuthenticationToken(u.getId().toString(),null,List.of(new SimpleGrantedAuthority("ROLE_USER")));org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);}catch(Exception ignored){}}
        chain.doFilter(req,res);
    }
    private static String claim(org.springframework.security.oauth2.jwt.Jwt t,String name){var v=t.getClaimAsString(name);if(v==null&&"email".equals(name))v=t.getClaimAsString("email_address");return v==null?"":v;}
    private static String displayName(org.springframework.security.oauth2.jwt.Jwt t){var name=claim(t,"name");if(!name.isBlank())return name;String first=claim(t,"first_name"),last=claim(t,"last_name");var full=(first+" "+last).trim();return full.isBlank()?"Clerk user":full;}
}
