namespace HospitalReservationsAPI.Model.DTOs
{
    public class DashboardSummaryDto
    {
        public int TotalClinics { get; set; }
        public int TotalDepartments { get; set; }
        public int TotalDoctors { get; set; }
        public int TotalPatients { get; set; }
        public int TotalActiveUsers { get; set; }
        public List<StatusCountDto> AppointmentsToday { get; set; } = new();
        public int AppointmentsThisWeek { get; set; }
        public int CancellationsLast30Days { get; set; }
        public int NoShowsLast30Days { get; set; }
        public List<RecentActivityDto> RecentActivity { get; set; } = new();
    }

    public class StatusCountDto
    {
        public string StatusCode { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int Count { get; set; }
    }

    public class RecentActivityDto
    {
        public DateTimeOffset Timestamp { get; set; }
        public string? UserName { get; set; }
        public string? Role { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public string? EntityId { get; set; }
    }
}
