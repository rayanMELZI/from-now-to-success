package com.fnts.plan;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.fnts.auth.CurrentUser;
import com.fnts.plan.PlanDtos.ApplyPresetRequest;
import com.fnts.plan.PlanDtos.PlanDayResponse;
import com.fnts.plan.PlanDtos.PresetFromDayRequest;
import com.fnts.plan.PlanDtos.PresetRequest;
import com.fnts.plan.PlanDtos.PresetResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/plan")
public class PlanPresetController {

    private final PlanPresetService presetService;

    public PlanPresetController(PlanPresetService presetService) {
        this.presetService = presetService;
    }

    @GetMapping("/presets")
    public List<PresetResponse> list(@AuthenticationPrincipal CurrentUser user) {
        return presetService.list(user.id());
    }

    @PostMapping("/presets")
    @ResponseStatus(HttpStatus.CREATED)
    public PresetResponse create(@AuthenticationPrincipal CurrentUser user,
                                 @Valid @RequestBody PresetRequest request) {
        return presetService.create(user.id(), request);
    }

    /** Keeps a day's plan, as it stands, as a new preset. */
    @PostMapping("/presets/from-day")
    @ResponseStatus(HttpStatus.CREATED)
    public PresetResponse createFromDay(@AuthenticationPrincipal CurrentUser user,
                                        @Valid @RequestBody PresetFromDayRequest request) {
        return presetService.createFromDay(user.id(), request.name(), request.date());
    }

    @PutMapping("/presets/{id}")
    public PresetResponse update(@AuthenticationPrincipal CurrentUser user,
                                 @PathVariable Long id,
                                 @Valid @RequestBody PresetRequest request) {
        return presetService.update(user.id(), id, request);
    }

    @DeleteMapping("/presets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        presetService.delete(user.id(), id);
    }

    /** Starts an empty day from a preset. */
    @PostMapping("/apply-preset")
    public PlanDayResponse apply(@AuthenticationPrincipal CurrentUser user,
                                 @RequestParam(required = false)
                                 @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                 @Valid @RequestBody ApplyPresetRequest request) {
        return presetService.apply(user.id(), date, request.presetId());
    }
}
