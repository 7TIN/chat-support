package com.supportchat.server.websocket;

import tools.jackson.databind.ObjectMapper;
import com.supportchat.server.beans.Conversation;
import com.supportchat.server.dto.ConversationResponse;
import com.supportchat.server.dto.MessageCreateRequest;
import com.supportchat.server.dto.MessageResponse;
import com.supportchat.server.enums.SenderType;
import com.supportchat.server.repository.ConversationRepository;
import com.supportchat.server.service.MessageService;
import jakarta.persistence.EntityNotFoundException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private record Incoming(UUID conversationId, SenderType sender, String content) {
    }

    private final MessageService messageService;
    private final ConversationRepository conversations;
    private final ObjectMapper objectMapper;
    private final Map<String, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    public ChatWebSocketHandler(
            MessageService messageService,
            ConversationRepository conversations,
            ObjectMapper objectMapper) {
        this.messageService = messageService;
        this.conversations = conversations;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String roomId = queryParam(session, "conversationId");
        if (roomId == null || roomId.isBlank()) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("conversationId query param required"));
            return;
        }
        try {
            UUID.fromString(roomId);
        } catch (IllegalArgumentException e) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("invalid conversationId"));
            return;
        }
        session.getAttributes().put("roomId", roomId);
        rooms.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String roomId = (String) session.getAttributes().get("roomId");
        if (roomId == null) {
            return;
        }
        final Incoming in;
        try {
            in = objectMapper.readValue(message.getPayload(), Incoming.class);
        } catch (Exception e) {
            sendTo(session, Map.of("type", "error", "message", "Invalid message format"));
            return;
        }
        if (in.conversationId() == null || !roomId.equals(in.conversationId().toString())) {
            sendTo(session, Map.of("type", "error", "message", "conversationId mismatch"));
            return;
        }
        if (in.sender() == null || in.content() == null || in.content().isBlank()) {
            sendTo(session, Map.of("type", "error", "message", "sender and non-blank content required"));
            return;
        }
        try {
            MessageResponse saved = messageService.send(
                    new MessageCreateRequest(in.conversationId(), in.sender(), in.content()));
            broadcast(roomId, Map.of("type", "message", "message", saved));
        } catch (EntityNotFoundException | IllegalStateException | IllegalArgumentException e) {
            sendTo(session, Map.of("type", "error", "message", e.getMessage()));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = (String) session.getAttributes().get("roomId");
        if (roomId != null) {
            Set<WebSocketSession> room = rooms.get(roomId);
            if (room != null) {
                room.remove(session);
                if (room.isEmpty()) {
                    rooms.remove(roomId);
                }
            }
        }
    }

    @EventListener
    public void onConversationUpdated(ConversationUpdatedEvent event) {
        String roomId = event.conversationId().toString();
        conversations.findById(event.conversationId()).ifPresent(conversation ->
                broadcast(roomId, Map.of("type", "status", "conversation", ConversationResponse.from(conversation))));
    }

    private void broadcast(String roomId, Map<String, Object> payload) {
        Set<WebSocketSession> room = rooms.get(roomId);
        if (room == null || room.isEmpty()) {
            return;
        }
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            return;
        }
        TextMessage message = new TextMessage(json);
        for (WebSocketSession session : room) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(message);
                } catch (Exception ignored) {
                }
            }
        }
    }

    private void sendTo(WebSocketSession session, Map<String, String> payload) {
        try {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
        } catch (Exception ignored) {
        }
    }

    private static String queryParam(WebSocketSession session, String name) {
        if (session.getUri() == null || session.getUri().getQuery() == null) {
            return null;
        }
        for (String part : session.getUri().getQuery().split("&")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2 && kv[0].equals(name)) {
                return kv[1];
            }
        }
        return null;
    }
}
