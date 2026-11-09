package com.fnts.task;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class TaskDtos {

    /** Open tasks a user can hold at once; the cap keeps one list bounded. */
    public static final int MAX_OPEN_TASKS = 200;

    /** Tags a user can define, and how many one task can carry. */
    public static final int MAX_TAGS = 30;
    public static final int MAX_TAGS_PER_TASK = 5;

    /** The palette a tag picks from; the client maps each name to its shades. */
    public static final String TAG_COLORS =
            "gray|red|orange|amber|green|teal|sky|indigo|violet|pink";

    public record TaskRequest(
            @NotBlank @Size(max = 120) String title,
            /** The day it should be done by; null for no deadline. */
            LocalDate dueDate,
            /** Its tags; null leaves them as they are (none for a new task). */
            @Size(max = MAX_TAGS_PER_TASK) List<@NotNull Long> tagIds) {}

    public record TagRequest(
            @NotBlank @Size(max = 24) String name,
            @NotNull @Pattern(regexp = TAG_COLORS, message = "Unknown tag colour") String color) {}

    public record TagResponse(Long id, String name, String color) {}

    public record DoneRequest(@NotNull Boolean done) {}

    public record TaskResponse(
            Long id,
            String title,
            LocalDate dueDate,
            boolean done,
            /** In the order the tags were made, so chips never shuffle. */
            List<TagResponse> tags) {}

    public record TaskListResponse(
            /** The user's logical today, so the client can say "overdue". */
            LocalDate today,
            /** Still to do: deadlines first (soonest on top), then the rest oldest first. */
            List<TaskResponse> open,
            /** Recently finished, most recent first. */
            List<TaskResponse> done,
            /** Every tag the user has, oldest first. */
            List<TagResponse> tags) {}

    public static TaskResponse toResponse(Task task) {
        List<TagResponse> tags = task.getTags().stream()
                .sorted(Comparator.comparing(TaskTag::getId))
                .map(TaskDtos::toResponse)
                .toList();
        return new TaskResponse(task.getId(), task.getTitle(), task.getDueDate(), task.isDone(), tags);
    }

    public static TagResponse toResponse(TaskTag tag) {
        return new TagResponse(tag.getId(), tag.getName(), tag.getColor());
    }

    private TaskDtos() {}
}
