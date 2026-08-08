package com.nexus.chat;

import jakarta.validation.Valid; import jakarta.validation.constraints.NotBlank; import org.springframework.jdbc.core.JdbcTemplate; import org.springframework.messaging.handler.annotation.MessageMapping; import org.springframework.messaging.handler.annotation.SendTo; import org.springframework.stereotype.Controller; import org.springframework.web.bind.annotation.*; import java.time.Instant; import java.util.*;

@RestController @RequestMapping("/api")
public class ChatController {
 private final JdbcTemplate db; public ChatController(JdbcTemplate db){this.db=db;}
 record CreateChannel(@NotBlank String name,UUID teamId,String type){} record SendMessage(@NotBlank String content,UUID parentId){}
 @GetMapping("/orgs/{orgId}/channels") public List<Map<String,Object>> channels(@PathVariable UUID orgId,org.springframework.security.core.Authentication a){member(orgId,a);return db.queryForList("SELECT id,name,type,team_id FROM chat.channels WHERE organization_id=? AND deleted_at IS NULL ORDER BY name",orgId);}
 @PostMapping("/orgs/{orgId}/channels") public Map<String,Object> channel(@PathVariable UUID orgId,@Valid @RequestBody CreateChannel r,org.springframework.security.core.Authentication a){member(orgId,a);UUID id=UUID.randomUUID();db.update("INSERT INTO chat.channels(id,organization_id,team_id,name,type) VALUES(?,?,?,?,?)",id,orgId,r.teamId(),r.name(),Objects.toString(r.type(),"PUBLIC"));return Map.of("id",id,"name",r.name(),"type",Objects.toString(r.type(),"PUBLIC"));}
 @GetMapping("/channels/{channelId}/messages") public List<Map<String,Object>> messages(@PathVariable UUID channelId,org.springframework.security.core.Authentication a){UUID org=org();member(channelOrg(channelId),a);return db.queryForList("SELECT m.id,m.content,m.sender_id,m.parent_id,m.created_at,u.name sender_name FROM chat.messages m JOIN nexus_auth.users u ON u.id=m.sender_id WHERE m.channel_id=? AND m.deleted_at IS NULL ORDER BY m.created_at",channelId);}
 @PostMapping("/channels/{channelId}/messages") public Map<String,Object> send(@PathVariable UUID channelId,@Valid @RequestBody SendMessage r,org.springframework.security.core.Authentication a){UUID user=UUID.fromString(a.getName()),org=channelOrg(channelId);member(org,a);UUID id=UUID.randomUUID();db.update("INSERT INTO chat.messages(id,channel_id,organization_id,sender_id,content,parent_id) VALUES(?,?,?,?,?,?)",id,channelId,org,user,r.content(),r.parentId());return db.queryForMap("SELECT m.id,m.content,m.sender_id,m.parent_id,m.created_at,u.name sender_name FROM chat.messages m JOIN nexus_auth.users u ON u.id=m.sender_id WHERE m.id=?",id);}
 private UUID channelOrg(UUID id){return db.queryForObject("SELECT organization_id FROM chat.channels WHERE id=? AND deleted_at IS NULL",UUID.class,id);}
 private void member(UUID org,org.springframework.security.core.Authentication a){if(db.queryForObject("SELECT count(*) FROM org.memberships WHERE organization_id=? AND user_id=?",Integer.class,org,UUID.fromString(a.getName()))==0)throw new SecurityException("You do not have access to this workspace.");}
 private UUID org(){return UUID.randomUUID();}
}

@Controller
class ChatWebSocketController {
 private final org.springframework.messaging.simp.SimpMessagingTemplate messages; private final JdbcTemplate db;
 ChatWebSocketController(org.springframework.messaging.simp.SimpMessagingTemplate messages,JdbcTemplate db){this.messages=messages;this.db=db;}
 @MessageMapping("/chat/{channelId}")
 public void broadcast(@org.springframework.messaging.handler.annotation.DestinationVariable UUID channelId,Map<String,Object> payload,java.security.Principal principal){if(principal==null)throw new SecurityException("Authenticated WebSocket access is required.");UUID user=UUID.fromString(principal.getName());UUID org=db.queryForObject("SELECT organization_id FROM chat.channels WHERE id=? AND deleted_at IS NULL",UUID.class,channelId);if(db.queryForObject("SELECT count(*) FROM org.memberships WHERE organization_id=? AND user_id=?",Integer.class,org,user)==0)throw new SecurityException("You do not have access to this channel.");UUID id=UUID.randomUUID();String content=Objects.toString(payload.get("content"),"").trim();if(content.isBlank())return;db.update("INSERT INTO chat.messages(id,channel_id,organization_id,sender_id,content) VALUES(?,?,?,?,?)",id,channelId,org,user,content);messages.convertAndSend("/topic/channel."+channelId,Map.of("id",id,"channelId",channelId,"organizationId",org,"senderId",user,"content",content,"createdAt",Instant.now().toString()));}
}
