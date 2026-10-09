package com.supportchat.server.controller;

import com.supportchat.server.dto.ConversationResponse;
import com.supportchat.server.dto.ConversationStartRequest;
import com.supportchat.server.dto.ConversationStartResponse;
import com.supportchat.server.service.ConversationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping("/start")
    public ResponseEntity<ConversationStartResponse> start(@Valid @RequestBody ConversationStartRequest request) {
        return ResponseEntity.ok(conversationService.start(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ConversationResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(conversationService.findById(id));
    }

    @GetMapping("/customer/{customerId}")
    public ResponseEntity<List<ConversationResponse>> findByCustomer(@PathVariable UUID customerId) {
        return ResponseEntity.ok(conversationService.findByCustomer(customerId));
    }

    @GetMapping
    public ResponseEntity<List<ConversationResponse>> findAll() {
        return ResponseEntity.ok(conversationService.findAll());
    }

    @GetMapping("/agent/{agentId}")
    public ResponseEntity<List<ConversationResponse>> findByAgent(@PathVariable UUID agentId) {
        return ResponseEntity.ok(conversationService.findByAgent(agentId));
    }

    @GetMapping("/unassigned")
    public ResponseEntity<List<ConversationResponse>> findUnassigned() {
        return ResponseEntity.ok(conversationService.findUnassigned());
    }

    @PatchMapping("/{id}/close")
    public ResponseEntity<ConversationResponse> close(@PathVariable UUID id) {
        return ResponseEntity.ok(conversationService.close(id));
    }

    @PatchMapping("/{id}/reopen")
    public ResponseEntity<ConversationResponse> reopen(@PathVariable UUID id) {
        return ResponseEntity.ok(conversationService.reopen(id));
    }

    @PatchMapping("/{id}/reassign/{agentId}")
    public ResponseEntity<ConversationResponse> reassign(@PathVariable UUID id, @PathVariable UUID agentId) {
        return ResponseEntity.ok(conversationService.reassign(id, agentId));
    }
}
