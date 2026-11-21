package si.spindl.workforce;

import si.spindl.common.security.AuthenticatedActor;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import si.spindl.tenant.CurrentTenant;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/workforce")
public class WorkforceController {

    private final WorkforceService service;
    private final CurrentTenant tenant;

    public WorkforceController(WorkforceService service, CurrentTenant tenant) {
        this.service = service;
        this.tenant = tenant;
    }

    // ==========================================
    // EMPLOYEES & DIRECTORY
    // ==========================================

    @GetMapping("/employees")
    public List<WorkforceDtos.EmployeeDto> listEmployees() {
        return service.listEmployees(tenant.currentTenantId());
    }

    @PostMapping("/employees")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkforceDtos.EmployeeDto createEmployee(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody WorkforceDtos.CreateEmployeeRequest req
    ) {
        return service.createEmployee(tenant.currentTenantId(), AuthenticatedActor.optionalUserId(jwt), req);
    }

    // ==========================================
    // SUMMARY & MATRIX
    // ==========================================

    @GetMapping("/summary")
    public WorkforceDtos.WorkforceSummaryDto getSummary() {
        return service.getSummary(tenant.currentTenantId());
    }

    @GetMapping({"/matrix", "/skills-matrix"})
    public WorkforceDtos.SkillsMatrixResponse getSkillsMatrix() {
        return service.getSkillsMatrix(tenant.currentTenantId());
    }

    // ==========================================
    // SKILLS
    // ==========================================

    @GetMapping("/skills")
    public List<WorkforceDtos.SkillDto> listSkills() {
        return service.listSkills(tenant.currentTenantId());
    }

    @PostMapping("/skills")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkforceDtos.SkillDto createSkill(@Valid @RequestBody WorkforceDtos.CreateSkillRequest req) {
        return service.createSkill(tenant.currentTenantId(), req);
    }

    // ==========================================
    // QUALIFICATIONS
    // ==========================================

    @GetMapping("/qualifications")
    public List<WorkforceDtos.OperatorQualificationDto> listQualifications(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) UUID skillId
    ) {
        return service.listQualifications(tenant.currentTenantId(), userId, skillId);
    }

    @PostMapping("/qualifications")
    public WorkforceDtos.OperatorQualificationDto upsertQualification(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody WorkforceDtos.UpsertQualificationRequest req
    ) {
        return service.upsertQualification(tenant.currentTenantId(), AuthenticatedActor.optionalUserId(jwt), req);
    }

    @DeleteMapping("/qualifications/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteQualification(@PathVariable UUID id) {
        service.deleteQualification(tenant.currentTenantId(), id);
    }

    // ==========================================
    // SHIFTS
    // ==========================================

    @GetMapping("/shifts")
    public List<WorkforceDtos.ShiftDto> listShifts() {
        return service.listShifts(tenant.currentTenantId());
    }

    @PostMapping("/shifts")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkforceDtos.ShiftDto createShift(@Valid @RequestBody WorkforceDtos.CreateShiftRequest req) {
        return service.createShift(tenant.currentTenantId(), req);
    }

    @PutMapping("/shifts/{id}")
    public WorkforceDtos.ShiftDto updateShift(
            @PathVariable UUID id,
            @Valid @RequestBody WorkforceDtos.UpdateShiftRequest req
    ) {
        return service.updateShift(tenant.currentTenantId(), id, req);
    }

    // ==========================================
    // ROSTER & ATTENDANCE
    // ==========================================

    @GetMapping("/roster")
    public List<WorkforceDtos.RosterAssignmentDto> getRoster(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate
    ) {
        return service.getRoster(tenant.currentTenantId(), date, fromDate, toDate);
    }

    @PostMapping("/roster")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkforceDtos.RosterAssignmentDto createRosterAssignment(
            @Valid @RequestBody WorkforceDtos.CreateRosterAssignmentRequest req
    ) {
        return service.createRosterAssignment(tenant.currentTenantId(), req);
    }

    @PostMapping("/roster/{id}/clock-in")
    public WorkforceDtos.RosterAssignmentDto clockIn(@PathVariable UUID id) {
        return service.clockIn(tenant.currentTenantId(), id);
    }

    @PostMapping("/roster/{id}/clock-out")
    public WorkforceDtos.RosterAssignmentDto clockOut(@PathVariable UUID id) {
        return service.clockOut(tenant.currentTenantId(), id);
    }

    // ==========================================
    // SKILL GUARD
    // ==========================================

    @PostMapping("/verify-skill")
    public WorkforceDtos.SkillGuardVerificationResponse verifySkillGuard(
            @Valid @RequestBody WorkforceDtos.SkillGuardVerificationRequest req
    ) {
        return service.verifySkillGuard(tenant.currentTenantId(), req);
    }
}
