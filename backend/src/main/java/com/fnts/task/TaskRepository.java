package com.fnts.task;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskRepository extends JpaRepository<Task, Long> {

    /** Everything still to do, oldest first; the service puts deadlines on top. */
    List<Task> findByUserIdAndDoneFalseOrderByIdAsc(Long userId);

    /** The latest finished tasks, most recently ticked first. */
    List<Task> findTop50ByUserIdAndDoneTrueOrderByDoneAtDesc(Long userId);

    Optional<Task> findByIdAndUserId(Long id, Long userId);

    long countByUserIdAndDoneFalse(Long userId);

    /** Clears the finished list in one statement; plan lines just lose their link. */
    @Modifying
    @Query("delete from Task t where t.user.id = :userId and t.done = true")
    int deleteDone(@Param("userId") Long userId);
}
