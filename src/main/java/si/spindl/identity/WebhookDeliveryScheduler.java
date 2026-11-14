package si.spindl.identity;

import tools.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@Component
public class WebhookDeliveryScheduler {
    private final EntityManager entityManager;private final TenantWebhookDeliveryRepository deliveries;private final TenantWebhookEndpointRepository endpoints;private final TenantWebhookService webhookService;private final ObjectMapper mapper;private final TransactionTemplate transactions;private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build();
    public WebhookDeliveryScheduler(EntityManager entityManager,TenantWebhookDeliveryRepository deliveries,TenantWebhookEndpointRepository endpoints,TenantWebhookService webhookService,ObjectMapper mapper,PlatformTransactionManager transactionManager){this.entityManager=entityManager;this.deliveries=deliveries;this.endpoints=endpoints;this.webhookService=webhookService;this.mapper=mapper;this.transactions=new TransactionTemplate(transactionManager);}
    @Scheduled(fixedDelayString="${spindl.webhooks.poll-delay-ms:15000}") public void dispatchDue(){List<UUID> ids=claim();for(UUID id:ids)deliver(id);}
    @SuppressWarnings("unchecked") private List<UUID> claim(){return transactions.execute(status->{Instant now=Instant.now(),stale=now.minus(Duration.ofMinutes(5));List<Object> rows=entityManager.createNativeQuery("SELECT id FROM tenant_webhook_deliveries WHERE ((status IN ('PENDING','RETRY') AND next_attempt_at<=:now) OR (status='PROCESSING' AND claimed_at<:stale)) ORDER BY next_attempt_at ASC LIMIT 20 FOR UPDATE SKIP LOCKED").setParameter("now",now).setParameter("stale",stale).getResultList();List<UUID> ids=new ArrayList<>();for(Object row:rows)ids.add((UUID)row);for(UUID id:ids)entityManager.createNativeQuery("UPDATE tenant_webhook_deliveries SET status='PROCESSING',claimed_at=:now WHERE id=:id").setParameter("now",now).setParameter("id",id).executeUpdate();return ids;});}
    private void deliver(UUID id){DeliveryTask task=transactions.execute(status->{var delivery=deliveries.findById(id).orElse(null);if(delivery==null)return null;var endpoint=endpoints.findByTenantIdAndId(delivery.getTenantId(),delivery.getEndpointId()).orElse(null);if(endpoint==null||!endpoint.isActive()){delivery.dead("Webhook endpoint is unavailable or disabled");return null;}return new DeliveryTask(delivery.getId(),delivery.getEventType(),delivery.getPayload(),endpoint.getTenantId(),endpoint.getTargetUrl(),endpoint.getSecretCiphertext());});if(task==null)return;Integer code=null;String failure=null;try{URI uri=TenantWebhookService.validateUrl(task.url());for(InetAddress address:InetAddress.getAllByName(uri.getHost()))if(address.isAnyLocalAddress()||address.isLoopbackAddress()||address.isLinkLocalAddress()||address.isSiteLocalAddress()||address.isMulticastAddress())throw new IllegalArgumentException("Private destinations are not allowed");byte[] body=mapper.writeValueAsBytes(task.payload());String signature=sign(webhookService.decrypt(task.secret()),body);HttpRequest request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(5)).header("Content-Type","application/json").header("X-Spindl-Event",task.eventType()).header("X-Spindl-Delivery-ID",task.id().toString()).header("X-Spindl-Signature","sha256="+signature).POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();HttpResponse<Void> response=client.send(request,HttpResponse.BodyHandlers.discarding());code=response.statusCode();if(code<200||code>=300)failure="Destination returned HTTP "+code;}catch(Exception exception){failure=exception.getMessage()==null?exception.getClass().getSimpleName():exception.getMessage();}
        Integer responseCode=code;String error=failure;transactions.executeWithoutResult(status->{deliveries.findById(id).ifPresent(delivery->{if(error==null)delivery.delivered(responseCode);else delivery.failed(responseCode,error);});});}
    private String sign(String secret,byte[] body)throws Exception{Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));return java.util.HexFormat.of().formatHex(mac.doFinal(body));}
    private record DeliveryTask(UUID id,String eventType,java.util.Map<String,Object> payload,UUID tenantId,String url,String secret){}
}
