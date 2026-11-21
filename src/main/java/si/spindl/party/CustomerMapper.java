package si.spindl.party;

import si.spindl.common.presentation.DisplayMark;
import si.spindl.common.presentation.MoneyFormat;

import java.math.BigDecimal;

public final class CustomerMapper {

    private CustomerMapper() {
    }

    public static CustomerDtos.CustomerView toView(CustomerEntity customer, long orderCount, BigDecimal balance) {
        return new CustomerDtos.CustomerView(
                customer.getId(),
                customer.getCode(),
                customer.getName(),
                customer.getEmail(),
                orderCount,
                MoneyFormat.inr(balance),
                customer.getStatus(),
                DisplayMark.fromName(customer.getName()),
                "lavender",
                customer.getCustomerType(),
                customer.getContactName(),
                customer.getPhone(),
                customer.getAddressLine1(),
                customer.getAddressLine2(),
                customer.getCity(),
                customer.getRegion(),
                customer.getPostalCode(),
                customer.getCountryCode(),
                customer.getTaxId(),
                customer.getPaymentTermsDays(),
                customer.getCreditLimit(),
                customer.getTags(),
                customer.getOwnerUserId(),
                customer.isCreditHold()
        );
    }
}
