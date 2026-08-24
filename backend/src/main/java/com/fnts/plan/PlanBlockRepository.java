package com.fnts.plan;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlanBlockRepository extends JpaRepository<PlanBlock, Long> {

    /** A day's plan, in the order it happens; id breaks ties on equal times. */
    List<PlanBlock> findByUserIdAndPlanDateOrderByEndMinuteAscIdAsc(Long userId, LocalDate planDate);

    Optional<PlanBlock> findByIdAndUserId(Long id, Long userId);

    long countByUserIdAndPlanDate(Long userId, LocalDate planDate);

    /** The user's own blocks among a set of ids — anyone else's simply miss. */
    List<PlanBlock> findByIdInAndUserId(Collection<Long> ids, Long userId);

    /** The last day the user actually planned — the one worth copying from. */
    @Query("select max(b.planDate) from PlanBlock b "
            + "where b.user.id = :userId and b.planDate < :before")
    Optional<LocalDate> findLastPlannedDateBefore(@Param("userId") Long userId,
                                                  @Param("before") LocalDate before);
}
