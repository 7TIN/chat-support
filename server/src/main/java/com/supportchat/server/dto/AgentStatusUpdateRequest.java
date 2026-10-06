package com.supportchat.server.dto;

import com.supportchat.server.enums.AgentStatus;
import jakarta.validation.constraints.NotNull;

public record AgentStatusUpdateRequest(@NotNull AgentStatus status) {
}
