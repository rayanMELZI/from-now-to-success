package com.fnts.task;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class TaskDtos {

    /** Open tasks a user can hold at once; the cap keeps one list bounded. */
    public static final int MAX_OPEN_TASKS = 200;

    public record TaskRequest(
            @NotBlank @Size(max = 120) String title,
            /** The day it should be done by; null for no deadline. */
            LocalDate dueDate) {}

    public record DoneRequest(@NotNull Boolean done) {}

    public record TaskResponse(
            Long id,
            String title,
            LocalDate dueDate,
            boolean done) {}

    public record TaskListResponse(
            /** The user's logical today, so the client can say "overdue". */
            LocalDate today,
            /** Still to do: deadlines first (soonest on top), then the rest oldest first. */
            List<TaskResponse> open,
            /** Recently finished, most recent first. */
            List<TaskResponse> done) {}

    public static TaskResponse toResponse(Task task) {
        return new TaskResponse(task.getId(), task.getTitle(), task.getDueDate(), task.isDone());
    }

    private TaskDtos() {}
}
