package com.fnts.checkin;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fnts.auth.CurrentUser;
import com.fnts.checkin.TimerDtos.FallRequest;
import com.fnts.checkin.TimerDtos.FallResult;
import com.fnts.checkin.TimerDtos.RunEntry;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/timers")
public class TimerController {

    private final TimerService timerService;

    public TimerController(TimerService timerService) {
        this.timerService = timerService;
    }

    /** "I fell": ends the current run and starts a fresh clock. */
    @PostMapping("/{habitId}/fall")
    public FallResult fall(@AuthenticationPrincipal CurrentUser user,
                           @PathVariable Long habitId,
                           @Valid @RequestBody(required = false) FallRequest request) {
        return timerService.fall(user.id(), habitId,
                request == null ? null : request.reason());
    }

    @GetMapping("/{habitId}/runs")
    public List<RunEntry> runs(@AuthenticationPrincipal CurrentUser user,
                               @PathVariable Long habitId) {
        return timerService.history(user.id(), habitId);
    }
}
