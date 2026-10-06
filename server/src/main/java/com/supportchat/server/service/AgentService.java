package com.supportchat.server.service;

import com.supportchat.server.beans.Agent;
import com.supportchat.server.dto.AgentCreateRequest;
import com.supportchat.server.dto.AgentResponse;
import com.supportchat.server.enums.AgentStatus;
import com.supportchat.server.repository.AgentRepository;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgentService {

    private final AgentRepository agents;

    public AgentService(AgentRepository agents) {
        this.agents = agents;
    }

    @Transactional
    public AgentResponse create(AgentCreateRequest request) {
        if (agents.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Agent already exists: " + request.email());
        }
        return AgentResponse.from(agents.save(new Agent(request.name(), request.email())));
    }

    @Transactional(readOnly = true)
    public AgentResponse findById(UUID id) {
        return AgentResponse.from(getOrThrow(id));
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
        return AgentResponse.from(agent);
    }

    private Agent getOrThrow(UUID id) {
        return agents.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Agent not found: " + id));
    }
}
