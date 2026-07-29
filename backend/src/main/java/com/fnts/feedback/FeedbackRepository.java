package com.fnts.feedback;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FeedbackRepository extends JpaRepository<Feedback, Long> {

    List<Feedback> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Rows still owed a briefing email, oldest first. */
    List<Feedback> findByNotifiedAtIsNullOrderByCreatedAtAsc(Pageable pageable);

    /** Worthy rows whose GitHub issue hasn't been filed yet, oldest first. */
    List<Feedback> findByAiWorthDoingIsTrueAndGithubIssueUrlIsNullOrderByCreatedAtAsc(Pageable pageable);
}
