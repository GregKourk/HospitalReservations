using HospitalReservationsAPI.Model.Interfaces;
using System.Security.Claims;

namespace HospitalReservationsAPI.Model
{
    public class AppUser : IAppUser
    {
        public int UserId { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Ama { get; set; }
        public string Title { get; set; }
        public int ThesiId { get; set; }
        public string Thesi { get; set; }
        public int UnitId { get; set; }
        public string? UserIpAddress { get; set; }
        public List<string> Roles { get; set; }
        public Dictionary<string, string> Claims { get; set; }
        public int TopLevelUnitId { get; set; }
        public string? TopLevelTitle { get; set; }
        public string? FullName => $"{LastName} {FirstName}";
        public bool hasEditRole { get; set; }
        public string byPassUnitLoggedIn { get; set; } = "";
        public long TenantId { get; set; }
        public List<long> TenantIds { get; set; } = new();      // self + children → global filter
        public long FiscalYearTenantId { get; set; }            // parent's TenantId (ή εαυτός αν parent)
        public string TenantName { get; set; } = "";            // όνομα δικού tenant
        public string? ParentTenantName { get; set; }           // όνομα parent (null αν ο ίδιος είναι parent)
        public string Access { get; set; } = "view"; // "edit" | "view"
        public bool IsGlobalViewer { get; set; }     // cross-tenant read-only
        public bool IsSupervisor { get; set; }       // εποπτεία συγκεκριμένων λογιστηρίων
        public bool isParentTenant { get; set; }

        public AppUser()
        {
        }

        public static implicit operator AppUser(ClaimsIdentity claimsIdentity)
        {
            if (claimsIdentity == null) return new AppUser();

            string? Get(string type) =>
                claimsIdentity.Claims.FirstOrDefault(c => c.Type == type)?.Value;

            bool TryBool(string type, bool def = false) =>
                bool.TryParse(Get(type), out var b) ? b : def;

            int TryInt(string type, int def = 0) =>
                int.TryParse(Get(type), out var i) ? i : def;

            return new AppUser
            {
                UserId = TryInt(ClaimTypes.NameIdentifier),
                FirstName = Get(ClaimTypes.GivenName) ?? "",
                LastName = Get(ClaimTypes.Surname) ?? "",
                Ama = Get("AMA") ?? "",
                Title = Get(ClaimTypes.Name) ?? "",
                ThesiId = TryInt("ThesiId"),
                Thesi = Get("Thesi") ?? "",
                UnitId = TryInt("UnitId"),
                UserIpAddress = Get("UserIpAddress"),
                Roles = claimsIdentity.Claims.Where(x => x.Type == ClaimTypes.Role).Select(c => c.Value).ToList(),
                TopLevelUnitId = TryInt("TopLevelUnitId"),
                TopLevelTitle = Get("TopLevelTitle"),
                hasEditRole = TryBool("HasEditRole"),
                byPassUnitLoggedIn = Get("ByPassUnitLoggedIn") ?? "",
                TenantId = TryInt("TenantId"),
                Access = Get("Access") ?? "view",
                IsGlobalViewer = TryBool("GlobalViewer"),
                IsSupervisor = TryBool("Supervisor"),
                isParentTenant = TryBool("isParentTenant")
            };
        }
    }
}
