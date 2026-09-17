namespace HospitalReservationsAPI.Model.AppConfig
{
    public class AppConfiguration
    {
        public LoginConfigStatus LoginConfigStatus { get; set; }
        public UserLoginSettings UserLoginSettings { get; set; }
    }

    public class UserLoginSettings
    {
        public List<ChangeUserDataEntry> ChangeUserData { get; set; } = new();
        public List<ByPassLoginUser> ByPassLoginService { get; set; } = new();
        public int MaxFailedLoginAttempts { get; set; }
        public int LockoutDurationMinutes { get; set; }
    }

    public class ByPassLoginUser
    {
        public int UserId { get; set; }
        public string UserTitle { get; set; } = "";
        public int ThesiId { get; set; }
        public string Thesi { get; set; } = "";
        public int Monada { get; set; }
        public string Ama { get; set; } = "";
        public long TenantId { get; set; }
        public List<ConfigAppRight> APP_RIGHTS { get; set; } = new();
    }

    public class ChangeUserDataEntry
    {
        public string AMA { get; set; } = "";
        public int Monada { get; set; }
        public int ThesiId { get; set; }
        public string Thesi { get; set; } = "";
        public List<ConfigAppRight> APP_RIGHTS { get; set; } = new();
    }

    public class ConfigAppRight
    {
        public string APP_RIGHT1 { get; set; } = "";
    }

    public class LoginConfigStatus
    {
        public bool IsLocked { get; set; }
        public string LockedMsg { get; set; } = "";
        public string InfoMsg { get; set; } = "";
    }
}