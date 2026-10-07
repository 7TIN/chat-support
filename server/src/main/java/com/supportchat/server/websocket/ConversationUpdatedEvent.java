package com.supportchat.server.websocket;

import java.util.UUID;

public record ConversationUpdatedEvent(UUID conversationId) {
}
