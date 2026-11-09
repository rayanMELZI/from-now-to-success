package com.fnts.task;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fnts.checkin.Periods;
import com.fnts.common.ApiException;
import com.fnts.task.TaskDtos.TagRequest;
import com.fnts.task.TaskDtos.TagResponse;
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
    private final TaskTagRepository tagRepository;
    private final UserRepository userRepository;

    public TaskService(TaskRepository taskRepository, TaskTagRepository tagRepository,
                       UserRepository userRepository) {
        this.taskRepository = taskRepository;
        this.tagRepository = tagRepository;
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
        List<TagResponse> tags = tagRepository.findByUserIdOrderByIdAsc(userId)
                .stream()
                .map(TaskDtos::toResponse)
                .toList();
        return new TaskListResponse(Periods.logicalToday(user), open, done, tags);
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
        apply(userId, task, request);
        return TaskDtos.toResponse(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse update(Long userId, Long taskId, TaskRequest request) {
        Task task = getOwned(userId, taskId);
        apply(userId, task, request);
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

    @Transactional
    public TagResponse addTag(Long userId, TagRequest request) {
        User user = load(userId);
        if (tagRepository.countByUserId(userId) >= TaskDtos.MAX_TAGS) {
            throw ApiException.badRequest("You can have at most " + TaskDtos.MAX_TAGS + " tags");
        }
        TaskTag tag = new TaskTag();
        tag.setUser(user);
        applyTag(userId, tag, request);
        return TaskDtos.toResponse(tagRepository.save(tag));
    }

    /** Renaming or recolouring shows on every task that carries the tag. */
    @Transactional
    public TagResponse updateTag(Long userId, Long tagId, TagRequest request) {
        TaskTag tag = getOwnedTag(userId, tagId);
        applyTag(userId, tag, request);
        return TaskDtos.toResponse(tag);
    }

    /** Takes the tag off every task (the links go with it), then drops it. */
    @Transactional
    public void deleteTag(Long userId, Long tagId) {
        tagRepository.delete(getOwnedTag(userId, tagId));
    }

    public Task getOwned(Long userId, Long taskId) {
        return taskRepository.findByIdAndUserId(taskId, userId)
                .orElseThrow(() -> ApiException.notFound("Task not found"));
    }

    private void apply(Long userId, Task task, TaskRequest request) {
        task.setTitle(request.title().trim());
        task.setDueDate(request.dueDate());
        if (request.tagIds() != null) {
            List<TaskTag> tags = request.tagIds().isEmpty()
                    ? List.of()
                    : tagRepository.findByUserIdAndIdIn(userId, request.tagIds());
            task.setTags(new LinkedHashSet<>(tags));
        }
    }

    /** Names are encrypted, so uniqueness is checked here rather than by an index. */
    private void applyTag(Long userId, TaskTag tag, TagRequest request) {
        String name = request.name().trim();
        boolean taken = tagRepository.findByUserIdOrderByIdAsc(userId).stream()
                .anyMatch(other -> !other.getId().equals(tag.getId())
                        && other.getName().equalsIgnoreCase(name));
        if (taken) {
            throw ApiException.conflict("You already have a tag called \"" + name + "\"");
        }
        tag.setName(name);
        tag.setColor(request.color());
    }

    private TaskTag getOwnedTag(Long userId, Long tagId) {
        return tagRepository.findByIdAndUserId(tagId, userId)
                .orElseThrow(() -> ApiException.notFound("Tag not found"));
    }

    private User load(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
