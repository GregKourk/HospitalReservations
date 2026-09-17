using System.ComponentModel.DataAnnotations;

namespace HospitalReservationsAPI.Model.DTOs
{
    public class MedicalRecordDto
    {
        public Guid RecordId { get; set; }
        public Guid PatientId { get; set; }
        public Guid? AppointmentId { get; set; }
        public Guid DoctorId { get; set; }
        public string DoctorName { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    public class MedicalRecordCreateRequest
    {
        [Required]
        public Guid PatientId { get; set; }
        public Guid? AppointmentId { get; set; }
        [Required]
        public string Notes { get; set; } = string.Empty;
    }

    public class MedicalRecordUpdateRequest
    {
        [Required]
        public string Notes { get; set; } = string.Empty;
    }
}
