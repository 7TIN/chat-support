package com.supportchat.server.service;

import com.supportchat.server.beans.Conversation;
import com.supportchat.server.beans.Message;
import com.supportchat.server.dto.MessageCreateRequest;
import com.supportchat.server.dto.MessageResponse;
import com.supportchat.server.enums.ConversationStatus;
import com.supportchat.server.repository.ConversationRepository;
import com.supportchat.server.repository.MessageRepository;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MessageService {

    private final MessageRepository messages;
    private final ConversationRepository conversations;

    public MessageService(MessageRepository messages, ConversationRepository conversations) {
        this.messages = messages;
        this.conversations = conversations;
    }

    @Transactional
    public MessageResponse send(MessageCreateRequest request) {
        Conversation conversation = conversations.findById(request.conversationId())
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found: " + request.conversationId()));
        if (conversation.getStatus() == ConversationStatus.CLOSED) {
            throw new IllegalStateException("Conversation is closed");
        }
        Message saved = messages.save(new Message(conversation, request.sender(), request.content()));
        return MessageResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> history(UUID conversationId) {
        if (!conversations.existsById(conversationId)) {
            throw new EntityNotFoundException("Conversation not found: " + conversationId);
        }
        return messages.findByConversationIdOrderByCreatedAtAsc(conversationId).stream()
                .map(MessageResponse::from).toList();
    }
}
