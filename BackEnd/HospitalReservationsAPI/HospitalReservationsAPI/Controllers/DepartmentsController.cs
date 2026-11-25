using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // Specialties ("Ειδικότητες"). Since 025_shared_specialties.sql this is one
    // list shared by every branch, so only Admin/SuperUser may change it — a
    // ClinicManager renaming "Καρδιολογία" would rename it for every branch.
    // Which branches offer a specialty follows from where its doctors work.
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

        // clinicId (or a ClinicManager's own clinic) narrows only DoctorCount,
        // not the list itself: every branch can pick from every specialty.
        [HttpGet]
        public async Task<ActionResult<List<DepartmentDto>>> GetAll([FromQuery] Guid? clinicId)
        {
            // null = count everywhere; otherwise only doctors working at these branches.
            List<Guid>? scope = clinicId.HasValue ? new List<Guid> { clinicId.Value } : null;
            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var own = await ClinicScopeHelper.GetManagedClinicIdsAsync(_db, User.GetUserId());
                scope = scope is null ? own : scope.Where(own.Contains).ToList();
            }

            var departments = await _db.Departments
                .Where(d => d.IsActive)
                .OrderBy(d => d.Name)
                .Select(d => new DepartmentDto
                {
                    DepartmentId = d.DepartmentId,
                    Name = d.Name,
                    IsActive = d.IsActive,
                    DoctorCount = d.Doctors.Count(doc => doc.IsActive && !doc.IsDeleted && (scope == null || doc.DoctorClinics.Any(dc => scope.Contains(dc.ClinicId))))
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
                    Name = d.Name,
                    IsActive = d.IsActive,
                    DoctorCount = d.Doctors.Count(doc => doc.IsActive && !doc.IsDeleted)
                })
                .FirstOrDefaultAsync();

            return department is null ? NotFound() : Ok(department);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,SuperUser")]
        public async Task<ActionResult<DepartmentDto>> Create(DepartmentUpsertRequest request)
        {
            var name = request.Name?.Trim() ?? string.Empty;
            if (name.Length == 0) return BadRequest("Το όνομα ειδικότητας είναι υποχρεωτικό.");

            // Names are unique across the table (UQ_Departments_Name), active
            // or not — re-creating a deleted specialty brings the old row back
            // instead of failing on the unique constraint.
            var existing = await _db.Departments.FirstOrDefaultAsync(d => d.Name == name);
            if (existing is { IsActive: true })
                return Conflict("Υπάρχει ήδη ειδικότητα με αυτό το όνομα.");

            Department department;
            if (existing is not null)
            {
                existing.IsActive = true;
                department = existing;
            }
            else
            {
                department = new Department { Name = name };
                _db.Departments.Add(department);
            }

            await _db.SaveChangesAsync();
            await AuditLogger.LogAsync(_db, HttpContext, existing is null ? "Create" : "Restore", "Department", department.DepartmentId.ToString(), after: request);

            return CreatedAtAction(nameof(GetById), new { id = department.DepartmentId }, new DepartmentDto
            {
                DepartmentId = department.DepartmentId,
                Name = department.Name,
                IsActive = department.IsActive
            });
        }

        [HttpPut("{id:guid}")]
        [Authorize(Roles = "Admin,SuperUser")]
        public async Task<IActionResult> Update(Guid id, DepartmentUpsertRequest request)
        {
            var name = request.Name?.Trim() ?? string.Empty;
            if (name.Length == 0) return BadRequest("Το όνομα ειδικότητας είναι υποχρεωτικό.");

            var department = await _db.Departments.FirstOrDefaultAsync(d => d.DepartmentId == id);
            if (department is null) return NotFound();

            if (await _db.Departments.AnyAsync(d => d.DepartmentId != id && d.Name == name))
                return Conflict("Υπάρχει ήδη ειδικότητα με αυτό το όνομα.");

            var before = new { department.Name };
            department.Name = name;

            // Doctors.Specialty mirrors the specialty's name (see DoctorsController).
            // Tracked (not ExecuteUpdate) so it commits together with the rename.
            foreach (var doctor in await _db.Doctors.Where(d => d.DepartmentId == id).ToListAsync())
                doctor.Specialty = name;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Update", "Department", id.ToString(), before, request);

            return NoContent();
        }

        [HttpDelete("{id:guid}")]
        [Authorize(Roles = "Admin,SuperUser")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var department = await _db.Departments.FirstOrDefaultAsync(d => d.DepartmentId == id);
            if (department is null) return NotFound();

            if (await _db.Doctors.AnyAsync(d => d.DepartmentId == id && d.IsActive && !d.IsDeleted))
                return Conflict("Υπάρχουν ενεργοί γιατροί σε αυτή την ειδικότητα. Μετάφερέ τους σε άλλη ειδικότητα πριν τη διαγραφή.");

            department.IsActive = false;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Delete", "Department", id.ToString());

            return NoContent();
        }

        private bool IsHigherPrivileged() => User.IsInRole("Admin") || User.IsInRole("SuperUser");
    }
}
