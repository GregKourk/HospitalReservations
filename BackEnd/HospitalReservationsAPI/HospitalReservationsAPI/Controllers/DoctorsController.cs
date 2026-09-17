using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize]
    public class DoctorsController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public DoctorsController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<DoctorDto>>> GetAll([FromQuery] Guid? clinicId, [FromQuery] Guid? departmentId)
        {
            var query = _db.Doctors.Where(d => !d.IsDeleted && d.IsActive);

            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                query = query.Where(d => d.ClinicId == ownClinicId);
            }
            else if (clinicId.HasValue)
            {
                query = query.Where(d => d.ClinicId == clinicId);
            }
            if (departmentId.HasValue) query = query.Where(d => d.DepartmentId == departmentId);

            var doctors = await query
                .Select(d => new DoctorDto
                {
                    DoctorId = d.DoctorId,
                    ClinicId = d.ClinicId,
                    ClinicName = d.Clinic.Name,
                    DepartmentId = d.DepartmentId,
                    DepartmentName = d.Department.Name,
                    FullName = d.User.FullName,
                    Email = d.User.Email,
                    Amka = d.Amka,
                    Specialty = d.Specialty,
                    LicenseNumber = d.LicenseNumber,
                    IsActive = d.IsActive
                })
                .OrderBy(d => d.FullName)
                .ToListAsync();

            return Ok(doctors);
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<DoctorDto>> GetById(Guid id)
        {
            var doctor = await _db.Doctors.Where(d => d.DoctorId == id && !d.IsDeleted)
                .Select(d => new DoctorDto
                {
                    DoctorId = d.DoctorId,
                    ClinicId = d.ClinicId,
                    ClinicName = d.Clinic.Name,
                    DepartmentId = d.DepartmentId,
                    DepartmentName = d.Department.Name,
                    FullName = d.User.FullName,
                    Email = d.User.Email,
                    Amka = d.Amka,
                    Specialty = d.Specialty,
                    LicenseNumber = d.LicenseNumber,
                    IsActive = d.IsActive
                })
                .FirstOrDefaultAsync();

            return doctor is null ? NotFound() : Ok(doctor);
        }

        // Self-service lookup so a Doctor can manage their own schedule
        // without needing a clinic/department picker they don't need.
        [HttpGet("Me")]
        [Authorize(Roles = "Doctor")]
        public async Task<ActionResult<DoctorDto>> Me()
        {
            var userId = User.GetUserId();
            var doctor = await _db.Doctors.Where(d => d.UserId == userId && !d.IsDeleted)
                .Select(d => new DoctorDto
                {
                    DoctorId = d.DoctorId,
                    ClinicId = d.ClinicId,
                    ClinicName = d.Clinic.Name,
                    DepartmentId = d.DepartmentId,
                    DepartmentName = d.Department.Name,
                    FullName = d.User.FullName,
                    Email = d.User.Email,
                    Amka = d.Amka,
                    Specialty = d.Specialty,
                    LicenseNumber = d.LicenseNumber,
                    IsActive = d.IsActive
                })
                .FirstOrDefaultAsync();

            return doctor is null ? NotFound() : Ok(doctor);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
        public async Task<ActionResult<Guid>> Create(DoctorCreateRequest request)
        {
            if (await GetClinicScopeErrorAsync(request.ClinicId) is { } scopeError) return scopeError;

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user is null)
            {
                user = new User { Email = request.Email, FullName = request.FullName };
                _db.Users.Add(user);
                await _db.SaveChangesAsync();
            }
            else if (await _db.Doctors.AnyAsync(d => d.UserId == user.UserId && !d.IsDeleted))
            {
                return Conflict("Υπάρχει ήδη γιατρός συνδεδεμένος με αυτό το email.");
            }

            if (!string.IsNullOrWhiteSpace(request.Amka) &&
                await _db.Doctors.AnyAsync(d => !d.IsDeleted && d.Amka == request.Amka))
            {
                return Conflict("Υπάρχει ήδη γιατρός με αυτό το ΑΜΚΑ.");
            }

            var doctorRoleId = await _db.Roles.Where(r => r.Name == "Doctor").Select(r => r.RoleId).FirstAsync();
            if (!await _db.UserRoles.AnyAsync(ur => ur.UserId == user.UserId && ur.RoleId == doctorRoleId))
                _db.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = doctorRoleId });

            var doctor = new Doctor
            {
                UserId = user.UserId,
                ClinicId = request.ClinicId,
                DepartmentId = request.DepartmentId,
                Amka = request.Amka,
                Specialty = request.Specialty,
                LicenseNumber = request.LicenseNumber
            };
            _db.Doctors.Add(doctor);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException)
            {
                // Could be LicenseNumber or AMKA — the pre-checks above cover
                // the common case, this is the race-condition fallback.
                return Conflict("Ο αριθμός άδειας ή το ΑΜΚΑ χρησιμοποιείται ήδη από άλλον γιατρό.");
            }

            await AuditLogger.LogAsync(_db, HttpContext, "Create", "Doctor", doctor.DoctorId.ToString(), after: new { request.Email, request.ClinicId, request.DepartmentId, request.LicenseNumber });

            return CreatedAtAction(nameof(GetById), new { id = doctor.DoctorId }, doctor.DoctorId);
        }

        [HttpPut("{id:guid}")]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
        public async Task<IActionResult> Update(Guid id, DoctorUpdateRequest request)
        {
            var doctor = await _db.Doctors.FirstOrDefaultAsync(d => d.DoctorId == id && !d.IsDeleted);
            if (doctor is null) return NotFound();

            if (await GetClinicScopeErrorAsync(doctor.ClinicId) is { } scopeError1) return scopeError1;
            if (await GetClinicScopeErrorAsync(request.ClinicId) is { } scopeError2) return scopeError2;

            if (!string.IsNullOrWhiteSpace(request.Amka) &&
                await _db.Doctors.AnyAsync(d => !d.IsDeleted && d.DoctorId != id && d.Amka == request.Amka))
            {
                return Conflict("Υπάρχει ήδη γιατρός με αυτό το ΑΜΚΑ.");
            }

            var before = new { doctor.ClinicId, doctor.DepartmentId, doctor.Amka, doctor.Specialty, doctor.LicenseNumber };

            doctor.ClinicId = request.ClinicId;
            doctor.DepartmentId = request.DepartmentId;
            doctor.Amka = request.Amka;
            doctor.Specialty = request.Specialty;
            doctor.LicenseNumber = request.LicenseNumber;
            doctor.UpdatedAt = DateTimeOffset.Now;

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException)
            {
                return Conflict("Ο αριθμός άδειας ή το ΑΜΚΑ χρησιμοποιείται ήδη από άλλον γιατρό.");
            }

            await AuditLogger.LogAsync(_db, HttpContext, "Update", "Doctor", id.ToString(), before, request);

            return NoContent();
        }

        [HttpDelete("{id:guid}")]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var doctor = await _db.Doctors.FirstOrDefaultAsync(d => d.DoctorId == id && !d.IsDeleted);
            if (doctor is null) return NotFound();

            if (await GetClinicScopeErrorAsync(doctor.ClinicId) is { } scopeError) return scopeError;

            doctor.IsDeleted = true;
            doctor.IsActive = false;
            doctor.DeletedAt = DateTimeOffset.Now;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Delete", "Doctor", id.ToString());

            return NoContent();
        }

        // Free slots for one calendar day: the doctor's recurring weekly template
        // (DoctorSchedules) minus whatever is already booked that day. Callers
        // build the booking screen's slot picker directly from this.
        [HttpGet("{id:guid}/Availability")]
        public async Task<ActionResult<List<DoctorAvailabilitySlotDto>>> GetAvailability(Guid id, [FromQuery] DateOnly date)
        {
            // A holiday blocks every doctor that day regardless of their own
            // weekly schedule — checked before touching DoctorSchedules at all.
            if (await HolidayHelper.FindMatchAsync(_db, date) is not null)
                return Ok(new List<DoctorAvailabilitySlotDto>());

            if (await LeaveHelper.IsDoctorOnLeaveAsync(_db, id, date))
                return Ok(new List<DoctorAvailabilitySlotDto>());

            var dayOfWeek = (byte)date.DayOfWeek;
            var dayAsDate = date.ToDateTime(TimeOnly.MinValue);

            var schedules = await _db.DoctorSchedules
                .Where(s => s.DoctorId == id
                    && s.IsActive
                    && s.DayOfWeek == dayOfWeek
                    && s.EffectiveFrom <= dayAsDate
                    && (s.EffectiveTo == null || s.EffectiveTo >= dayAsDate))
                .ToListAsync();

            if (schedules.Count == 0)
                return Ok(new List<DoctorAvailabilitySlotDto>());

            var dayStart = new DateTimeOffset(dayAsDate, DateTimeOffset.Now.Offset);
            var dayEnd = dayStart.AddDays(1);

            var booked = await _db.Appointments
                .Where(a => a.DoctorId == id
                    && !a.IsDeleted
                    && a.AppointmentStatusId != 5 // Cancelled
                    && a.AppointmentStatusId != 6 // NoShow
                    && a.ScheduledStart < dayEnd
                    && a.ScheduledEnd > dayStart)
                .Select(a => new { a.ScheduledStart, a.ScheduledEnd })
                .ToListAsync();

            var slots = new List<DoctorAvailabilitySlotDto>();
            foreach (var schedule in schedules)
            {
                var slotStart = dayStart + schedule.StartTime;
                var windowEnd = dayStart + schedule.EndTime;
                var slotLength = TimeSpan.FromMinutes(schedule.SlotMinutes);

                while (slotStart + slotLength <= windowEnd)
                {
                    var slotEnd = slotStart + slotLength;
                    var overlaps = booked.Any(b => b.ScheduledStart < slotEnd && b.ScheduledEnd > slotStart);
                    if (!overlaps)
                        slots.Add(new DoctorAvailabilitySlotDto { Start = slotStart, End = slotEnd });

                    slotStart = slotEnd;
                }
            }

            return Ok(slots.OrderBy(s => s.Start).ToList());
        }

        private bool IsHigherPrivileged() => User.IsInRole("Admin") || User.IsInRole("SuperUser");

        private async Task<ActionResult?> GetClinicScopeErrorAsync(Guid clinicId)
        {
            if (!User.IsInRole("ClinicManager") || IsHigherPrivileged()) return null;
            var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
            return clinicId == ownClinicId ? null : Forbid();
        }
    }
}
