namespace HospitalReservationsAPI.Model.DTOs
{
    public class DepartmentDto
    {
        public Guid DepartmentId { get; set; }
        public Guid ClinicId { get; set; }
        public string ClinicName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }

    public class DepartmentUpsertRequest
    {
        public Guid ClinicId { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}
