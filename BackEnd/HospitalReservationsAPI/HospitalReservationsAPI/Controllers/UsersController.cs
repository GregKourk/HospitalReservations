using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // Provisioning/deprovisioning staff accounts and role assignment. Real
    // sign-in only ever happens through Gov.gr, and self-service Gov.gr
    // sign-in only ever grants Patient (AuthController.GovGrComplete) — so
    // this is the ONLY place a Reception/ClinicManager/Admin/SuperUser
    // account gets its elevated role, either pre-provisioned by email before
    // the person's first login, or granted afterwards once their Users row
    // already exists.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize(Roles = "Admin,SuperUser")]
    public class UsersController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public UsersController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<UserDto>>> GetAll([FromQuery] string? search, [FromQuery] bool includeInactive = false)
        {
            var query = _db.Users.Where(u => !u.IsDeleted);
            if (!includeInactive) query = query.Where(u => u.IsActive);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                query = query.Where(u => u.FullName.Contains(term) || u.Email.Contains(term));
            }

            var users = await query
                .OrderBy(u => u.FullName)
                .Select(u => new UserDto
                {
                    UserId = u.UserId,
                    Email = u.Email,
                    FullName = u.FullName,
                    ExternalProvider = u.ExternalProvider,
                    IsActive = u.IsActive,
                    CreatedAt = u.CreatedAt,
                    Roles = u.UserRoles_UserId.Select(ur => ur.Role.Name).OrderBy(n => n).ToList()
                })
                .ToListAsync();

            return Ok(users);
        }

        // Find-or-provision by email, same shape as DoctorsController.Create.
        // Only ever creates a NEW account — an existing one is managed via
        // {id}/Roles and {id}/Status instead, so this can't accidentally
        // rename/reassign someone else's login.
        [HttpPost]
        public async Task<ActionResult<Guid>> Create(UserCreateRequest request)
        {
            if (await _db.Users.AnyAsync(u => u.Email == request.Email))
                return Conflict("Υπάρχει ήδη χρήστης με αυτό το email — χρησιμοποίησε «Ρόλοι» στον υπάρχοντα λογαριασμό.");

            var roles = await _db.Roles.Where(r => request.RoleIds.Contains(r.RoleId)).ToListAsync();
            if (roles.Count != request.RoleIds.Distinct().Count())
                return BadRequest("Άγνωστος ρόλος.");

            if (roles.Any(r => r.Name == "SuperUser") && !User.IsInRole("SuperUser"))
                return Forbid();

            var user = new User { Email = request.Email, FullName = request.FullName };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            var actorId = User.GetUserId();
            foreach (var role in roles)
                _db.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = role.RoleId, AssignedByUserId = actorId });
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Create", "User", user.UserId.ToString(),
                after: new { request.Email, request.FullName, Roles = roles.Select(r => r.Name) });

            return Ok(user.UserId);
        }

        [HttpPut("{id:guid}/Roles")]
        public async Task<IActionResult> UpdateRoles(Guid id, UserRolesUpdateRequest request)
        {
            var user = await _db.Users
                .Include(u => u.UserRoles_UserId).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.UserId == id && !u.IsDeleted);
            if (user is null) return NotFound();

            var requestedRoles = await _db.Roles.Where(r => request.RoleIds.Contains(r.RoleId)).ToListAsync();
            if (requestedRoles.Count != request.RoleIds.Distinct().Count())
                return BadRequest("Άγνωστος ρόλος.");

            var before = user.UserRoles_UserId.Select(ur => ur.Role.Name).ToList();
            var currentlyHasSuperUser = before.Contains("SuperUser");
            var willHaveSuperUser = requestedRoles.Any(r => r.Name == "SuperUser");

            // Only a SuperUser can grant/revoke the SuperUser role itself —
            // an Admin can manage every other role but not self-promote or
            // promote a peer to the top tier.
            if (currentlyHasSuperUser != willHaveSuperUser && !User.IsInRole("SuperUser"))
                return Forbid();

            if (id == User.GetUserId() && currentlyHasSuperUser && !willHaveSuperUser)
                return BadRequest("Δεν μπορείς να αφαιρέσεις τον δικό σου ρόλο SuperUser.");

            var toRemove = user.UserRoles_UserId.Where(ur => !request.RoleIds.Contains(ur.RoleId)).ToList();
            _db.UserRoles.RemoveRange(toRemove);

            var existingRoleIds = user.UserRoles_UserId.Select(ur => ur.RoleId).ToHashSet();
            var actorId = User.GetUserId();
            foreach (var role in requestedRoles.Where(r => !existingRoleIds.Contains(r.RoleId)))
                _db.UserRoles.Add(new UserRole { UserId = id, RoleId = role.RoleId, AssignedByUserId = actorId });

            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "UpdateRoles", "User", id.ToString(),
                before: new { Roles = before }, after: new { Roles = requestedRoles.Select(r => r.Name) });

            return NoContent();
        }

        [HttpPut("{id:guid}/Status")]
        public async Task<IActionResult> UpdateStatus(Guid id, UserStatusUpdateRequest request)
        {
            if (id == User.GetUserId() && !request.IsActive)
                return BadRequest("Δεν μπορείς να απενεργοποιήσεις τον δικό σου λογαριασμό.");

            var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == id && !u.IsDeleted);
            if (user is null) return NotFound();

            var before = new { user.IsActive };
            user.IsActive = request.IsActive;
            user.UpdatedAt = DateTimeOffset.Now;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, request.IsActive ? "Activate" : "Deactivate", "User", id.ToString(), before, new { user.IsActive });

            return NoContent();
        }
    }
}
