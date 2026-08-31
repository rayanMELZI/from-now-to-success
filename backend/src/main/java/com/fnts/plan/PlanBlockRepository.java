package com.fnts.plan;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
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

    /**
     * Every day the user has actually planned, most recent first — the days
     * worth copying from. Later days count too: a routine written for tomorrow
     * is as good a source as yesterday's.
     */
    @Query("select b.planDate from PlanBlock b "
            + "where b.user.id = :userId and b.planDate <> :exclude "
            + "group by b.planDate order by b.planDate desc")
    List<LocalDate> findPlannedDates(@Param("userId") Long userId,
                                     @Param("exclude") LocalDate exclude,
                                     Pageable pageable);
}
