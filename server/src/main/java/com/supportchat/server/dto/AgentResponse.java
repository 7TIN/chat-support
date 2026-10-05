package com.supportchat.server.dto;

import com.supportchat.server.beans.Agent;
import com.supportchat.server.enums.AgentStatus;
import java.time.Instant;
import java.util.UUID;

public record AgentResponse(UUID id, String name, String email, AgentStatus status, Instant createdAt) {

    public static AgentResponse from(Agent agent) {
        return new AgentResponse(
                agent.getId(),
                agent.getName(),
                agent.getEmail(),
                agent.getStatus(),
                agent.getCreatedAt());
    }
}
