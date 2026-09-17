using System.ComponentModel.DataAnnotations;

namespace HospitalReservationsAPI.Model.DTOs
{
    public class UserDto
    {
        public Guid UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string? ExternalProvider { get; set; }
        public bool IsActive { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public List<string> Roles { get; set; } = new();
    }

    // Pre-provisions an account before the person's first Gov.gr sign-in —
    // the same find-or-create-by-email idea as DoctorsController.Create,
    // generalized to any role instead of always Doctor. Self-service Gov.gr
    // sign-in only ever grants Patient (AuthController.GovGrComplete), so
    // this is the only way a Reception/ClinicManager/Admin/SuperUser account
    // gets its role.
    public class UserCreateRequest
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;
        [Required]
        public string FullName { get; set; } = string.Empty;
        [Required, MinLength(1)]
        public List<int> RoleIds { get; set; } = new();
    }

    public class UserRolesUpdateRequest
    {
        public List<int> RoleIds { get; set; } = new();
    }

    public class UserStatusUpdateRequest
    {
        public bool IsActive { get; set; }
    }

    public class RoleLookupDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
    }
}
