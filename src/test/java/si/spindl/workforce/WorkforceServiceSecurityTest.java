package si.spindl.workforce;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import si.spindl.identity.AppUserEntity;
import si.spindl.identity.AppUserRepository;
import si.spindl.identity.TenantMembershipRepository;
import si.spindl.manufacturing.WorkCenterRepository;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

class WorkforceServiceSecurityTest {

    private WorkforceSkillRepository skillRepository;
    private WorkforceOperatorQualificationRepository qualificationRepository;
    private WorkforceShiftRepository shiftRepository;
    private WorkforceRosterAssignmentRepository rosterRepository;
    private TenantMembershipRepository membershipRepository;
    private AppUserRepository userRepository;
    private WorkCenterRepository workCenterRepository;
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private WorkforceService workforceService;

    @BeforeEach
    void setUp() {
        skillRepository = Mockito.mock(WorkforceSkillRepository.class);
        qualificationRepository = Mockito.mock(WorkforceOperatorQualificationRepository.class);
        shiftRepository = Mockito.mock(WorkforceShiftRepository.class);
        rosterRepository = Mockito.mock(WorkforceRosterAssignmentRepository.class);
        membershipRepository = Mockito.mock(TenantMembershipRepository.class);
        userRepository = Mockito.mock(AppUserRepository.class);
        workCenterRepository = Mockito.mock(WorkCenterRepository.class);
        passwordEncoder = Mockito.mock(org.springframework.security.crypto.password.PasswordEncoder.class);

        workforceService = new WorkforceService(
                skillRepository,
                qualificationRepository,
                shiftRepository,
                rosterRepository,
                membershipRepository,
                userRepository,
                workCenterRepository,
                passwordEncoder
        );
    }

    @Test
    void upsertQualificationRejectsNonTenantMember() {
        UUID tenantId = UUID.randomUUID();
        UUID foreignUserId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();

        // Foreign user exists globally but is NOT an active member of tenantId
        when(membershipRepository.existsByTenantIdAndUserIdAndActiveTrue(tenantId, foreignUserId)).thenReturn(false);
        when(userRepository.findById(foreignUserId)).thenReturn(Optional.of(Mockito.mock(AppUserEntity.class)));

        WorkforceDtos.UpsertQualificationRequest req = new WorkforceDtos.UpsertQualificationRequest(
                foreignUserId, skillId, "OPERATOR", null, "ACTIVE", "notes"
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> workforceService.upsertQualification(tenantId, null, req)
        );
        assertTrue(ex.getMessage().contains("User not found"));
    }

    @Test
    void createRosterAssignmentRejectsNonTenantMember() {
        UUID tenantId = UUID.randomUUID();
        UUID shiftId = UUID.randomUUID();
        UUID foreignUserId = UUID.randomUUID();

        WorkforceShiftEntity shift = new WorkforceShiftEntity();
        shift.setId(shiftId);
        shift.setTenantId(tenantId);
        when(shiftRepository.findByTenantIdAndId(tenantId, shiftId)).thenReturn(Optional.of(shift));

        when(membershipRepository.existsByTenantIdAndUserIdAndActiveTrue(tenantId, foreignUserId)).thenReturn(false);
        when(userRepository.findById(foreignUserId)).thenReturn(Optional.of(Mockito.mock(AppUserEntity.class)));

        WorkforceDtos.CreateRosterAssignmentRequest req = new WorkforceDtos.CreateRosterAssignmentRequest(
                shiftId, foreignUserId, null, java.time.LocalDate.now(), null, "notes"
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> workforceService.createRosterAssignment(tenantId, req)
        );
        assertTrue(ex.getMessage().contains("User not found"));
    }

    @Test
    void verifySkillGuardRejectsNonTenantMember() {
        UUID tenantId = UUID.randomUUID();
        UUID foreignUserId = UUID.randomUUID();

        when(membershipRepository.existsByTenantIdAndUserIdAndActiveTrue(tenantId, foreignUserId)).thenReturn(false);
        when(userRepository.findById(foreignUserId)).thenReturn(Optional.of(Mockito.mock(AppUserEntity.class)));

        WorkforceDtos.SkillGuardVerificationRequest req = new WorkforceDtos.SkillGuardVerificationRequest(
                foreignUserId, UUID.randomUUID(), "WELDING", "OPERATOR"
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> workforceService.verifySkillGuard(tenantId, req)
        );
        assertTrue(ex.getMessage().contains("Operator not found"));
    }

    @Test
    void updateShiftRejectsNonTenantShift() {
        UUID tenantId = UUID.randomUUID();
        UUID foreignShiftId = UUID.randomUUID();

        when(shiftRepository.findByTenantIdAndId(tenantId, foreignShiftId)).thenReturn(Optional.empty());

        WorkforceDtos.UpdateShiftRequest req = new WorkforceDtos.UpdateShiftRequest(
                "NIGHT", "Night Shift", java.time.LocalTime.of(22, 0), java.time.LocalTime.of(6, 0), 30, true
        );

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> workforceService.updateShift(tenantId, foreignShiftId, req)
        );
        assertTrue(ex.getMessage().contains("Shift not found"));
    }

    @Test
    void deleteQualificationRejectsForeignTenant() {
        UUID tenantId = UUID.randomUUID();
        UUID foreignQualId = UUID.randomUUID();

        when(qualificationRepository.findByTenantIdAndId(tenantId, foreignQualId)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> workforceService.deleteQualification(tenantId, foreignQualId)
        );
        assertTrue(ex.getMessage().contains("Qualification not found"));
    }

    @Test
    void createEmployeeValidatesRequiredFields() {
        UUID tenantId = UUID.randomUUID();

        assertThrows(IllegalArgumentException.class, () ->
                workforceService.createEmployee(tenantId, null, new WorkforceDtos.CreateEmployeeRequest("", "test@test.com", "OPERATOR", null))
        );

        assertThrows(IllegalArgumentException.class, () ->
                workforceService.createEmployee(tenantId, null, new WorkforceDtos.CreateEmployeeRequest("John", "", "OPERATOR", null))
        );
    }
}
