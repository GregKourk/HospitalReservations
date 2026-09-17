using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // "Νέο Ραντεβού" self-service has no fallback when a doctor has no open
    // slot on the chosen date — a patient joins this instead. When an
    // appointment for that doctor/date is later Cancelled,
    // AppointmentsController.NotifyWaitlistAsync notifies every "Waiting"
    // entry — booking afterward is a normal Appointments/Create, not automatic.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize]
    public class WaitlistController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public WaitlistController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<WaitlistEntryDto>>> GetAll([FromQuery] Guid? clinicId, [FromQuery] Guid? doctorId, [FromQuery] string? status)
        {
            var query = _db.AppointmentWaitlistEntries.AsQueryable();

            if (!IsPrivilegedStaff() && User.IsInRole("Patient"))
            {
                var ownPatientId = await GetOwnPatientIdAsync();
                query = query.Where(w => w.PatientId == ownPatientId);
            }
            else if (!IsPrivilegedStaff() && User.IsInRole("Doctor"))
            {
                var ownDoctorId = await GetOwnDoctorIdAsync();
                query = query.Where(w => w.DoctorId == ownDoctorId);
            }
            else if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                query = query.Where(w => w.ClinicId == ownClinicId);
                if (doctorId.HasValue) query = query.Where(w => w.DoctorId == doctorId);
            }
            else if (IsPrivilegedStaff())
            {
                if (clinicId.HasValue) query = query.Where(w => w.ClinicId == clinicId);
                if (doctorId.HasValue) query = query.Where(w => w.DoctorId == doctorId);
            }
            else
            {
                return Forbid();
            }

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(w => w.Status == status);

            var results = await query
                .OrderBy(w => w.CreatedAt)
                .Select(w => new WaitlistEntryDto
                {
                    WaitlistId = w.WaitlistId,
                    PatientId = w.PatientId,
                    PatientName = w.Patient!.FirstName + " " + w.Patient.LastName,
                    ClinicId = w.ClinicId,
                    ClinicName = w.Clinic!.Name,
                    DepartmentId = w.DepartmentId,
                    DepartmentName = w.Department!.Name,
                    DoctorId = w.DoctorId,
                    DoctorName = w.Doctor!.User.FullName,
                    PreferredDate = w.PreferredDate,
                    Reason = w.Reason,
                    Status = w.Status,
                    CreatedAt = w.CreatedAt
                })
                .ToListAsync();

            return Ok(results);
        }

        [HttpPost]
        public async Task<ActionResult<Guid>> Create(WaitlistCreateRequest request)
        {
            if (!IsPrivilegedStaff())
            {
                if (!User.IsInRole("Patient")) return Forbid();
                var ownPatientId = await GetOwnPatientIdAsync();
                if (ownPatientId != request.PatientId) return Forbid();
            }
            else if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                if (request.ClinicId != ownClinicId) return Forbid();
            }

            var alreadyWaiting = await _db.AppointmentWaitlistEntries.AnyAsync(w =>
                w.PatientId == request.PatientId && w.DoctorId == request.DoctorId &&
                w.PreferredDate == request.PreferredDate && w.Status == "Waiting");
            if (alreadyWaiting)
                return Conflict("Είσαι ήδη σε λίστα αναμονής για αυτόν τον γιατρό σε αυτή την ημερομηνία.");

            var entry = new AppointmentWaitlistEntry
            {
                PatientId = request.PatientId,
                ClinicId = request.ClinicId,
                DepartmentId = request.DepartmentId,
                DoctorId = request.DoctorId,
                PreferredDate = request.PreferredDate,
                Reason = request.Reason
            };
            _db.AppointmentWaitlistEntries.Add(entry);
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Create", "WaitlistEntry", entry.WaitlistId.ToString(), after: request);

            return Ok(entry.WaitlistId);
        }

        [HttpPut("{id:guid}/Cancel")]
        public async Task<IActionResult> Cancel(Guid id)
        {
            var entry = await _db.AppointmentWaitlistEntries.FirstOrDefaultAsync(w => w.WaitlistId == id);
            if (entry is null) return NotFound();

            if (!IsPrivilegedStaff())
            {
                if (!User.IsInRole("Patient")) return Forbid();
                var ownPatientId = await GetOwnPatientIdAsync();
                if (entry.PatientId != ownPatientId) return Forbid();
            }
            else if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                if (entry.ClinicId != ownClinicId) return Forbid();
            }

            if (entry.Status == "Booked" || entry.Status == "Cancelled")
                return BadRequest("Η εγγραφή δεν μπορεί να ακυρωθεί.");

            entry.Status = "Cancelled";
            entry.UpdatedAt = DateTimeOffset.Now;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Cancel", "WaitlistEntry", id.ToString());

            return NoContent();
        }

        private bool IsPrivilegedStaff() =>
            User.IsInRole("Admin") || User.IsInRole("SuperUser") || User.IsInRole("ClinicManager") || User.IsInRole("Reception");

        private bool IsHigherPrivileged() => User.IsInRole("Admin") || User.IsInRole("SuperUser");

        private async Task<Guid?> GetOwnPatientIdAsync()
        {
            var userId = User.GetUserId();
            return await _db.Patients.Where(p => p.UserId == userId).Select(p => (Guid?)p.PatientId).FirstOrDefaultAsync();
        }

        private async Task<Guid?> GetOwnDoctorIdAsync()
        {
            var userId = User.GetUserId();
            return await _db.Doctors.Where(d => d.UserId == userId).Select(d => (Guid?)d.DoctorId).FirstOrDefaultAsync();
        }
    }
}
