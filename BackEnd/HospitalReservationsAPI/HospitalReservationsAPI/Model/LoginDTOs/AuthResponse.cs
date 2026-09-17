using HospitalReservationsAPI.Model.AppConfig;

namespace HospitalReservationsAPI.Model.Login_DTO
{
    public class AuthResponse
    {
        public string Token { get; set; }  
        public string RefreshToken { get; set; }  
        public DateTime JwtExpire { get; set; }
        public List<Page>? RootPages { get; set; }
        public AppUser appUser { get; set; }
        public string? ErrorMessage { get; set; }
        public string? ConsoleErrorMessage { get; set; }
        public bool hasError => !string.IsNullOrEmpty(ErrorMessage);
    }
}
