package com.fnts.task;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.fnts.auth.CurrentUser;
import com.fnts.task.TaskDtos.DoneRequest;
import com.fnts.task.TaskDtos.TaskListResponse;
import com.fnts.task.TaskDtos.TaskRequest;
import com.fnts.task.TaskDtos.TaskResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public TaskListResponse list(@AuthenticationPrincipal CurrentUser user) {
        return taskService.list(user.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse add(@AuthenticationPrincipal CurrentUser user,
                            @Valid @RequestBody TaskRequest request) {
        return taskService.add(user.id(), request);
    }

    @PutMapping("/{id}")
    public TaskResponse update(@AuthenticationPrincipal CurrentUser user,
                               @PathVariable Long id,
                               @Valid @RequestBody TaskRequest request) {
        return taskService.update(user.id(), id, request);
    }

    @PutMapping("/{id}/done")
    public TaskResponse setDone(@AuthenticationPrincipal CurrentUser user,
                                @PathVariable Long id,
                                @Valid @RequestBody DoneRequest request) {
        return taskService.setDone(user.id(), id, request.done());
    }

    /** Clears every finished task at once. */
    @DeleteMapping("/done")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearDone(@AuthenticationPrincipal CurrentUser user) {
        taskService.clearDone(user.id());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        taskService.delete(user.id(), id);
    }
}
