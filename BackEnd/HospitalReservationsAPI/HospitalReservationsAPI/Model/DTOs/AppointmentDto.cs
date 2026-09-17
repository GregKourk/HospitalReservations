namespace HospitalReservationsAPI.Model.DTOs
{
    public class AppointmentDto
    {
        public Guid AppointmentId { get; set; }
        public Guid ClinicId { get; set; }
        public Guid DepartmentId { get; set; }
        public Guid DoctorId { get; set; }
        public string DoctorName { get; set; } = string.Empty;
        public Guid PatientId { get; set; }
        public string PatientName { get; set; } = string.Empty;
        public DateTimeOffset ScheduledStart { get; set; }
        public DateTimeOffset ScheduledEnd { get; set; }
        public byte AppointmentStatusId { get; set; }
        public string StatusCode { get; set; } = string.Empty;
        public string? Reason { get; set; }
    }

    public class AppointmentCreateRequest
    {
        public Guid ClinicId { get; set; }
        public Guid DepartmentId { get; set; }
        public Guid DoctorId { get; set; }
        public Guid PatientId { get; set; }
        public DateTimeOffset ScheduledStart { get; set; }
        public DateTimeOffset ScheduledEnd { get; set; }
        public string? Reason { get; set; }
    }

    public class AppointmentStatusChangeRequest
    {
        public byte AppointmentStatusId { get; set; }
        public string? Reason { get; set; }
    }

    public class AppointmentRescheduleRequest
    {
        public DateTimeOffset ScheduledStart { get; set; }
        public DateTimeOffset ScheduledEnd { get; set; }
    }
}
