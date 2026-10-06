package com.supportchat.server.dto;

import com.supportchat.server.beans.Message;
import com.supportchat.server.enums.SenderType;
import java.time.Instant;
import java.util.UUID;

public record MessageResponse(
        UUID id, UUID conversationId, SenderType sender, String content, Instant createdAt) {

    public static MessageResponse from(Message message) {
        return new MessageResponse(
                message.getId(),
                message.getConversation().getId(),
                message.getSender(),
                message.getContent(),
                message.getCreatedAt());
    }
}
