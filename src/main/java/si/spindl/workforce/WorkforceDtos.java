package si.spindl.workforce;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class WorkforceDtos {

    public record SkillDto(
            UUID id,
            UUID tenantId,
            String skillCode,
            String name,
            String category,
            String description,
            int minCertHours,
            Instant createdAt
    ) {}

    public record CreateSkillRequest(
            String skillCode,
            String name,
            String category,
            String description,
            int minCertHours
    ) {}

    public record OperatorQualificationDto(
            UUID id,
            UUID tenantId,
            UUID userId,
            String userName,
            String userEmail,
            UUID skillId,
            String skillCode,
            String skillName,
            String skillCategory,
            String qualificationLevel, // APPRENTICE, OPERATOR, SPECIALIST, MASTER
            LocalDate certifiedAt,
            LocalDate expiresAt,
            String status,
            String notes
    ) {}

    public record UpsertQualificationRequest(
            UUID userId,
            UUID skillId,
            String qualificationLevel,
            LocalDate expiresAt,
            String status,
            String notes
    ) {}

    public record ShiftDto(
            UUID id,
            UUID tenantId,
            String shiftCode,
            String name,
            LocalTime startTime,
            LocalTime endTime,
            int breakMinutes,
            boolean isActive
    ) {}

    public record CreateShiftRequest(
            String shiftCode,
            String name,
            LocalTime startTime,
            LocalTime endTime,
            int breakMinutes
    ) {}

    public record UpdateShiftRequest(
            String shiftCode,
            String name,
            LocalTime startTime,
            LocalTime endTime,
            int breakMinutes,
            Boolean isActive
    ) {}

    public record RosterAssignmentDto(
            UUID id,
            UUID tenantId,
            UUID shiftId,
            String shiftCode,
            String shiftName,
            LocalTime shiftStartTime,
            LocalTime shiftEndTime,
            UUID userId,
            String userName,
            String userEmail,
            UUID workCenterId,
            String workCenterCode,
            String workCenterName,
            LocalDate rosterDate,
            BigDecimal plannedHours,
            String attendanceStatus, // SCHEDULED, PRESENT, LATE, ABSENT, ON_LEAVE
            Instant clockInTime,
            Instant clockOutTime,
            BigDecimal actualHours,
            String notes
    ) {}

    public record CreateRosterAssignmentRequest(
            UUID shiftId,
            UUID userId,
            UUID workCenterId,
            LocalDate rosterDate,
            BigDecimal plannedHours,
            String notes
    ) {}

    public record SkillsMatrixRowDto(
            UUID userId,
            String userName,
            String userEmail,
            String role,
            Map<String, OperatorQualificationDto> qualifications // Keyed by skillCode
    ) {}

    public record SkillsMatrixResponse(
            List<SkillDto> skills,
            List<SkillsMatrixRowDto> rows
    ) {}

    public record EmployeeSkillDto(
            UUID qualificationId,
            UUID skillId,
            String skillCode,
            String skillName,
            String category,
            String level, // APPRENTICE, OPERATOR, SPECIALIST, MASTER
            LocalDate certifiedAt,
            LocalDate expiresAt,
            String status,
            String notes
    ) {}

    public record EmployeeDto(
            UUID id, // userId
            UUID membershipId,
            String name,
            String email,
            String role,
            boolean active,
            List<EmployeeSkillDto> skills,
            Instant joinedAt
    ) {}

    public record InitialSkillAssignment(
            UUID skillId,
            String level
    ) {}

    public record CreateEmployeeRequest(
            String name,
            String email,
            String role,
            List<InitialSkillAssignment> skills
    ) {}

    public record UpdateEmployeeRequest(
            String name,
            String role,
            Boolean active
    ) {}

    public record SkillGuardVerificationRequest(
            UUID operatorUserId,
            UUID operationId,
            String requiredSkillCode,
            String requiredLevel // e.g. "OPERATOR", "SPECIALIST"
    ) {}

    public record SkillGuardVerificationResponse(
            boolean isQualified,
            String operatorName,
            String skillCode,
            String skillName,
            String currentLevel,
            String requiredLevel,
            boolean isExpired,
            String reason
    ) {}

    public record WorkforceSummaryDto(
            long totalOperators,
            long activeShifts,
            long presentToday,
            long scheduledToday,
            double attendanceRatePercent,
            long certifiedSkillsCount,
            long totalQualifications
    ) {}
}
