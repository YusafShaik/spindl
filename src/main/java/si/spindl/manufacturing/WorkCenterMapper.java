package si.spindl.manufacturing;

public final class WorkCenterMapper {

    private WorkCenterMapper() {}

    public static ManufacturingDtos.WorkCenterView toView(WorkCenterEntity center) {
        return new ManufacturingDtos.WorkCenterView(
                center.getId(),
                center.getCode(),
                center.getName(),
                center.getDescription(),
                center.isActive(),
                center.getLaborRatePerHour(),
                center.getOverheadRatePerHour()
        );
    }
}
