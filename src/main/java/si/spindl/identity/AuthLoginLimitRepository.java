package si.spindl.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface AuthLoginLimitRepository extends JpaRepository<AuthLoginLimitEntity, String> {
    @Query(value = "select exists(select 1 from auth_login_limits where bucket_key=:key and (blocked_until>:now or (window_started_at>=:windowStart and failure_count>=:threshold)))", nativeQuery = true)
    boolean isBlocked(@Param("key") String key, @Param("now") Instant now,
                      @Param("windowStart") Instant windowStart, @Param("threshold") int threshold);

    @Modifying
    @Query(value = "insert into auth_login_limits(bucket_key,window_started_at,failure_count,blocked_until,updated_at) values (:key,:now,1,case when :threshold<=1 then cast(:blockedUntil as timestamptz) else null end,:now) " +
            "on conflict(bucket_key) do update set " +
            "window_started_at=case when auth_login_limits.window_started_at<:windowStart then :now else auth_login_limits.window_started_at end, " +
            "failure_count=case when auth_login_limits.window_started_at<:windowStart then 1 else auth_login_limits.failure_count+1 end, " +
            "blocked_until=case when auth_login_limits.window_started_at<:windowStart then case when :threshold<=1 then cast(:blockedUntil as timestamptz) else null end " +
            "when auth_login_limits.failure_count+1>=:threshold then cast(:blockedUntil as timestamptz) else auth_login_limits.blocked_until end,updated_at=:now", nativeQuery = true)
    int recordFailure(@Param("key") String key, @Param("now") Instant now, @Param("windowStart") Instant windowStart,
                      @Param("blockedUntil") Instant blockedUntil, @Param("threshold") int threshold);

    @Modifying
    @Query(value = "delete from auth_login_limits where bucket_key=:emailKey", nativeQuery = true)
    int clearEmail(@Param("emailKey") String emailKey);

    @Modifying
    @Query(value = "delete from auth_login_limits where updated_at<:cutoff", nativeQuery = true)
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
