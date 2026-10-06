package com.supportchat.server.controller;

import com.supportchat.server.dto.AgentCreateRequest;
import com.supportchat.server.dto.AgentResponse;
import com.supportchat.server.dto.AgentStatusUpdateRequest;
import com.supportchat.server.service.AgentService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agents")
public class AgentController {

    private final AgentService agentService;

    public AgentController(AgentService agentService) {
        this.agentService = agentService;
    }

    @PostMapping
    public ResponseEntity<AgentResponse> create(@Valid @RequestBody AgentCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(agentService.create(request));
    }

    @GetMapping
    public ResponseEntity<List<AgentResponse>> findAll() {
        return ResponseEntity.ok(agentService.findAll());
    }

    @GetMapping("/available")
    public ResponseEntity<List<AgentResponse>> findAvailable() {
        return ResponseEntity.ok(agentService.findAvailable());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AgentResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(agentService.findById(id));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AgentResponse> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody AgentStatusUpdateRequest request) {
        return ResponseEntity.ok(agentService.updateStatus(id, request.status()));
    }
}
