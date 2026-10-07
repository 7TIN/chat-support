package com.supportchat.server.service;

import com.supportchat.server.beans.Agent;
import com.supportchat.server.beans.Conversation;
import com.supportchat.server.beans.Customer;
import com.supportchat.server.beans.Message;
import com.supportchat.server.dto.ConversationResponse;
import com.supportchat.server.dto.ConversationStartRequest;
import com.supportchat.server.enums.AgentStatus;
import com.supportchat.server.enums.ConversationStatus;
import com.supportchat.server.enums.SenderType;
import com.supportchat.server.repository.AgentRepository;
import com.supportchat.server.repository.ConversationRepository;
import com.supportchat.server.repository.CustomerRepository;
import com.supportchat.server.repository.MessageRepository;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ConversationService {

    private static final Set<ConversationStatus> ACTIVE =
            Set.of(ConversationStatus.OPEN, ConversationStatus.PENDING);

    private final ConversationRepository conversations;
    private final CustomerRepository customers;
    private final AgentRepository agents;
    private final MessageRepository messages;

    public ConversationService(
            ConversationRepository conversations,
            CustomerRepository customers,
            AgentRepository agents,
            MessageRepository messages) {
        this.conversations = conversations;
        this.customers = customers;
        this.agents = agents;
        this.messages = messages;
    }

    @Transactional
    public ConversationResponse start(ConversationStartRequest request) {
        Customer customer = customers.findByEmail(request.customerEmail())
                .orElseGet(() -> customers.save(new Customer(request.customerName(), request.customerEmail())));

        return conversations
                .findFirstByCustomerIdAndStatusInOrderByUpdatedAtDesc(customer.getId(), ACTIVE)
                .map(existing -> {
                    messages.save(new Message(existing, SenderType.CUSTOMER, request.initialMessage()));
                    return ConversationResponse.from(existing);
                })
                .orElseGet(() -> {
                    Agent assigned = pickLeastLoadedOnlineAgent();
                    ConversationStatus status =
                            assigned == null ? ConversationStatus.PENDING : ConversationStatus.OPEN;
                    Conversation created = conversations.save(new Conversation(customer, assigned, status));
                    messages.save(new Message(created, SenderType.CUSTOMER, request.initialMessage()));
                    return ConversationResponse.from(created);
                });
    }

    @Transactional(readOnly = true)
    public ConversationResponse findById(UUID id) {
        return conversations.findById(id)
                .map(ConversationResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> findByCustomer(UUID customerId) {
        return conversations.findByCustomerIdOrderByUpdatedAtDesc(customerId).stream()
                .map(ConversationResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> findByAgent(UUID agentId) {
        return conversations.findByAgentIdOrderByUpdatedAtDesc(agentId).stream()
                .map(ConversationResponse::from).toList();
    }

    @Transactional
    public ConversationResponse close(UUID id) {
        Conversation conversation = conversations.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found: " + id));
        conversation.setStatus(ConversationStatus.CLOSED);
        return ConversationResponse.from(conversation);
    }

    @Transactional
    public ConversationResponse reopen(UUID id) {
        Conversation conversation = conversations.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found: " + id));
        if (conversation.getStatus() != ConversationStatus.CLOSED) {
            throw new IllegalStateException("Only a closed conversation can be reopened");
        }
        conversation.setStatus(
                conversation.getAgent() == null ? ConversationStatus.PENDING : ConversationStatus.OPEN);
        return ConversationResponse.from(conversation);
    }

    @Transactional
    public ConversationResponse reassign(UUID id, UUID agentId) {
        Conversation conversation = conversations.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found: " + id));
        Agent agent = agents.findById(agentId)
                .orElseThrow(() -> new EntityNotFoundException("Agent not found: " + agentId));
        conversation.setAgent(agent);
        if (conversation.getStatus() == ConversationStatus.CLOSED) {
            conversation.setStatus(ConversationStatus.OPEN);
        } else if (agent.getStatus() == AgentStatus.ONLINE) {
            conversation.setStatus(ConversationStatus.OPEN);
        }
        return ConversationResponse.from(conversation);
    }

    private Agent pickLeastLoadedOnlineAgent() {
        List<Agent> online = agents.findByStatus(AgentStatus.ONLINE);
        Agent best = null;
        long bestLoad = Long.MAX_VALUE;
        for (Agent agent : online) {
            long load = conversations.countByAgentIdAndStatus(agent.getId(), ConversationStatus.OPEN);
            if (load < bestLoad) {
                bestLoad = load;
                best = agent;
            }
        }
        return best;
    }
}
