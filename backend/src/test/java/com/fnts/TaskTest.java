package com.fnts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.fnts.task.Task;
import com.fnts.task.TaskDtos;
import com.fnts.task.TaskTag;

class TaskTest {

    @Test
    void tickingStampsTheMomentItWasFinished() {
        Task task = new Task();
        task.markDone(true);
        assertTrue(task.isDone());
        assertNotNull(task.getDoneAt());
    }

    @Test
    void untickingPutsItBackWithoutAFinishTime() {
        Task task = new Task();
        task.markDone(true);
        task.markDone(false);
        assertFalse(task.isDone());
        assertNull(task.getDoneAt());
    }

    @Test
    void tickingTwiceKeepsTheFirstFinishTime() {
        Task task = new Task();
        task.markDone(true);
        Instant first = task.getDoneAt();
        task.markDone(true);
        assertEquals(first, task.getDoneAt());
    }

    @Test
    void tagsComeBackInTheOrderTheyWereMade() {
        Task task = new Task();
        task.getTags().add(tag(7L, "errands", "sky"));
        task.getTags().add(tag(3L, "work", "red"));
        List<TaskDtos.TagResponse> tags = TaskDtos.toResponse(task).tags();
        assertEquals(List.of(3L, 7L), tags.stream().map(TaskDtos.TagResponse::id).toList());
        assertEquals("red", tags.get(0).color());
    }

    @Test
    void onlyPaletteColoursAreAccepted() {
        assertTrue("violet".matches(TaskDtos.TAG_COLORS));
        assertFalse("#ff0000".matches(TaskDtos.TAG_COLORS));
        assertFalse("redd".matches(TaskDtos.TAG_COLORS));
    }

    private static TaskTag tag(Long id, String name, String color) {
        TaskTag tag = new TaskTag();
        tag.setId(id);
        tag.setName(name);
        tag.setColor(color);
        return tag;
    }
}
