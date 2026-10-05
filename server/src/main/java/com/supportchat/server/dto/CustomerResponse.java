package com.supportchat.server.dto;

import com.supportchat.server.beans.Customer;
import java.time.Instant;
import java.util.UUID;

public record CustomerResponse(UUID id, String name, String email, Instant createdAt) {

    public static CustomerResponse from(Customer customer) {
        return new CustomerResponse(
                customer.getId(),
                customer.getName(),
                customer.getEmail(),
                customer.getCreatedAt());
    }
}
