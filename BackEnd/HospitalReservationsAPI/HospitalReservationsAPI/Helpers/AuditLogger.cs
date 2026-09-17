using System.Text.Json;

namespace HospitalReservationsAPI.Helpers
{
    // Central write path for audit.AuditLogs so every controller captures the
    // same fields (.agent.master.md, Audit requirements) instead of each
    // action assembling the row by hand.
    public static class AuditLogger
    {
        public static async Task LogAsync(
            HospitalReservationsContext db,
            HttpContext http,
            string actionType,
            string entityType,
            string? entityId,
            object? before = null,
            object? after = null)
        {
            db.audit_AuditLogs.Add(new audit_AuditLog
            {
                UserId = http.User.GetUserId(),
                Role = http.User.GetRole(),
                Timestamp = DateTimeOffset.Now,
                ActionType = actionType,
                EntityType = entityType,
                EntityId = entityId,
                SourceIp = http.Connection.RemoteIpAddress?.ToString(),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
                BeforeSnapshot = before is null ? null : JsonSerializer.Serialize(before),
                AfterSnapshot = after is null ? null : JsonSerializer.Serialize(after)
            });

            await db.SaveChangesAsync();
        }
    }
}
