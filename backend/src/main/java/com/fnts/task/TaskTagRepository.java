package com.fnts.task;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskTagRepository extends JpaRepository<TaskTag, Long> {

    /** The user's tags in the order they were made. */
    List<TaskTag> findByUserIdOrderByIdAsc(Long userId);

    Optional<TaskTag> findByIdAndUserId(Long id, Long userId);

    /** Only the ones the user owns: someone else's tag ids are silently dropped. */
    List<TaskTag> findByUserIdAndIdIn(Long userId, Collection<Long> ids);

    long countByUserId(Long userId);
}
