package com.fnts.plan;

import java.time.LocalDate;

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
import com.fnts.plan.PlanDtos.BlockRequest;
import com.fnts.plan.PlanDtos.BlockResponse;
import com.fnts.plan.PlanDtos.CopyRequest;
import com.fnts.plan.PlanDtos.DoneRequest;
import com.fnts.plan.PlanDtos.PlanDayResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/plan")
public class PlanController {

    private final PlanService planService;

    public PlanController(PlanService planService) {
        this.planService = planService;
    }

    /** The plan for a date; the user's logical today when none is given. */
    @GetMapping
    public PlanDayResponse day(@AuthenticationPrincipal CurrentUser user,
                               @RequestParam(required = false)
                               @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return planService.getDay(user.id(), date);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BlockResponse add(@AuthenticationPrincipal CurrentUser user,
                             @RequestParam(required = false)
                             @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                             @Valid @RequestBody BlockRequest request) {
        return planService.addBlock(user.id(), date, request);
    }

    @PutMapping("/{id}")
    public BlockResponse update(@AuthenticationPrincipal CurrentUser user,
                                @PathVariable Long id,
                                @Valid @RequestBody BlockRequest request) {
        return planService.updateBlock(user.id(), id, request);
    }

    @PutMapping("/{id}/done")
    public BlockResponse setDone(@AuthenticationPrincipal CurrentUser user,
                                 @PathVariable Long id,
                                 @Valid @RequestBody DoneRequest request) {
        return planService.setDone(user.id(), id, request.done());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        planService.deleteBlock(user.id(), id);
    }

    /** Seeds an empty day from another day's blocks. */
    @PostMapping("/copy")
    public PlanDayResponse copy(@AuthenticationPrincipal CurrentUser user,
                                @RequestParam(required = false)
                                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                @Valid @RequestBody CopyRequest request) {
        return planService.copyDay(user.id(), date, request.from());
    }
}
