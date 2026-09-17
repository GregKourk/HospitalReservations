using System.ComponentModel.DataAnnotations;

namespace HospitalReservationsAPI.Model.Login_DTO
{
    public class AuthRequest
    {
        [Required(AllowEmptyStrings = true)]
        public string Username { get; set; } = string.Empty;
        [Required(AllowEmptyStrings = true)]
        public string Password { get; set; } = string.Empty;
        public bool RememberMe { get; set; } = false;
        public string? ServerIp { get; set; }

        // Mock-only fields (dev mode)
        public bool IsMock { get; set; } = false;
        public string? MockAma { get; set; }
        public string? MockTenantCode { get; set; }
        public string? MockRole { get; set; }
        public string? MockAccess { get; set; }
    }
}
