package com.supportchat.server.controller;

import com.supportchat.server.dto.MessageCreateRequest;
import com.supportchat.server.dto.MessageResponse;
import com.supportchat.server.service.MessageService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @PostMapping("/messages")
    public ResponseEntity<MessageResponse> send(@Valid @RequestBody MessageCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(messageService.send(request));
    }

    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<MessageResponse>> history(@PathVariable UUID id) {
        return ResponseEntity.ok(messageService.history(id));
    }
}
