package com.nexus.calendar;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/** Creates one in-app notification for each authorized recipient and reminder offset. */
@Service
public class CalendarReminderService {
    private final JdbcTemplate db;

    public CalendarReminderService(JdbcTemplate db) { this.db = db; }

    @Scheduled(fixedDelay = 60000)
    public void deliverDueReminders() {
        for (Map<String, Object> event : db.queryForList("""
            SELECT e.id,e.organization_id,e.title,e.starts_at,e.team_id,r.reminder_minutes
            FROM calendar.events e
            CROSS JOIN LATERAL unnest(e.reminder_minutes) r(reminder_minutes)
            WHERE e.deleted_at IS NULL
              AND e.starts_at > now()
              AND e.starts_at - (r.reminder_minutes * interval '1 minute') <= now()
              AND e.starts_at - (r.reminder_minutes * interval '1 minute') > now() - interval '2 minutes'
            """)) {
            UUID eventId = (UUID) event.get("id");
            UUID orgId = (UUID) event.get("organization_id");
            UUID teamId = (UUID) event.get("team_id");
            int minutes = ((Number) event.get("reminder_minutes")).intValue();
            OffsetDateTime startsAt = (OffsetDateTime) event.get("starts_at");
            for (Map<String, Object> recipient : db.queryForList("""
                SELECT m.user_id
                FROM org.memberships m
                WHERE m.organization_id=?
                  AND (? IS NULL OR EXISTS (SELECT 1 FROM org.team_members tm WHERE tm.team_id=? AND tm.user_id=m.user_id))
                """, orgId, teamId, teamId)) {
                UUID userId = (UUID) recipient.get("user_id");
                int inserted = db.update("""
                    INSERT INTO calendar.event_reminders(id,event_id,user_id,reminder_minutes,scheduled_for)
                    VALUES(?,?,?,?,?) ON CONFLICT(event_id,user_id,reminder_minutes) DO NOTHING
                    """, UUID.randomUUID(), eventId, userId, minutes, startsAt.minusMinutes(minutes));
                if (inserted == 1) {
                    db.update("""
                        INSERT INTO notification.notifications(id,organization_id,user_id,type,title,body)
                        VALUES(?,?,?,?,?,?)
                        """, UUID.randomUUID(), orgId, userId, "EVENT_REMINDER", "Upcoming event",
                        event.get("title") + " starts in " + minutes + " minute" + (minutes == 1 ? "" : "s") + ".");
                }
            }
        }
    }
}
