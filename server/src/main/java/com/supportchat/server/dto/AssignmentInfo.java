package com.supportchat.server.dto;

/**
 * How a conversation start was resolved. Tier is one of CONTINUED (returning
 * customer), ONLINE (free agent found), BUSY (all free agents busy, assigned
 * to next in the busy rotation), QUEUED (nobody available, waiting).
 */
public record AssignmentInfo(String tier, String agentName) {
}
