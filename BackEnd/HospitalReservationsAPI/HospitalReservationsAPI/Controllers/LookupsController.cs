using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // Combo/dropdown data for every create/edit form: clinics, departments,
    // doctors, appointment statuses. Every screen in the UI list needs at
    // least one of these.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize]
    public class LookupsController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public LookupsController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet("Clinics")]
        public async Task<ActionResult<List<LookupItemDto>>> Clinics()
        {
            var items = await _db.Clinics
                .Where(c => c.IsActive && !c.IsDeleted)
                .OrderBy(c => c.Name)
                .Select(c => new LookupItemDto { Id = c.ClinicId, Text = c.Name })
                .ToListAsync();

            return Ok(items);
        }

        [HttpGet("Departments")]
        public async Task<ActionResult<List<LookupItemDto>>> Departments([FromQuery] Guid? clinicId)
        {
            var query = _db.Departments.Where(d => d.IsActive);
            if (clinicId.HasValue)
                query = query.Where(d => d.ClinicId == clinicId);

            var items = await query
                .OrderBy(d => d.Name)
                .Select(d => new LookupItemDto { Id = d.DepartmentId, Text = d.Name })
                .ToListAsync();

            return Ok(items);
        }

        [HttpGet("Doctors")]
        public async Task<ActionResult<List<LookupItemDto>>> Doctors([FromQuery] Guid? clinicId, [FromQuery] Guid? departmentId)
        {
            var query = _db.Doctors.Where(d => d.IsActive && !d.IsDeleted);
            if (clinicId.HasValue) query = query.Where(d => d.ClinicId == clinicId);
            if (departmentId.HasValue) query = query.Where(d => d.DepartmentId == departmentId);

            var items = await query
                .OrderBy(d => d.User.FullName)
                .Select(d => new LookupItemDto { Id = d.DoctorId, Text = d.User.FullName + " — " + d.Specialty })
                .ToListAsync();

            return Ok(items);
        }

        [HttpGet("AppointmentStatuses")]
        public async Task<ActionResult<List<StatusLookupDto>>> AppointmentStatuses()
        {
            var items = await _db.AppointmentStatus
                .OrderBy(s => s.AppointmentStatusId)
                .Select(s => new StatusLookupDto { Id = s.AppointmentStatusId, Code = s.Code, Description = s.Description })
                .ToListAsync();

            return Ok(items);
        }

        [HttpGet("Roles")]
        [Authorize(Roles = "Admin,SuperUser")]
        public async Task<ActionResult<List<RoleLookupDto>>> Roles()
        {
            var items = await _db.Roles
                .OrderBy(r => r.Name)
                .Select(r => new RoleLookupDto { Id = r.RoleId, Name = r.Name, Description = r.Description })
                .ToListAsync();

            return Ok(items);
        }
    }
}
