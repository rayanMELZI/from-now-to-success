package com.fnts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.fnts.task.Task;

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
}
