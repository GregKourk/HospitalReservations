using System.ComponentModel.DataAnnotations;

namespace HospitalReservationsAPI.Model.DTOs
{
    public class PatientDto
    {
        public Guid PatientId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string? Amka { get; set; }
        public DateTime DateOfBirth { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
    }

    public class PatientUpsertRequest
    {
        [Required]
        public string FirstName { get; set; } = string.Empty;
        [Required]
        public string LastName { get; set; } = string.Empty;
        [RegularExpression(@"^\d{11}$", ErrorMessage = "Το ΑΜΚΑ πρέπει να έχει 11 ψηφία.")]
        public string? Amka { get; set; }
        public DateTime DateOfBirth { get; set; }
        public string? Phone { get; set; }
        [EmailAddress]
        public string? Email { get; set; }
    }
}
