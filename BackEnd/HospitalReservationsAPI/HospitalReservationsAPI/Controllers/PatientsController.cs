using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // Reception's primary screen: find or register a patient before booking.
    // Patients don't browse each other's records, so every action here is
    // staff-only (data minimization / least privilege) EXCEPT Me(), a
    // Patient's own self-service lookup — a class-level Roles restriction
    // would AND against that method's own [Authorize(Roles="Patient")] and
    // lock it out entirely, so the staff-only restriction is applied
    // per-action here instead of at the class level.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize]
    public class PatientsController : BaseApiController
    {
        private const string StaffRoles = "Admin,SuperUser,ClinicManager,Reception,Doctor";

        private readonly HospitalReservationsContext _db;

        public PatientsController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        [Authorize(Roles = StaffRoles)]
        public async Task<ActionResult<List<PatientDto>>> Search([FromQuery] string? search, [FromQuery] int take = 50)
        {
            var query = _db.Patients.Where(p => !p.IsDeleted);

            // "Ασθενείς μου": a Doctor only ever browses patients they've
            // actually had an appointment with — not the whole patient base
            // the way Reception/ClinicManager/Admin can.
            if (User.IsInRole("Doctor") && !IsPrivilegedStaff())
            {
                var ownDoctorId = await GetOwnDoctorIdAsync();
                query = query.Where(p => _db.Appointments.Any(a => a.PatientId == p.PatientId && a.DoctorId == ownDoctorId));
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                query = query.Where(p =>
                    p.FirstName.Contains(term) ||
                    p.LastName.Contains(term) ||
                    (p.Amka != null && p.Amka.Contains(term)) ||
                    (p.Phone != null && p.Phone.Contains(term)));
            }

            var patients = await query
                .OrderBy(p => p.LastName).ThenBy(p => p.FirstName)
                .Take(Math.Clamp(take, 1, 1000))
                .Select(p => new PatientDto
                {
                    PatientId = p.PatientId,
                    FirstName = p.FirstName,
                    LastName = p.LastName,
                    Amka = p.Amka,
                    DateOfBirth = p.DateOfBirth,
                    Phone = p.Phone,
                    Email = p.Email
                })
                .ToListAsync();

            return Ok(patients);
        }

        // Self-service lookup so a Patient can see their own record — "Το
        // Προφίλ μου / Προσωπικά Στοιχεία". Every other action on this
        // controller is staff-only (see the class-level [Authorize] above),
        // so this is the one deliberate exception, scoped to the caller.
        [HttpGet("Me")]
        [Authorize(Roles = "Patient")]
        public async Task<ActionResult<PatientDto>> Me()
        {
            var userId = User.GetUserId();
            var patient = await _db.Patients.Where(p => p.UserId == userId && !p.IsDeleted)
                .Select(p => new PatientDto
                {
                    PatientId = p.PatientId,
                    FirstName = p.FirstName,
                    LastName = p.LastName,
                    Amka = p.Amka,
                    DateOfBirth = p.DateOfBirth,
                    Phone = p.Phone,
                    Email = p.Email
                })
                .FirstOrDefaultAsync();

            return patient is null ? NotFound() : Ok(patient);
        }

        [HttpGet("{id:guid}")]
        [Authorize(Roles = StaffRoles)]
        public async Task<ActionResult<PatientDto>> GetById(Guid id)
        {
            var patient = await _db.Patients.Where(p => p.PatientId == id && !p.IsDeleted)
                .Select(p => new PatientDto
                {
                    PatientId = p.PatientId,
                    FirstName = p.FirstName,
                    LastName = p.LastName,
                    Amka = p.Amka,
                    DateOfBirth = p.DateOfBirth,
                    Phone = p.Phone,
                    Email = p.Email
                })
                .FirstOrDefaultAsync();

            return patient is null ? NotFound() : Ok(patient);
        }

        [HttpPost]
        [Authorize(Roles = StaffRoles)]
        public async Task<ActionResult<PatientDto>> Create(PatientUpsertRequest request)
        {
            if (!string.IsNullOrWhiteSpace(request.Amka) &&
                await _db.Patients.AnyAsync(p => !p.IsDeleted && p.Amka == request.Amka))
            {
                return Conflict("Υπάρχει ήδη ασθενής με αυτό το ΑΜΚΑ.");
            }

            var patient = new Patient
            {
                FirstName = request.FirstName,
                LastName = request.LastName,
                Amka = request.Amka,
                DateOfBirth = request.DateOfBirth,
                Phone = request.Phone,
                Email = request.Email
            };

            _db.Patients.Add(patient);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException)
            {
                // Race between the pre-check above and the DB's own filtered
                // unique index (UQ_Patients_AMKA) — two concurrent creates
                // for the same AMKA.
                return Conflict("Υπάρχει ήδη ασθενής με αυτό το ΑΜΚΑ.");
            }

            await AuditLogger.LogAsync(_db, HttpContext, "Create", "Patient", patient.PatientId.ToString(), after: request);

            return CreatedAtAction(nameof(GetById), new { id = patient.PatientId }, new PatientDto
            {
                PatientId = patient.PatientId,
                FirstName = patient.FirstName,
                LastName = patient.LastName,
                Amka = patient.Amka,
                DateOfBirth = patient.DateOfBirth,
                Phone = patient.Phone,
                Email = patient.Email
            });
        }

        [HttpPut("{id:guid}")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Update(Guid id, PatientUpsertRequest request)
        {
            var patient = await _db.Patients.FirstOrDefaultAsync(p => p.PatientId == id && !p.IsDeleted);
            if (patient is null) return NotFound();

            if (!string.IsNullOrWhiteSpace(request.Amka) &&
                await _db.Patients.AnyAsync(p => !p.IsDeleted && p.PatientId != id && p.Amka == request.Amka))
            {
                return Conflict("Υπάρχει ήδη ασθενής με αυτό το ΑΜΚΑ.");
            }

            var before = new { patient.FirstName, patient.LastName, patient.Amka, patient.Phone, patient.Email };

            patient.FirstName = request.FirstName;
            patient.LastName = request.LastName;
            patient.Amka = request.Amka;
            patient.DateOfBirth = request.DateOfBirth;
            patient.Phone = request.Phone;
            patient.Email = request.Email;
            patient.UpdatedAt = DateTimeOffset.Now;

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException)
            {
                return Conflict("Υπάρχει ήδη ασθενής με αυτό το ΑΜΚΑ.");
            }

            await AuditLogger.LogAsync(_db, HttpContext, "Update", "Patient", id.ToString(), before, request);

            return NoContent();
        }

        // Deleting a patient record outright is more sensitive than
        // searching/creating one — Reception and Doctor keep read/write
        // access above but not this.
        [HttpDelete("{id:guid}")]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var patient = await _db.Patients.FirstOrDefaultAsync(p => p.PatientId == id && !p.IsDeleted);
            if (patient is null) return NotFound();

            patient.IsDeleted = true;
            patient.DeletedAt = DateTimeOffset.Now;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Delete", "Patient", id.ToString());

            return NoContent();
        }

        private bool IsPrivilegedStaff() =>
            User.IsInRole("Admin") || User.IsInRole("SuperUser") || User.IsInRole("ClinicManager") || User.IsInRole("Reception");

        private async Task<Guid?> GetOwnDoctorIdAsync()
        {
            var userId = User.GetUserId();
            return await _db.Doctors.Where(d => d.UserId == userId).Select(d => (Guid?)d.DoctorId).FirstOrDefaultAsync();
        }
    }
}
