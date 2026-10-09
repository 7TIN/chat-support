package com.supportchat.server.service;

import com.supportchat.server.beans.Agent;
import com.supportchat.server.beans.Conversation;
import com.supportchat.server.beans.Customer;
import com.supportchat.server.beans.Message;
import com.supportchat.server.dto.AssignmentInfo;
import com.supportchat.server.dto.ConversationResponse;
import com.supportchat.server.dto.ConversationStartRequest;
import com.supportchat.server.dto.ConversationStartResponse;
import com.supportchat.server.enums.AgentStatus;
import com.supportchat.server.enums.ConversationStatus;
import com.supportchat.server.enums.SenderType;
import com.supportchat.server.repository.AgentRepository;
import com.supportchat.server.repository.ConversationRepository;
import com.supportchat.server.repository.CustomerRepository;
import com.supportchat.server.repository.MessageRepository;
import com.supportchat.server.websocket.ConversationUpdatedEvent;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
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
    private final AgentQueueService agentQueue;
    private final ApplicationEventPublisher events;

    public ConversationService(
            ConversationRepository conversations,
            CustomerRepository customers,
            AgentRepository agents,
            MessageRepository messages,
            AgentQueueService agentQueue,
            ApplicationEventPublisher events) {
        this.conversations = conversations;
        this.customers = customers;
        this.agents = agents;
        this.messages = messages;
        this.agentQueue = agentQueue;
        this.events = events;
    }

    @Transactional
    public ConversationStartResponse start(ConversationStartRequest request) {
        Customer customer = customers.findByEmail(request.customerEmail())
                .orElseGet(() -> customers.save(new Customer(request.customerName(), request.customerEmail())));

        Optional<Conversation> existing = conversations
                .findFirstByCustomerIdAndStatusInOrderByUpdatedAtDesc(customer.getId(), ACTIVE);
        if (existing.isPresent()) {
            Conversation conv = existing.get();
            messages.save(new Message(conv, SenderType.CUSTOMER, request.initialMessage()));
            Agent current = conv.getAgent();
            return new ConversationStartResponse(
                    ConversationResponse.from(conv),
                    new AssignmentInfo("CONTINUED", current == null ? null : current.getName()));
        }

        Optional<Agent> assigned = agentQueue.nextOnline()
                .flatMap(agents::findById)
                .or(() -> agentQueue.nextBusy().flatMap(agents::findById));
        Agent agent = null;
        String tier = "QUEUED";
        if (assigned.isPresent()) {
            agent = assigned.get();
            tier = agent.getStatus() == AgentStatus.ONLINE ? "ONLINE" : "BUSY";
            occupy(agent);
        }
        ConversationStatus status = agent == null ? ConversationStatus.PENDING : ConversationStatus.OPEN;
        Conversation created = conversations.save(new Conversation(customer, agent, status));
        messages.save(new Message(created, SenderType.CUSTOMER, request.initialMessage()));
        return new ConversationStartResponse(
                ConversationResponse.from(created),
                new AssignmentInfo(tier, agent == null ? null : agent.getName()));
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
    public List<ConversationResponse> findAll() {
        return conversations.findAllByOrderByUpdatedAtDesc().stream()
                .map(ConversationResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> findUnassigned() {
        return conversations
                .findByAgentIdIsNullAndStatusInOrderByCreatedAtAsc(ACTIVE)
                .stream()
                .map(ConversationResponse::from).toList();
    }

    /**
     * Assigns waiting conversations (oldest first) in fair rotation: online
     * agents first, then the busy rotation so loaded agents share evenly.
     */
    @Transactional
    public void assignPending() {
        while (true) {
            List<Conversation> waiting =
                    conversations.findByStatusOrderByCreatedAtAsc(ConversationStatus.PENDING);
            if (waiting.isEmpty()) {
                return;
            }
            Optional<Agent> assigned = agentQueue.nextOnline()
                    .flatMap(agents::findById)
                    .or(() -> agentQueue.nextBusy().flatMap(agents::findById));
            if (assigned.isEmpty()) {
                return;
            }
            Conversation pending = waiting.get(0);
            pending.setAgent(assigned.get());
            pending.setStatus(ConversationStatus.OPEN);
            occupy(assigned.get());
            events.publishEvent(new ConversationUpdatedEvent(pending.getId()));
        }
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
        releaseIfFree(conversation.getAgent());
        events.publishEvent(new ConversationUpdatedEvent(conversation.getId()));
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
        events.publishEvent(new ConversationUpdatedEvent(conversation.getId()));
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
        occupy(agent);
        events.publishEvent(new ConversationUpdatedEvent(conversation.getId()));
        return ConversationResponse.from(conversation);
    }

    /**
     * An agent holding an open conversation is busy: ONLINE agents flip to
     * BUSY and move to the busy queue end. Manual claims stay allowed.
     */
    private void occupy(Agent agent) {
        if (agent.getStatus() == AgentStatus.ONLINE) {
            agent.setStatus(AgentStatus.BUSY);
        }
        agentQueue.markBusy(agent.getId());
    }

    /**
     * Frees an agent whose last open conversation just closed.
     */
    private void releaseIfFree(Agent agent) {
        if (agent != null
                && agent.getStatus() == AgentStatus.BUSY
                && conversations.countByAgentIdAndStatus(agent.getId(), ConversationStatus.OPEN) == 0) {
            agent.setStatus(AgentStatus.ONLINE);
            agentQueue.markOnline(agent.getId());
        }
    }
}
