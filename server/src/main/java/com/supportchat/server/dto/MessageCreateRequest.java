package com.supportchat.server.dto;

import com.supportchat.server.enums.SenderType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record MessageCreateRequest(
        @NotNull UUID conversationId,
        @NotNull SenderType sender,
        @NotBlank String content) {
}
