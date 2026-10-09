package com.supportchat.server.repository;

import com.supportchat.server.beans.Agent;
import com.supportchat.server.enums.AgentStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentRepository extends JpaRepository<Agent, UUID> {

    Optional<Agent> findByEmail(String email);

    boolean existsByEmail(String email);

    List<Agent> findByStatus(AgentStatus status);

    List<Agent> findAllByOrderByCreatedAtAsc();
}
