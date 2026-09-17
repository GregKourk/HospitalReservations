namespace HospitalReservationsAPI.Model.DTOs
{
    public class ExportLogRequest
    {
        public string EntityType { get; set; } = string.Empty;
        public string Format { get; set; } = string.Empty;
    }

    public class AuditLogDto
    {
        public long AuditLogId { get; set; }
        public DateTimeOffset Timestamp { get; set; }
        public Guid? UserId { get; set; }
        public string? UserName { get; set; }
        public string? Role { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public string? EntityId { get; set; }
        public string? SourceIp { get; set; }
        public string? UserAgent { get; set; }
        public string? BeforeSnapshot { get; set; }
        public string? AfterSnapshot { get; set; }
    }
}
