package si.spindl.identity;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.tenant.DevelopmentTenant;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class AuditEventService {
    private final TenantAuditEventRepository events;private final AppUserRepository users;private final DevelopmentTenant tenant;
    public AuditEventService(TenantAuditEventRepository events,AppUserRepository users,DevelopmentTenant tenant){this.events=events;this.users=users;this.tenant=tenant;}

    @Transactional(readOnly=true)
    public EventPage search(String requestedEventType,String requestedSubjectType,UUID actorId,UUID subjectId,LocalDate from,LocalDate to,String requestedSearch,int page,int size){
        if(from!=null&&to!=null&&from.isAfter(to))throw badRequest("From date must not be after the to date");
        if(page<0||size<1||size>100)throw badRequest("Page must be nonnegative and page size must be between 1 and 100");
        String eventType=clean(requestedEventType);String subjectType=clean(requestedSubjectType);String search=Objects.requireNonNullElse(clean(requestedSearch),"");
        Instant start=from==null?null:from.atStartOfDay().toInstant(ZoneOffset.UTC);Instant until=to==null?null:to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Specification<TenantAuditEventEntity> specification=(root,query,criteria)->{
            var predicates=new ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(criteria.equal(root.get("tenantId"),tenant.currentTenantId()));
            if(eventType!=null)predicates.add(criteria.equal(root.get("eventType"),eventType));
            if(subjectType!=null)predicates.add(criteria.equal(root.get("subjectType"),subjectType));
            if(actorId!=null)predicates.add(criteria.equal(root.get("actorUserId"),actorId));
            if(subjectId!=null)predicates.add(criteria.equal(root.get("subjectId"),subjectId));
            if(start!=null)predicates.add(criteria.greaterThanOrEqualTo(root.get("createdAt"),start));
            if(until!=null)predicates.add(criteria.lessThan(root.get("createdAt"),until));
            if(!search.isEmpty()){
                String pattern="%"+search.toLowerCase(Locale.ROOT)+"%";
                var actorQuery=query.subquery(UUID.class);var actor=actorQuery.from(AppUserEntity.class);actorQuery.select(actor.get("id"));
                actorQuery.where(criteria.equal(actor.get("id"),root.get("actorUserId")),criteria.or(criteria.like(criteria.lower(actor.get("displayName")),pattern),criteria.like(criteria.lower(actor.get("email")),pattern)));
                predicates.add(criteria.or(criteria.like(criteria.lower(root.get("eventType")),pattern),criteria.like(criteria.lower(root.get("subjectType")),pattern),criteria.exists(actorQuery)));
            }
            return criteria.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        var result=events.findAll(specification,PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"createdAt")));
        Map<UUID,AppUserEntity> actors=new HashMap<>();users.findAllById(result.getContent().stream().map(TenantAuditEventEntity::getActorUserId).filter(Objects::nonNull).distinct().toList()).forEach(user->actors.put(user.getId(),user));
        return new EventPage(result.getContent().stream().map(event->view(event,actors.get(event.getActorUserId()))).toList(),result.getNumber(),result.getSize(),result.getTotalElements(),result.getTotalPages());
    }

    @Transactional(readOnly=true)
    public String export(String eventType,String subjectType,UUID actorId,UUID subjectId,LocalDate from,LocalDate to,String search){
        EventPage page=search(eventType,subjectType,actorId,subjectId,from,to,search,0,100);
        List<EventView> rows=new ArrayList<>(page.items());int next=1;
        while(rows.size()<page.totalElements()&&rows.size()<10000){EventPage nextPage=search(eventType,subjectType,actorId,subjectId,from,to,search,next++,100);if(nextPage.items().isEmpty())break;rows.addAll(nextPage.items());}
        String header="timestamp,actor,event_type,subject_type,subject_id,details\r\n";
        return header+rows.stream().limit(10000).map(event->String.join(",",cell(event.createdAt().toString()),cell(event.actorName()),cell(event.eventType()),cell(event.subjectType()),cell(Objects.toString(event.subjectId(),"")),cell(event.details().toString()))).collect(java.util.stream.Collectors.joining("\r\n"));
    }

    private EventView view(TenantAuditEventEntity event,AppUserEntity actor){return new EventView(event.getId(),event.getActorUserId(),actor==null?(event.getActorUserId()==null?"System":"Former or unavailable user"):actor.getDisplayName(),actor==null?null:maskEmail(actor.getEmail()),event.getEventType(),event.getSubjectType(),event.getSubjectId(),sanitizeMap(event.getDetails()),event.getCreatedAt());}
    private Map<String,Object> sanitizeMap(Map<String,Object> input){Map<String,Object> result=new TreeMap<>();if(input==null)return result;input.forEach((key,value)->{String normalized=key.toLowerCase(Locale.ROOT);if(normalized.contains("password")||normalized.contains("token")||normalized.contains("secret")||normalized.contains("authorization"))result.put(key,"[REDACTED]");else if(normalized.contains("email")&&value instanceof String email)result.put(key,maskEmail(email));else result.put(key,sanitizeValue(value));});return Collections.unmodifiableMap(result);}
    private Object sanitizeValue(Object value){if(value instanceof Map<?,?> nested){Map<String,Object> result=new TreeMap<>();nested.forEach((key,child)->result.put(String.valueOf(key),sanitizeMapValue(String.valueOf(key),child)));return Collections.unmodifiableMap(result);}if(value instanceof Collection<?> values)return values.stream().map(this::sanitizeValue).toList();return value;}
    private Object sanitizeMapValue(String key,Object value){String normalized=key.toLowerCase(Locale.ROOT);if(normalized.contains("password")||normalized.contains("token")||normalized.contains("secret")||normalized.contains("authorization"))return "[REDACTED]";if(normalized.contains("email")&&value instanceof String email)return maskEmail(email);return sanitizeValue(value);}
    private String maskEmail(String email){int at=email.indexOf('@');if(at<=0)return "[REDACTED]";String local=email.substring(0,at);return local.substring(0,1)+"***"+email.substring(at);}
    private String clean(String value){return value==null||value.isBlank()?null:value.trim();}
    private String cell(String value){String safe=value==null?"":value.replaceAll("^[\\s]*([=+@-])","'$1");return "\""+safe.replace("\"","\"\"")+"\"";}
    private ResponseStatusException badRequest(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
    public record EventView(UUID id,UUID actorUserId,String actorName,String actorEmail,String eventType,String subjectType,UUID subjectId,Map<String,Object> details,Instant createdAt){}
    public record EventPage(List<EventView> items,int page,int pageSize,long totalElements,int totalPages){}
}
