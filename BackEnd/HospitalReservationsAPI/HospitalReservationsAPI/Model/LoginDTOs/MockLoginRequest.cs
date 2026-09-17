using System.ComponentModel.DataAnnotations;

namespace HospitalReservationsAPI.Model.Login_DTO
{
    public class MockLoginRequest
    {
        [Required]
        public string Ama { get; set; } = string.Empty;

        [Required]
        public string TenantCode { get; set; } = string.Empty; // π.χ. "L01"

        [Required]
        public string Role { get; set; } = string.Empty;       // π.χ. "Operator"

        [Required]
        public string Access { get; set; } = "view";           // "edit" | "view"
    }
}
