package com.supportchat.server.service;

import com.supportchat.server.beans.Agent;
import com.supportchat.server.beans.Conversation;
import com.supportchat.server.dto.AgentCreateRequest;
import com.supportchat.server.dto.AgentResponse;
import com.supportchat.server.enums.AgentStatus;
import com.supportchat.server.enums.ConversationStatus;
import com.supportchat.server.repository.AgentRepository;
import com.supportchat.server.repository.ConversationRepository;
import com.supportchat.server.websocket.ConversationUpdatedEvent;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgentService {

    private final AgentRepository agents;
    private final ConversationRepository conversations;
    private final ConversationService conversationService;
    private final AgentQueueService agentQueue;
    private final ApplicationEventPublisher events;

    public AgentService(
            AgentRepository agents,
            ConversationRepository conversations,
            ConversationService conversationService,
            AgentQueueService agentQueue,
            ApplicationEventPublisher events) {
        this.agents = agents;
        this.conversations = conversations;
        this.conversationService = conversationService;
        this.agentQueue = agentQueue;
        this.events = events;
    }

    @Transactional
    public AgentResponse create(AgentCreateRequest request) {
        if (agents.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Agent already exists: " + request.email());
        }
        AgentResponse created =
                AgentResponse.from(agents.save(new Agent(request.name(), request.email())));
        agentQueue.markOnline(created.id());
        conversationService.assignPending();
        return created;
    }

    @Transactional(readOnly = true)
    public AgentResponse findById(UUID id) {
        return AgentResponse.from(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public AgentResponse findByEmail(String email) {
        return agents.findByEmail(email)
                .map(AgentResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Agent not found: " + email));
    }

    @Transactional(readOnly = true)
    public List<AgentResponse> findAll() {
        return agents.findAll().stream().map(AgentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AgentResponse> findAvailable() {
        return agents.findByStatus(AgentStatus.ONLINE).stream().map(AgentResponse::from).toList();
    }

    @Transactional
    public AgentResponse updateStatus(UUID id, AgentStatus status) {
        Agent agent = getOrThrow(id);
        agent.setStatus(status);
        AgentResponse response = AgentResponse.from(agent);
        if (status == AgentStatus.ONLINE) {
            agentQueue.markOnline(id);
            conversationService.assignPending();
        } else if (status == AgentStatus.BUSY) {
            agentQueue.markBusy(id);
        } else {
            agentQueue.markOffline(id);
        }
        return response;
    }

    @Transactional
    public void delete(UUID id) {
        Agent agent = getOrThrow(id);
        for (Conversation conversation : conversations.findByAgentIdOrderByUpdatedAtDesc(id)) {
            conversation.setAgent(null);
            if (conversation.getStatus() == ConversationStatus.OPEN) {
                conversation.setStatus(ConversationStatus.PENDING);
            }
            events.publishEvent(new ConversationUpdatedEvent(conversation.getId()));
        }
        agents.delete(agent);
        agentQueue.remove(id);
        conversationService.assignPending();
    }

    private Agent getOrThrow(UUID id) {
        return agents.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Agent not found: " + id));
    }
}
