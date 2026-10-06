package com.supportchat.server.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ConversationCreateRequest(@NotNull UUID customerId) {
}
