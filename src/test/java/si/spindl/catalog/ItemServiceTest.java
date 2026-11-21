package si.spindl.catalog;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.inventory.InventoryMovementEntity;
import si.spindl.inventory.InventoryMovementRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ItemServiceTest {

    @Mock
    private ItemRepository items;

    @Mock
    private InventoryMovementRepository movements;

    private ItemService itemService;
    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        itemService = new ItemService(items, movements);
    }

    @Test
    void listReturnsMappedItems() {
        ItemEntity entity = new ItemEntity(tenantId, "SKU-1", "Test Item", "General", 10, "PCS", new BigDecimal("100.00"), 5);
        when(items.findAllByTenantIdAndActiveTrueOrderByName(tenantId)).thenReturn(List.of(entity));

        List<ItemController.ItemView> result = itemService.list(tenantId);

        assertEquals(1, result.size());
        assertEquals("SKU-1", result.get(0).sku());
        assertEquals("Test Item", result.get(0).name());
    }

    @Test
    void createThrowsWhenSkuExists() {
        ItemController.ItemRequest request = new ItemController.ItemRequest(
                "SKU-EXISTS", "Item Name", "Category", 5, "PCS", new BigDecimal("50.00"), 2, "FINISHED"
        );
        when(items.existsByTenantIdAndSkuIgnoreCase(tenantId, "SKU-EXISTS")).thenReturn(true);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                itemService.create(tenantId, request)
        );

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertEquals("SKU already exists", ex.getReason());
        verify(items, never()).save(any());
    }

    @Test
    void createSavesItemAndOpeningMovement() {
        ItemController.ItemRequest request = new ItemController.ItemRequest(
                "SKU-NEW", "New Item", "Category", 10, "PCS", new BigDecimal("50.00"), 2, "FINISHED"
        );
        when(items.existsByTenantIdAndSkuIgnoreCase(tenantId, "SKU-NEW")).thenReturn(false);

        ItemEntity savedEntity = new ItemEntity(tenantId, "SKU-NEW", "New Item", "Category", 10, "PCS", new BigDecimal("50.00"), 2);
        when(items.save(any(ItemEntity.class))).thenReturn(savedEntity);

        ItemController.ItemView result = itemService.create(tenantId, request);

        assertNotNull(result);
        assertEquals("SKU-NEW", result.sku());
        verify(items).save(any(ItemEntity.class));
        verify(movements).save(any(InventoryMovementEntity.class));
    }

    @Test
    void updateThrowsWhenNotFound() {
        UUID id = UUID.randomUUID();
        ItemController.ItemUpdate request = new ItemController.ItemUpdate(
                "Updated Name", "Category", "PCS", new BigDecimal("60.00"), true, "FINISHED"
        );
        when(items.findByTenantIdAndId(tenantId, id)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                itemService.update(tenantId, id, request)
        );

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }
}
