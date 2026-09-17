using HospitalReservationsAPI.Model.AppConfig;

namespace HospitalReservationsAPI.Model.DTOs
{
    public class TokenResponse
    {
        public string AccessToken { get; set; } = string.Empty;
        public DateTimeOffset AccessTokenExpiresAt { get; set; }
        public Guid UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public List<string> Roles { get; set; } = new();
        public List<Page> RootPages { get; set; } = new();
    }

    public class TokenExchangeRequest
    {
        public string Code { get; set; } = string.Empty;
    }

    // Dev-only stand-in for the Gov.gr flow — picks/creates one demo user per
    // role so every screen can be exercised before real credentials exist.
    public class MockLoginRequest
    {
        public string Role { get; set; } = string.Empty;
    }
}
