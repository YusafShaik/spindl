package si.spindl.pos;

import si.spindl.pos.PosDtos.RegisterView;
import si.spindl.pos.PosDtos.SessionView;

/** Entity and row mapping for PosDtos. The records themselves stay free of persistence types. */
public final class PosMapper {
    private PosMapper() {}

    public static SessionView toSessionView(PosRegisterSessionEntity entity) {
return new SessionView(entity.getId(),entity.getStatus(),entity.getOpeningFloat(),entity.getExpectedCash(),entity.getCountedCash(),entity.getCashVariance(),entity.getOpenedAt(),entity.getClosedAt(),entity.getCashierUserId(),entity.getRegister().getId(),entity.getRegister().getCode(),entity.getRegister().getName(),entity.getRegister().getWarehouse().getBranchId(),entity.getRegister().getWarehouse().getName());
    }

    public static RegisterView toRegisterView(PosRegisterEntity entity) {
return new RegisterView(entity.getId(),entity.getCode(),entity.getName(),entity.getWarehouse().getId(),entity.getWarehouse().getCode(),entity.getWarehouse().getName(),entity.getWarehouse().getBranchId(),entity.getAssignedCashierUserId());
    }
}
