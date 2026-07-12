package com.fnts.checkin;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fnts.auth.CurrentUser;
import com.fnts.checkin.CheckinDtos.CheckinRequest;
import com.fnts.checkin.CheckinDtos.CheckinResult;
import com.fnts.checkin.CheckinDtos.HistoryDay;
import com.fnts.checkin.CheckinDtos.TodayResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/checkins")
public class CheckinController {

    private final CheckinService checkinService;

    public CheckinController(CheckinService checkinService) {
        this.checkinService = checkinService;
    }

    @GetMapping("/today")
    public TodayResponse today(@AuthenticationPrincipal CurrentUser user) {
        return checkinService.getToday(user.id());
    }

    @PostMapping
    public CheckinResult submit(@AuthenticationPrincipal CurrentUser user,
                                @Valid @RequestBody CheckinRequest request) {
        return checkinService.submit(user.id(), request);
    }

    @GetMapping("/history")
    public List<HistoryDay> history(@AuthenticationPrincipal CurrentUser user,
                                    @RequestParam(defaultValue = "30") int days) {
        return checkinService.history(user.id(), Math.min(Math.max(days, 1), 365));
    }
}
