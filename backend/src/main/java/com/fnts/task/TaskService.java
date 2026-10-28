package com.fnts.task;

import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.checkin.Periods;
import com.fnts.common.ApiException;
import com.fnts.task.TaskDtos.TaskListResponse;
import com.fnts.task.TaskDtos.TaskRequest;
import com.fnts.task.TaskDtos.TaskResponse;
import com.fnts.user.User;
import com.fnts.user.UserRepository;

/**
 * The tasks list: one-off things to get done. Like the plan it holds no game
 * rules — nothing here touches points, gauges or streaks.
 */
@Service
public class TaskService {

    /** Deadlines first, soonest on top; undated tasks keep the order they were added in. */
    private static final Comparator<Task> OPEN_ORDER = Comparator
            .comparing(Task::getDueDate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(Task::getId);

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public TaskService(TaskRepository taskRepository, UserRepository userRepository) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public TaskListResponse list(Long userId) {
        User user = load(userId);
        List<TaskResponse> open = taskRepository.findByUserIdAndDoneFalseOrderByIdAsc(userId)
                .stream()
                .sorted(OPEN_ORDER)
                .map(TaskDtos::toResponse)
                .toList();
        List<TaskResponse> done = taskRepository.findTop50ByUserIdAndDoneTrueOrderByDoneAtDesc(userId)
                .stream()
                .map(TaskDtos::toResponse)
                .toList();
        return new TaskListResponse(Periods.logicalToday(user), open, done);
    }

    @Transactional
    public TaskResponse add(Long userId, TaskRequest request) {
        User user = load(userId);
        if (taskRepository.countByUserIdAndDoneFalse(userId) >= TaskDtos.MAX_OPEN_TASKS) {
            throw ApiException.badRequest(
                    "You can keep at most " + TaskDtos.MAX_OPEN_TASKS + " open tasks");
        }
        Task task = new Task();
        task.setUser(user);
        apply(task, request);
        return TaskDtos.toResponse(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse update(Long userId, Long taskId, TaskRequest request) {
        Task task = getOwned(userId, taskId);
        apply(task, request);
        return TaskDtos.toResponse(task);
    }

    @Transactional
    public TaskResponse setDone(Long userId, Long taskId, boolean done) {
        Task task = getOwned(userId, taskId);
        task.markDone(done);
        return TaskDtos.toResponse(task);
    }

    @Transactional
    public void delete(Long userId, Long taskId) {
        taskRepository.delete(getOwned(userId, taskId));
    }

    /** Empties the finished list; plan lines that stood for them keep their title. */
    @Transactional
    public void clearDone(Long userId) {
        taskRepository.deleteDone(userId);
    }

    public Task getOwned(Long userId, Long taskId) {
        return taskRepository.findByIdAndUserId(taskId, userId)
                .orElseThrow(() -> ApiException.notFound("Task not found"));
    }

    private void apply(Task task, TaskRequest request) {
        task.setTitle(request.title().trim());
        task.setDueDate(request.dueDate());
    }

    private User load(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
