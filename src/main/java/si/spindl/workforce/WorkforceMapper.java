package si.spindl.workforce;

/** Maps workforce entities to API records. */
public final class WorkforceMapper {

    private WorkforceMapper() {}

    public static WorkforceDtos.SkillDto toSkill(WorkforceSkillEntity entity) {
        return new WorkforceDtos.SkillDto(
                entity.getId(), entity.getTenantId(), entity.getSkillCode(), entity.getName(),
                entity.getCategory(), entity.getDescription(), entity.getMinCertHours(), entity.getCreatedAt()
        );
    }

    public static WorkforceDtos.OperatorQualificationDto toQualification(WorkforceOperatorQualificationEntity entity) {
        return new WorkforceDtos.OperatorQualificationDto(
                entity.getId(), entity.getTenantId(), entity.getUser().getId(), entity.getUser().getDisplayName(), entity.getUser().getEmail(),
                entity.getSkill().getId(), entity.getSkill().getSkillCode(), entity.getSkill().getName(), entity.getSkill().getCategory(),
                entity.getQualificationLevel(), entity.getCertifiedAt(), entity.getExpiresAt(), entity.getStatus(), entity.getNotes()
        );
    }

    public static WorkforceDtos.ShiftDto toShift(WorkforceShiftEntity entity) {
        return new WorkforceDtos.ShiftDto(
                entity.getId(), entity.getTenantId(), entity.getShiftCode(), entity.getName(),
                entity.getStartTime(), entity.getEndTime(), entity.getBreakMinutes(), entity.isActive()
        );
    }

    public static WorkforceDtos.RosterAssignmentDto toRoster(WorkforceRosterAssignmentEntity entity) {
        return new WorkforceDtos.RosterAssignmentDto(
                entity.getId(), entity.getTenantId(),
                entity.getShift().getId(), entity.getShift().getShiftCode(), entity.getShift().getName(),
                entity.getShift().getStartTime(), entity.getShift().getEndTime(),
                entity.getUser().getId(), entity.getUser().getDisplayName(), entity.getUser().getEmail(),
                entity.getWorkCenter() != null ? entity.getWorkCenter().getId() : null,
                entity.getWorkCenter() != null ? entity.getWorkCenter().getCode() : null,
                entity.getWorkCenter() != null ? entity.getWorkCenter().getName() : null,
                entity.getRosterDate(), entity.getPlannedHours(), entity.getAttendanceStatus(),
                entity.getClockInTime(), entity.getClockOutTime(), entity.getActualHours(), entity.getNotes()
        );
    }
}
