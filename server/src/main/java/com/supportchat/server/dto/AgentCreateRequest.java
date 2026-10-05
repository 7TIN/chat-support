package com.supportchat.server.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record AgentCreateRequest(
        @NotBlank String name,
        @NotBlank @Email String email) {
}
