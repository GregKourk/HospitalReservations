using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize]
    public class ClinicsController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public ClinicsController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<ClinicDto>>> GetAll([FromQuery] bool includeInactive = false)
        {
            var query = _db.Clinics.Where(c => !c.IsDeleted);
            if (!includeInactive)
                query = query.Where(c => c.IsActive);

            // "Κλινικές (scope: δική του)" — a ClinicManager only ever sees
            // the one clinic they manage, not the whole list.
            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                query = query.Where(c => c.ClinicId == ownClinicId);
            }

            var clinics = await query
                .OrderBy(c => c.Name)
                .Select(c => new ClinicDto
                {
                    ClinicId = c.ClinicId,
                    Name = c.Name,
                    Address = c.Address,
                    Phone = c.Phone,
                    IsActive = c.IsActive,
                    ManagerUserId = c.ManagerUserId,
                    ManagerName = c.ManagerUser != null ? c.ManagerUser.FullName : null
                })
                .ToListAsync();

            return Ok(clinics);
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ClinicDto>> GetById(Guid id)
        {
            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                if (id != ownClinicId) return Forbid();
            }

            var clinic = await _db.Clinics.Where(c => c.ClinicId == id && !c.IsDeleted)
                .Select(c => new ClinicDto
                {
                    ClinicId = c.ClinicId,
                    Name = c.Name,
                    Address = c.Address,
                    Phone = c.Phone,
                    IsActive = c.IsActive,
                    ManagerUserId = c.ManagerUserId,
                    ManagerName = c.ManagerUser != null ? c.ManagerUser.FullName : null
                })
                .FirstOrDefaultAsync();

            return clinic is null ? NotFound() : Ok(clinic);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,SuperUser")]
        public async Task<ActionResult<ClinicDto>> Create(ClinicUpsertRequest request)
        {
            var clinic = new Clinic
            {
                Name = request.Name,
                Address = request.Address,
                Phone = request.Phone,
                ManagerUserId = request.ManagerUserId
            };

            _db.Clinics.Add(clinic);
            await _db.SaveChangesAsync();
            await AuditLogger.LogAsync(_db, HttpContext, "Create", "Clinic", clinic.ClinicId.ToString(), after: request);

            return CreatedAtAction(nameof(GetById), new { id = clinic.ClinicId }, new ClinicDto
            {
                ClinicId = clinic.ClinicId,
                Name = clinic.Name,
                Address = clinic.Address,
                Phone = clinic.Phone,
                IsActive = clinic.IsActive,
                ManagerUserId = clinic.ManagerUserId
            });
        }

        [HttpPut("{id:guid}")]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
        public async Task<IActionResult> Update(Guid id, ClinicUpsertRequest request)
        {
            var isClinicManagerOnly = User.IsInRole("ClinicManager") && !IsHigherPrivileged();
            if (isClinicManagerOnly)
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                if (id != ownClinicId) return Forbid();
            }

            var clinic = await _db.Clinics.FirstOrDefaultAsync(c => c.ClinicId == id && !c.IsDeleted);
            if (clinic is null) return NotFound();

            var before = new { clinic.Name, clinic.Address, clinic.Phone, clinic.ManagerUserId };

            clinic.Name = request.Name;
            clinic.Address = request.Address;
            clinic.Phone = request.Phone;
            // A ClinicManager can edit their own clinic's details but can't
            // reassign who manages it — only Admin/SuperUser can.
            if (!isClinicManagerOnly)
                clinic.ManagerUserId = request.ManagerUserId;
            clinic.UpdatedAt = DateTimeOffset.Now;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Update", "Clinic", id.ToString(), before, request);

            return NoContent();
        }

        [HttpDelete("{id:guid}")]
        [Authorize(Roles = "Admin,SuperUser")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var clinic = await _db.Clinics.FirstOrDefaultAsync(c => c.ClinicId == id && !c.IsDeleted);
            if (clinic is null) return NotFound();

            clinic.IsDeleted = true;
            clinic.IsActive = false;
            clinic.DeletedAt = DateTimeOffset.Now;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Delete", "Clinic", id.ToString());

            return NoContent();
        }

        private bool IsHigherPrivileged() => User.IsInRole("Admin") || User.IsInRole("SuperUser");
    }
}
