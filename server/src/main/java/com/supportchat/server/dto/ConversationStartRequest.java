package com.supportchat.server.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ConversationStartRequest(
        @NotBlank String customerName,
        @NotBlank @Email String customerEmail,
        @NotBlank String initialMessage) {
}
