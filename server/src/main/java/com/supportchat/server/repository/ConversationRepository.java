package com.supportchat.server.repository;

import com.supportchat.server.beans.Conversation;
import com.supportchat.server.enums.ConversationStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    List<Conversation> findByCustomerIdOrderByUpdatedAtDesc(UUID customerId);

    Optional<Conversation> findFirstByCustomerIdAndStatusInOrderByUpdatedAtDesc(
            UUID customerId, Collection<ConversationStatus> statuses);

    List<Conversation> findByAgentIdOrderByUpdatedAtDesc(UUID agentId);

    List<Conversation> findByStatusOrderByUpdatedAtDesc(ConversationStatus status);

    long countByAgentIdAndStatus(UUID agentId, ConversationStatus status);
}
