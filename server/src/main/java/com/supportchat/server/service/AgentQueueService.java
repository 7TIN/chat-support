package com.supportchat.server.service;

import com.supportchat.server.beans.Agent;
import com.supportchat.server.enums.AgentStatus;
import com.supportchat.server.repository.AgentRepository;
import jakarta.annotation.PostConstruct;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Fair turn-taking across agents. ONLINE agents rotate in the open queue,
 * BUSY agents rotate in the busy queue. Status changes reposition the agent:
 * ONLINE appends to the open queue end, BUSY to the busy queue end, OFFLINE
 * removes from both. Stale ids (deleted / changed tier) are dropped on read.
 */
@Component
public class AgentQueueService {

    private final AgentRepository agents;
    private final LinkedHashSet<UUID> openQueue = new LinkedHashSet<>();
    private final LinkedHashSet<UUID> busyQueue = new LinkedHashSet<>();

    public AgentQueueService(AgentRepository agents) {
        this.agents = agents;
    }

    @PostConstruct
    synchronized void seed() {
        for (Agent agent : agents.findAllByOrderByCreatedAtAsc()) {
            if (agent.getStatus() == AgentStatus.ONLINE) {
                openQueue.add(agent.getId());
            } else if (agent.getStatus() == AgentStatus.BUSY) {
                busyQueue.add(agent.getId());
            }
        }
    }

    public synchronized void markOnline(UUID id) {
        busyQueue.remove(id);
        openQueue.add(id);
    }

    public synchronized void markBusy(UUID id) {
        openQueue.remove(id);
        busyQueue.add(id);
    }

    public synchronized void markOffline(UUID id) {
        openQueue.remove(id);
        busyQueue.remove(id);
    }

    public synchronized void remove(UUID id) {
        markOffline(id);
    }

    public synchronized Optional<UUID> nextOnline() {
        return nextFrom(openQueue, AgentStatus.ONLINE);
    }

    public synchronized Optional<UUID> nextBusy() {
        return nextFrom(busyQueue, AgentStatus.BUSY);
    }

    private Optional<UUID> nextFrom(LinkedHashSet<UUID> queue, AgentStatus tier) {
        while (!queue.isEmpty()) {
            UUID id = queue.iterator().next();
            queue.remove(id);
            Optional<Agent> agent = agents.findById(id);
            if (agent.isPresent() && agent.get().getStatus() == tier) {
                queue.add(id);
                return Optional.of(id);
            }
        }
        return Optional.empty();
    }
}
