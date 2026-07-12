package com.fnts.habit;

import java.util.List;

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
import com.fnts.habit.HabitDtos.HabitRequest;
import com.fnts.habit.HabitDtos.HabitResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/habits")
public class HabitController {

    private final HabitService habitService;

    public HabitController(HabitService habitService) {
        this.habitService = habitService;
    }

    @GetMapping
    public List<HabitResponse> list(@AuthenticationPrincipal CurrentUser user) {
        return habitService.list(user.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HabitResponse create(@AuthenticationPrincipal CurrentUser user,
                                @Valid @RequestBody HabitRequest request) {
        return habitService.create(user.id(), request);
    }

    @PutMapping("/{id}")
    public HabitResponse update(@AuthenticationPrincipal CurrentUser user,
                                @PathVariable Long id,
                                @Valid @RequestBody HabitRequest request) {
        return habitService.update(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        habitService.delete(user.id(), id);
    }
}
