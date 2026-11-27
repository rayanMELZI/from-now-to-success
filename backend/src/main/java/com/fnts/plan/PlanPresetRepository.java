package com.fnts.plan;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanPresetRepository extends JpaRepository<PlanPreset, Long> {

    /** Oldest first: a list the user built up keeps the order they built it in. */
    List<PlanPreset> findByUserIdOrderByIdAsc(Long userId);

    Optional<PlanPreset> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);
}
