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
    public class DepartmentsController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public DepartmentsController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<DepartmentDto>>> GetAll([FromQuery] Guid? clinicId)
        {
            var query = _db.Departments.Where(d => d.IsActive);

            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                query = query.Where(d => d.ClinicId == ownClinicId);
            }
            else if (clinicId.HasValue)
            {
                query = query.Where(d => d.ClinicId == clinicId);
            }

            var departments = await query
                .OrderBy(d => d.Clinic.Name).ThenBy(d => d.Name)
                .Select(d => new DepartmentDto
                {
                    DepartmentId = d.DepartmentId,
                    ClinicId = d.ClinicId,
                    ClinicName = d.Clinic.Name,
                    Name = d.Name,
                    IsActive = d.IsActive
                })
                .ToListAsync();

            return Ok(departments);
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<DepartmentDto>> GetById(Guid id)
        {
            var department = await _db.Departments.Where(d => d.DepartmentId == id)
                .Select(d => new DepartmentDto
                {
                    DepartmentId = d.DepartmentId,
                    ClinicId = d.ClinicId,
                    ClinicName = d.Clinic.Name,
                    Name = d.Name,
                    IsActive = d.IsActive
                })
                .FirstOrDefaultAsync();

            return department is null ? NotFound() : Ok(department);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
        public async Task<ActionResult<DepartmentDto>> Create(DepartmentUpsertRequest request)
        {
            if (await GetClinicScopeErrorAsync(request.ClinicId) is { } error) return error;

            var department = new Department
            {
                ClinicId = request.ClinicId,
                Name = request.Name
            };

            _db.Departments.Add(department);
            await _db.SaveChangesAsync();
            await AuditLogger.LogAsync(_db, HttpContext, "Create", "Department", department.DepartmentId.ToString(), after: request);

            return CreatedAtAction(nameof(GetById), new { id = department.DepartmentId }, new DepartmentDto
            {
                DepartmentId = department.DepartmentId,
                ClinicId = department.ClinicId,
                Name = department.Name,
                IsActive = department.IsActive
            });
        }

        [HttpPut("{id:guid}")]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
        public async Task<IActionResult> Update(Guid id, DepartmentUpsertRequest request)
        {
            var department = await _db.Departments.FirstOrDefaultAsync(d => d.DepartmentId == id);
            if (department is null) return NotFound();

            // Both the department's current clinic and the (possibly new)
            // target clinic must be the manager's own — otherwise this would
            // let a ClinicManager either edit another clinic's department or
            // move their own department out to a clinic they don't run.
            if (await GetClinicScopeErrorAsync(department.ClinicId) is { } error1) return error1;
            if (await GetClinicScopeErrorAsync(request.ClinicId) is { } error2) return error2;

            var before = new { department.ClinicId, department.Name };

            department.ClinicId = request.ClinicId;
            department.Name = request.Name;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Update", "Department", id.ToString(), before, request);

            return NoContent();
        }

        [HttpDelete("{id:guid}")]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var department = await _db.Departments.FirstOrDefaultAsync(d => d.DepartmentId == id);
            if (department is null) return NotFound();

            if (await GetClinicScopeErrorAsync(department.ClinicId) is { } error) return error;

            department.IsActive = false;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Delete", "Department", id.ToString());

            return NoContent();
        }

        private bool IsHigherPrivileged() => User.IsInRole("Admin") || User.IsInRole("SuperUser");

        // Returns an IActionResult (Forbid) if this ClinicManager doesn't own
        // the given clinic — null if the check passes or doesn't apply.
        private async Task<ActionResult?> GetClinicScopeErrorAsync(Guid clinicId)
        {
            if (!User.IsInRole("ClinicManager") || IsHigherPrivileged()) return null;
            var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
            return clinicId == ownClinicId ? null : Forbid();
        }
    }
}
