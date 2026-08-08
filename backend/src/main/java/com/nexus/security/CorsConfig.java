package com.nexus.security;

import org.springframework.context.annotation.Bean; import org.springframework.context.annotation.Configuration; import org.springframework.web.cors.CorsConfiguration; import org.springframework.web.cors.CorsConfigurationSource; import org.springframework.web.cors.UrlBasedCorsConfigurationSource; import java.util.List;

@Configuration public class CorsConfig {
 @Bean CorsConfigurationSource corsConfigurationSource(){var c=new CorsConfiguration();c.setAllowedOrigins(List.of("http://localhost:3000","http://127.0.0.1:3000"));c.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));c.setAllowedHeaders(List.of("Authorization","Content-Type"));var s=new UrlBasedCorsConfigurationSource();s.registerCorsConfiguration("/**",c);return s;}
}
