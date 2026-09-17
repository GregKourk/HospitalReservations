namespace HospitalReservationsAPI.Model.DTOs
{
    public class ClinicDto
    {
        public Guid ClinicId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? Phone { get; set; }
        public bool IsActive { get; set; }
        public Guid? ManagerUserId { get; set; }
        public string? ManagerName { get; set; }
    }

    public class ClinicUpsertRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? Phone { get; set; }
        // Only ever applied when the caller is Admin/SuperUser — a
        // ClinicManager sending this on their own clinic's update is
        // silently ignored, not trusted to reassign their own manager.
        public Guid? ManagerUserId { get; set; }
    }
}
