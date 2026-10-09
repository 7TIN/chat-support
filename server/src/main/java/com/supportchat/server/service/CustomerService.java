package com.supportchat.server.service;

import com.supportchat.server.beans.Customer;
import com.supportchat.server.dto.CustomerCreateRequest;
import com.supportchat.server.dto.CustomerResponse;
import com.supportchat.server.repository.CustomerRepository;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerService {

    private final CustomerRepository customers;

    public CustomerService(CustomerRepository customers) {
        this.customers = customers;
    }

    @Transactional
    public CustomerResponse create(CustomerCreateRequest request) {
        customers.findByEmail(request.email()).ifPresent(existing -> {
            throw new IllegalArgumentException("Customer already exists: " + request.email());
        });
        Customer saved = customers.save(new Customer(request.name(), request.email()));
        return CustomerResponse.from(saved);
    }

    @Transactional
    public CustomerResponse findOrCreate(CustomerCreateRequest request) {
        Customer customer = customers.findByEmail(request.email())
                .orElseGet(() -> customers.save(new Customer(request.name(), request.email())));
        return CustomerResponse.from(customer);
    }

    @Transactional(readOnly = true)
    public List<CustomerResponse> findAll() {
        return customers.findAll().stream().map(CustomerResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public CustomerResponse findById(UUID id) {
        Customer customer = customers.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Customer not found: " + id));
        return CustomerResponse.from(customer);
    }

    @Transactional(readOnly = true)
    public CustomerResponse findByEmail(String email) {
        return customers.findByEmail(email)
                .map(CustomerResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Customer not found: " + email));
    }
}
