package si.spindl.identity;

import org.junit.jupiter.api.Test;
import java.net.InetAddress;
import java.net.UnknownHostException;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TenantWebhookSecurityTest {

    @Test
    void blocksPrivateAndReservedIpAddresses() throws UnknownHostException {
        // Loopback
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("127.0.0.1")));
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("127.0.0.2")));

        // Link-local / Cloud metadata (169.254.169.254)
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("169.254.169.254")));

        // Private RFC 1918
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("10.0.0.1")));
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("172.16.0.1")));
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("192.168.1.1")));

        // Current network / 0.0.0.0
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("0.0.0.0")));

        // CGNAT (100.64.0.0/10)
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("100.64.0.1")));
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("100.127.255.254")));

        // Test nets (RFC 5737)
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("192.0.2.1")));
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("198.51.100.1")));
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("203.0.113.1")));

        // Benchmarking (198.18.0.0/15)
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("198.18.0.1")));

        // Reserved (240.0.0.0/4) & Broadcast
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("240.0.0.1")));
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("255.255.255.255")));

        // IPv6 ULA (fc00::/7)
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("fd00::1")));
        assertTrue(TenantWebhookService.isBlockedAddress(InetAddress.getByName("fc00::1234")));
    }

    @Test
    void allowsPublicIpAddresses() throws UnknownHostException {
        // Public DNS / web hosts
        assertFalse(TenantWebhookService.isBlockedAddress(InetAddress.getByName("8.8.8.8")));
        assertFalse(TenantWebhookService.isBlockedAddress(InetAddress.getByName("1.1.1.1")));
        assertFalse(TenantWebhookService.isBlockedAddress(InetAddress.getByName("93.184.216.34")));
    }
}
