package com.nexus.auth;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="users", schema="nexus_auth")
public class User {
    @Id private UUID id; @Column(nullable=false,unique=true) private String email; @Column(name="password_hash",nullable=false) private String passwordHash; @Column(nullable=false) private String name; @Column(name="clerk_id",unique=true) private String clerkId;
    @Column(name="created_at",nullable=false) private Instant createdAt; @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected User() {}
    public User(String email,String passwordHash,String name){this.id=UUID.randomUUID();this.email=email;this.passwordHash=passwordHash;this.name=name;this.createdAt=Instant.now();this.updatedAt=this.createdAt;}
    public User(String email,String passwordHash,String name,String clerkId){this(email,passwordHash,name);this.clerkId=clerkId;}
    public UUID getId(){return id;} public String getEmail(){return email;} public String getPasswordHash(){return passwordHash;} public String getName(){return name;}
    public String getClerkId(){return clerkId;}
}
