package si.spindl.catalog;

import si.spindl.common.presentation.DisplayMark;
import si.spindl.common.presentation.MoneyFormat;

public final class ItemMapper {

    private ItemMapper() {
    }

    public static ItemDtos.ItemView toView(ItemEntity item) {
        String availableState = item.getAvailableQuantity() == 0
                ? "Out of stock"
                : item.getAvailableQuantity() <= item.getLowStockThreshold() ? "Low stock" : "In stock";
        return new ItemDtos.ItemView(
                item.getId(),
                item.getSku(),
                item.getName(),
                item.getCategory(),
                item.getOnHand(),
                item.getUnit(),
                MoneyFormat.inr(item.getUnitPrice()),
                availableState,
                DisplayMark.fromName(item.getName()),
                "lavender",
                item.getUnitPrice(),
                item.getReservedQuantity(),
                item.getAvailableQuantity(),
                item.getLowStockThreshold(),
                item.getItemType()
        );
    }
}
