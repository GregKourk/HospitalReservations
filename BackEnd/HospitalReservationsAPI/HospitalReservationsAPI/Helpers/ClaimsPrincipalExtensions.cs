using System.Security.Claims;

namespace HospitalReservationsAPI.Helpers
{
    public static class ClaimsPrincipalExtensions
    {
        public static Guid? GetUserId(this ClaimsPrincipal user)
        {
            var value = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }

        public static string? GetRole(this ClaimsPrincipal user)
            => user.FindFirst(ClaimTypes.Role)?.Value;
    }
}
