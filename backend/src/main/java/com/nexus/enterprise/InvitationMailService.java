package com.nexus.enterprise;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.UUID;

@Service
public class InvitationMailService {
    private final ObjectProvider<JavaMailSender> sender;
    private final String from;
    private final String appUrl;
    public InvitationMailService(ObjectProvider<JavaMailSender> sender,
                                 @Value("${SMTP_FROM_EMAIL:}") String from,
                                 @Value("${FRONTEND_ORIGIN:http://localhost:3000}") String appUrl) { this.sender=sender; this.from=from; this.appUrl=appUrl; }
    public boolean send(String email, String organizationName) {
        JavaMailSender mail=sender.getIfAvailable();
        if(mail==null||from.isBlank()) return false;
        SimpleMailMessage message=new SimpleMailMessage(); message.setFrom(from); message.setTo(email); message.setSubject("You have been invited to "+organizationName+" on Nexus"); message.setText("You have been invited to join "+organizationName+" on Nexus. Sign in or create your account at "+appUrl+"/login."); mail.send(message); return true;
    }

    public boolean configured() {
        return sender.getIfAvailable() != null && !from.isBlank();
    }

    public int sendDocument(Collection<String> recipients, String organizationName, String title, UUID documentId, String sharedBy) {
        JavaMailSender mail = sender.getIfAvailable();
        if (mail == null || from.isBlank()) return 0;
        int sent = 0;
        for (String recipient : recipients.stream().filter(value -> value != null && !value.isBlank()).distinct().toList()) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(from);
                message.setTo(recipient);
                message.setSubject(sharedBy + " shared “" + title + "” in " + organizationName);
                message.setText(sharedBy + " shared the Nexus document “" + title + "” with your team.\n\nOpen it at " + appUrl + "/documents?document=" + documentId + "\n\nAccess is controlled by your Nexus workspace membership.");
                mail.send(message);
                sent++;
            } catch (RuntimeException ignored) {
                // Continue notifying the remaining authorized members.
            }
        }
        return sent;
    }
}
