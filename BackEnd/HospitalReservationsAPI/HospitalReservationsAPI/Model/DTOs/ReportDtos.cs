namespace HospitalReservationsAPI.Model.DTOs
{
    public class ClinicStatDto
    {
        public Guid ClinicId { get; set; }
        public string ClinicName { get; set; } = string.Empty;
        public int Total { get; set; }
        public int Completed { get; set; }
        public int Cancelled { get; set; }
        public int NoShow { get; set; }
        public double CompletionRate { get; set; }
    }

    public class DoctorStatDto
    {
        public Guid DoctorId { get; set; }
        public string DoctorName { get; set; } = string.Empty;
        public string ClinicName { get; set; } = string.Empty;
        public int Total { get; set; }
        public int Completed { get; set; }
        public int Cancelled { get; set; }
        public int NoShow { get; set; }
        public double CompletionRate { get; set; }
    }

    public class CancellationNoShowDto
    {
        public Guid AppointmentId { get; set; }
        public DateTimeOffset ScheduledStart { get; set; }
        public string ClinicName { get; set; } = string.Empty;
        public string DoctorName { get; set; } = string.Empty;
        public string PatientName { get; set; } = string.Empty;
        public string StatusCode { get; set; } = string.Empty;
        public string? Reason { get; set; }
    }
}
