package com.supportchat.server.repository;

import com.supportchat.server.beans.Customer;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    Optional<Customer> findByEmail(String email);

    boolean existsByEmail(String email);
}
