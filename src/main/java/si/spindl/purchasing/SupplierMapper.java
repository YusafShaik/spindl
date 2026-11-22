package si.spindl.purchasing;

public final class SupplierMapper {

    private SupplierMapper() {
    }

    public static SupplierDtos.SupplierView toView(SupplierEntity supplier) {
        return new SupplierDtos.SupplierView(
                supplier.getId(),
                supplier.getCode(),
                supplier.getName(),
                supplier.getEmail(),
                supplier.getStatus(),
                supplier.getContactName(),
                supplier.getPhone(),
                supplier.getAddressLine1(),
                supplier.getAddressLine2(),
                supplier.getCity(),
                supplier.getRegion(),
                supplier.getPostalCode(),
                supplier.getCountryCode(),
                supplier.getTaxId(),
                supplier.getPaymentTermsDays(),
                supplier.getLeadTimeDays(),
                supplier.getRating(),
                supplier.getNotes()
        );
    }
}
