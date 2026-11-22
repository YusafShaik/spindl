package si.spindl.identity;

import si.spindl.common.exception.BadRequestException;
import si.spindl.common.exception.ConflictException;
import si.spindl.common.exception.ForbiddenException;
import si.spindl.common.exception.NotFoundException;
import si.spindl.config.SpindlProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.tenant.CurrentTenant;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import si.spindl.identity.TenantWebhookDtos.CreateEndpointRequest;
import si.spindl.identity.TenantWebhookDtos.EndpointView;
import si.spindl.identity.TenantWebhookDtos.DeliveryView;
import si.spindl.identity.TenantWebhookDtos.CreatedEndpoint;

@Service
public class TenantWebhookService {

    private static final Set<String> EVENT_TYPES = Set.of(
            "PURCHASE_ORDER_APPROVAL_RECORDED",
            "PURCHASE_ORDER_APPROVED",
            "INVOICE_ISSUED",
            "INVOICE_PAYMENT_RECORDED",
            "CUSTOMER_CREDIT_NOTE_ISSUED"
    );

    private final TenantWebhookEndpointRepository endpoints;
    private final TenantWebhookDeliveryRepository deliveries;
    private final TenantMembershipRepository memberships;
    private final TenantAuditEventRepository audit;
    private final CurrentTenant tenant;
    private final SecretKeySpec encryptionKey;
    private final SecureRandom random = new SecureRandom();

    public TenantWebhookService(
            TenantWebhookEndpointRepository endpoints,
            TenantWebhookDeliveryRepository deliveries,
            TenantMembershipRepository memberships,
            TenantAuditEventRepository audit,
            CurrentTenant tenant,
            SpindlProperties properties
    ) {
        this.endpoints = endpoints;
        this.deliveries = deliveries;
        this.memberships = memberships;
        this.audit = audit;
        this.tenant = tenant;
        String masterSecret = properties.encryptionKey();
        try {
            this.encryptionKey = new SecretKeySpec(
                    MessageDigest.getInstance("SHA-256").digest(masterSecret.getBytes(StandardCharsets.UTF_8)),
                    "AES"
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to initialize webhook secret encryption", exception);
        }
    }

    @Transactional(readOnly = true)
    public List<EndpointView> list(UUID actor) {
        UUID tenantId = tenant.currentTenantId();
        requireAdmin(tenantId, actor);
        return endpoints.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .map(endpoint -> new EndpointView(
                        endpoint.getId(),
                        endpoint.getName(),
                        endpoint.getTargetUrl(),
                        endpoint.getEventTypes(),
                        endpoint.isActive(),
                        endpoint.getCreatedAt(),
                        deliveries.countByTenantIdAndEndpointIdAndStatus(tenantId, endpoint.getId(), "DEAD")
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DeliveryView> deliveryHistory(UUID actor) {
        UUID tenantId = tenant.currentTenantId();
        requireAdmin(tenantId, actor);
        Map<UUID, String> names = new HashMap<>();
        endpoints.findAllByTenantIdOrderByCreatedAtDesc(tenantId)
                .forEach(endpoint -> names.put(endpoint.getId(), endpoint.getName()));

        return deliveries.findAllByTenantIdOrderByCreatedAtDesc(tenantId, org.springframework.data.domain.PageRequest.of(0, 50)).stream()
                .map(delivery -> new DeliveryView(
                        delivery.getId(),
                        names.getOrDefault(delivery.getEndpointId(), "Removed endpoint"),
                        delivery.getEventType(),
                        delivery.getStatus(),
                        delivery.getAttemptCount(),
                        delivery.getNextAttemptAt(),
                        delivery.getLastResponseStatus(),
                        delivery.getLastError(),
                        delivery.getCreatedAt(),
                        delivery.getDeliveredAt()
                ))
                .toList();
    }

    @Transactional
    public CreatedEndpoint create(UUID actor, CreateEndpointRequest request) {
        UUID tenantId = tenant.currentTenantId();
        requireAdmin(tenantId, actor);

        if (request.name() == null || request.name().isBlank() || request.name().trim().length() > 120) {
            throw badRequest("Webhook name is required and must be at most 120 characters");
        }
        URI uri = validateUrl(request.targetUrl());
        if (request.eventTypes() == null || request.eventTypes().isEmpty()
                || request.eventTypes().size() > EVENT_TYPES.size()
                || request.eventTypes().stream().distinct().count() != request.eventTypes().size()
                || !EVENT_TYPES.containsAll(request.eventTypes())) {
            throw badRequest("Select one or more supported webhook event types");
        }

        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String secret = "whsec_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        var endpoint = endpoints.save(new TenantWebhookEndpointEntity(
                tenantId,
                request.name().trim(),
                uri.toString(),
                encrypt(secret),
                request.eventTypes(),
                actor
        ));

        audit.save(new TenantAuditEventEntity(
                tenantId,
                actor,
                "WEBHOOK_ENDPOINT_CREATED",
                "webhook_endpoint",
                endpoint.getId(),
                Map.of("name", endpoint.getName(), "events", endpoint.getEventTypes())
        ));

        return new CreatedEndpoint(TenantWebhookMapper.toEndpointView(endpoint, 0), secret);
    }

    @Transactional
    public void deactivate(UUID actor, UUID id) {
        UUID tenantId = tenant.currentTenantId();
        requireAdmin(tenantId, actor);
        var endpoint = endpoints.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Webhook endpoint not found"));
        if (!endpoint.isActive()) {
            return;
        }
        endpoint.deactivate();
        audit.save(new TenantAuditEventEntity(
                tenantId,
                actor,
                "WEBHOOK_ENDPOINT_DEACTIVATED",
                "webhook_endpoint",
                id,
                Map.of("name", endpoint.getName())
        ));
    }

    @Transactional
    public DeliveryView replay(UUID actor, UUID id) {
        UUID tenantId = tenant.currentTenantId();
        requireAdmin(tenantId, actor);

        var delivery = deliveries.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Webhook delivery not found"));
        if (!"DEAD".equals(delivery.getStatus())) {
            throw new ConflictException("Only dead-letter deliveries can be replayed");
        }
        var endpoint = endpoints.findByTenantIdAndId(tenantId, delivery.getEndpointId())
                .orElseThrow(() -> new ConflictException("The webhook endpoint no longer exists"));
        if (!endpoint.isActive()) {
            throw new ConflictException("Reactivate the webhook endpoint before replaying this delivery");
        }

        delivery.replay();
        audit.save(new TenantAuditEventEntity(
                tenantId,
                actor,
                "WEBHOOK_DELIVERY_REPLAYED",
                "webhook_delivery",
                id,
                Map.of("eventType", delivery.getEventType(), "replayCount", delivery.getReplayCount())
        ));

        return new DeliveryView(
                delivery.getId(),
                endpoint.getName(),
                delivery.getEventType(),
                delivery.getStatus(),
                delivery.getAttemptCount(),
                delivery.getNextAttemptAt(),
                delivery.getLastResponseStatus(),
                delivery.getLastError(),
                delivery.getCreatedAt(),
                delivery.getDeliveredAt()
        );
    }

    @Transactional
    public void enqueue(UUID tenantId, String eventType, Map<String, Object> data) {
        if (!EVENT_TYPES.contains(eventType)) {
            return;
        }
        for (var endpoint : endpoints.findActiveForEvent(tenantId, eventType)) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", UUID.randomUUID().toString());
            payload.put("tenantId", tenantId.toString());
            payload.put("eventType", eventType);
            payload.put("occurredAt", Instant.now().toString());
            payload.put("data", data);
            deliveries.save(new TenantWebhookDeliveryEntity(tenantId, endpoint.getId(), eventType, payload));
        }
    }

    String decrypt(String ciphertext) {
        try {
            byte[] all = Base64.getDecoder().decode(ciphertext);
            byte[] iv = Arrays.copyOfRange(all, 0, 12);
            byte[] value = Arrays.copyOfRange(all, 12, all.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey, new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(value), StandardCharsets.UTF_8);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to decrypt webhook signing key", exception);
        }
    }

    private String encrypt(String secret) {
        try {
            byte[] iv = new byte[12];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey, new GCMParameterSpec(128, iv));
            byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(encrypted, 0, combined, iv.length, encrypted.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to encrypt webhook signing key", exception);
        }
    }

    static boolean isBlockedAddress(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress()) {
            return true;
        }
        byte[] b = address.getAddress();
        if (b.length == 4) {
            int first = b[0] & 0xFF;
            int second = b[1] & 0xFF;
            // 0.0.0.0/8
            if (first == 0) return true;
            // 100.64.0.0/10 (CGNAT)
            if (first == 100 && (second & 0xC0) == 64) return true;
            // 192.0.0.0/24 (IETF assignments)
            if (first == 192 && second == 0 && (b[2] & 0xFF) == 0) return true;
            // 192.0.2.0/24 (TEST-NET-1)
            if (first == 192 && second == 0 && (b[2] & 0xFF) == 2) return true;
            // 198.18.0.0/15 (Benchmarking)
            if (first == 198 && (second & 0xFE) == 18) return true;
            // 198.51.100.0/24 (TEST-NET-2)
            if (first == 198 && second == 51 && (b[2] & 0xFF) == 100) return true;
            // 203.0.113.0/24 (TEST-NET-3)
            if (first == 203 && second == 0 && (b[2] & 0xFF) == 113) return true;
            // 240.0.0.0/4 (Reserved)
            if ((first & 0xF0) == 240) return true;
            // 255.255.255.255 (Broadcast)
            if (first == 255 && second == 255 && (b[2] & 0xFF) == 255 && (b[3] & 0xFF) == 255) return true;
        } else if (b.length == 16) {
            int first = b[0] & 0xFF;
            // IPv6 Unique Local Address fc00::/7 (RFC 4193)
            if ((first & 0xFE) == 0xFC) return true;
            // IPv4-mapped IPv6 ::ffff:0:0/96
            if (b[0] == 0 && b[1] == 0 && b[2] == 0 && b[3] == 0
                    && b[4] == 0 && b[5] == 0 && b[6] == 0 && b[7] == 0
                    && b[8] == 0 && b[9] == 0 && (b[10] & 0xFF) == 0xFF && (b[11] & 0xFF) == 0xFF) {
                return true;
            }
        }
        return false;
    }

    static URI validateUrl(String value) {
        try {
            URI uri = URI.create(value == null ? "" : value.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || uri.getHost() == null
                    || uri.getUserInfo() != null
                    || uri.getFragment() != null
                    || uri.getPort() > 65535) {
                throw new IllegalArgumentException();
            }
            if (uri.getHost().matches("[0-9.]+") || uri.getHost().contains(":")) {
                throw new IllegalArgumentException();
            }
            for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
                if (isBlockedAddress(address)) {
                    throw new IllegalArgumentException();
                }
            }
            return uri;
        } catch (Exception exception) {
            throw new BadRequestException("Webhook destination must be a public HTTPS URL without credentials or fragments");
        }
    }

    private void requireAdmin(UUID tenantId, UUID actor) {
        String role = memberships.findActiveRole(tenantId, actor)
                .orElseThrow(() -> new ForbiddenException("Active workspace membership is required"));
        if (!Set.of("OWNER", "ADMIN").contains(role)) {
            throw new ForbiddenException("Only workspace owners and admins can manage webhooks");
        }
    }

    private ResponseStatusException badRequest(String message) {
        return new BadRequestException(message);
    }

    public List<String> supportedEvents(UUID actor) {
        requireAdmin(tenant.currentTenantId(), actor);
        return EVENT_TYPES.stream().sorted().toList();
    }




}
