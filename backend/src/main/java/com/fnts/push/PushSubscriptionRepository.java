package com.fnts.push;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.fnts.user.User;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    List<PushSubscription> findByUserId(Long userId);

    void deleteByEndpointAndUserId(String endpoint, Long userId);

    @Query("SELECT DISTINCT s.user FROM PushSubscription s")
    List<User> findUsersWithSubscriptions();
}
