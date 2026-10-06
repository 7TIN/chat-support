package com.supportchat.server.dto;

import com.supportchat.server.beans.Conversation;
import com.supportchat.server.enums.ConversationStatus;
import java.time.Instant;
import java.util.UUID;

public record ConversationResponse(
        UUID id,
        UUID customerId,
        UUID agentId,
        ConversationStatus status,
        Instant createdAt,
        Instant updatedAt) {

    public static ConversationResponse from(Conversation conversation) {
        return new ConversationResponse(
                conversation.getId(),
                conversation.getCustomer().getId(),
                conversation.getAgent() != null ? conversation.getAgent().getId() : null,
                conversation.getStatus(),
                conversation.getCreatedAt(),
                conversation.getUpdatedAt());
    }
}
