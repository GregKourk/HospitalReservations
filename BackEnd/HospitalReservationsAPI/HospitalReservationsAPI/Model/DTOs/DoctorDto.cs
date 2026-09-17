using System.ComponentModel.DataAnnotations;

namespace HospitalReservationsAPI.Model.DTOs
{
    public class DoctorDto
    {
        public Guid DoctorId { get; set; }
        public Guid ClinicId { get; set; }
        public string ClinicName { get; set; } = string.Empty;
        public Guid DepartmentId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Amka { get; set; }
        public string Specialty { get; set; } = string.Empty;
        public string LicenseNumber { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }

    // Creating a doctor also provisions the identity behind it (find-by-email,
    // or create) and grants the Doctor role — there's no separate "create a
    // user" admin screen, so this is the one place that account gets made.
    public class DoctorCreateRequest
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;
        [Required]
        public string FullName { get; set; } = string.Empty;
        public Guid ClinicId { get; set; }
        public Guid DepartmentId { get; set; }
        [RegularExpression(@"^\d{11}$", ErrorMessage = "Το ΑΜΚΑ πρέπει να έχει 11 ψηφία.")]
        public string? Amka { get; set; }
        public string Specialty { get; set; } = string.Empty;
        public string LicenseNumber { get; set; } = string.Empty;
    }

    public class DoctorUpdateRequest
    {
        public Guid ClinicId { get; set; }
        public Guid DepartmentId { get; set; }
        [RegularExpression(@"^\d{11}$", ErrorMessage = "Το ΑΜΚΑ πρέπει να έχει 11 ψηφία.")]
        public string? Amka { get; set; }
        public string Specialty { get; set; } = string.Empty;
        public string LicenseNumber { get; set; } = string.Empty;
    }

    public class DoctorAvailabilitySlotDto
    {
        public DateTimeOffset Start { get; set; }
        public DateTimeOffset End { get; set; }
    }
}
