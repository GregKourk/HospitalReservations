using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

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
                var ownClinicIds = await ClinicScopeHelper.GetManagedClinicIdsAsync(_db, User.GetUserId());
                query = query.Where(d => d.DoctorClinics.Any(dc => ownClinicIds.Contains(dc.ClinicId)));
            }
            // "Works at this branch" — main branch or any other (026_doctor_clinics.sql).
            if (clinicId.HasValue)
                query = query.Where(d => d.DoctorClinics.Any(dc => dc.ClinicId == clinicId));
            if (departmentId.HasValue) query = query.Where(d => d.DepartmentId == departmentId);

            var doctors = await query
                .Select(ToDto)
                .OrderBy(d => d.FullName)
                .ToListAsync();

            return Ok(doctors);
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<DoctorDto>> GetById(Guid id)
        {
            var doctor = await _db.Doctors.Where(d => d.DoctorId == id && !d.IsDeleted)
                .Select(ToDto)
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
                .Select(ToDto)
                .FirstOrDefaultAsync();

            return doctor is null ? NotFound() : Ok(doctor);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
        public async Task<ActionResult<Guid>> Create(DoctorCreateRequest request)
        {
            var clinicIds = NormalizeClinicIds(request.ClinicId, request.ClinicIds);
            foreach (var cid in clinicIds)
                if (await GetClinicScopeErrorAsync(cid) is { } scopeError) return scopeError;
            if (await _db.Clinics.CountAsync(c => clinicIds.Contains(c.ClinicId) && !c.IsDeleted) != clinicIds.Count)
                return BadRequest("Κάποιο από τα υποκαταστήματα δεν βρέθηκε.");

            var specialty = await GetActiveSpecialtyNameAsync(request.DepartmentId);
            if (specialty is null) return BadRequest("Η ειδικότητα δεν βρέθηκε.");

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
                Specialty = specialty,
                LicenseNumber = request.LicenseNumber
            };
            foreach (var cid in clinicIds)
                doctor.DoctorClinics.Add(new DoctorClinic { DoctorId = doctor.DoctorId, ClinicId = cid });
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

            await AuditLogger.LogAsync(_db, HttpContext, "Create", "Doctor", doctor.DoctorId.ToString(), after: new { request.Email, request.ClinicId, ClinicIds = clinicIds, request.DepartmentId, request.LicenseNumber });

            return CreatedAtAction(nameof(GetById), new { id = doctor.DoctorId }, doctor.DoctorId);
        }

        [HttpPut("{id:guid}")]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
        public async Task<IActionResult> Update(Guid id, DoctorUpdateRequest request)
        {
            var doctor = await _db.Doctors.Include(d => d.DoctorClinics).FirstOrDefaultAsync(d => d.DoctorId == id && !d.IsDeleted);
            if (doctor is null) return NotFound();

            var currentIds = doctor.DoctorClinics.Select(dc => dc.ClinicId).ToHashSet();
            var requestedIds = NormalizeClinicIds(request.ClinicId, request.ClinicIds);

            // A ClinicManager may edit a doctor who works at any of their
            // branches, but only add/remove their own branches (memberships at
            // other managers' branches are kept as they are), and may only move
            // the main branch between branches they manage.
            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var own = await ClinicScopeHelper.GetManagedClinicIdsAsync(_db, User.GetUserId());
                if (!currentIds.Any(own.Contains)) return Forbid();
                if (request.ClinicId != doctor.ClinicId && (!own.Contains(doctor.ClinicId) || !own.Contains(request.ClinicId)))
                    return Forbid();
                requestedIds = requestedIds.Where(own.Contains)
                    .Concat(currentIds.Where(cid => !own.Contains(cid)))
                    .Append(request.ClinicId)
                    .Distinct().ToList();
            }

            if (await _db.Clinics.CountAsync(c => requestedIds.Contains(c.ClinicId) && !c.IsDeleted) != requestedIds.Count)
                return BadRequest("Κάποιο από τα υποκαταστήματα δεν βρέθηκε.");

            var removedIds = currentIds.Where(cid => !requestedIds.Contains(cid)).ToList();
            if (removedIds.Count > 0 && await _db.DoctorSchedules.AnyAsync(s => s.DoctorId == id && s.IsActive && removedIds.Contains(s.ClinicId)))
                return Conflict("Ο γιατρός έχει ενεργό πρόγραμμα σε υποκατάστημα που αφαιρείται. Απενεργοποίησε πρώτα το πρόγραμμα εκεί.");

            var specialty = await GetActiveSpecialtyNameAsync(request.DepartmentId);
            if (specialty is null) return BadRequest("Η ειδικότητα δεν βρέθηκε.");

            if (!string.IsNullOrWhiteSpace(request.Amka) &&
                await _db.Doctors.AnyAsync(d => !d.IsDeleted && d.DoctorId != id && d.Amka == request.Amka))
            {
                return Conflict("Υπάρχει ήδη γιατρός με αυτό το ΑΜΚΑ.");
            }

            var before = new { doctor.ClinicId, ClinicIds = currentIds.ToList(), doctor.DepartmentId, doctor.Amka, doctor.Specialty, doctor.LicenseNumber };

            doctor.ClinicId = request.ClinicId;
            doctor.DepartmentId = request.DepartmentId;
            doctor.Amka = request.Amka;
            doctor.Specialty = specialty;
            doctor.LicenseNumber = request.LicenseNumber;
            doctor.UpdatedAt = DateTimeOffset.Now;

            foreach (var dc in doctor.DoctorClinics.Where(dc => removedIds.Contains(dc.ClinicId)).ToList())
                doctor.DoctorClinics.Remove(dc);
            foreach (var cid in requestedIds.Where(cid => !currentIds.Contains(cid)))
                doctor.DoctorClinics.Add(new DoctorClinic { DoctorId = doctor.DoctorId, ClinicId = cid });

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
            var doctor = await _db.Doctors.Include(d => d.DoctorClinics).FirstOrDefaultAsync(d => d.DoctorId == id && !d.IsDeleted);
            if (doctor is null) return NotFound();

            // Deleting removes the doctor from every branch, so a ClinicManager
            // may only do it when all of the doctor's branches are theirs.
            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var own = await ClinicScopeHelper.GetManagedClinicIdsAsync(_db, User.GetUserId());
                if (!doctor.DoctorClinics.Any(dc => own.Contains(dc.ClinicId))) return Forbid();
                if (!doctor.DoctorClinics.All(dc => own.Contains(dc.ClinicId)))
                    return Conflict("Ο γιατρός δουλεύει και σε υποκατάστημα που δεν διαχειρίζεσαι. Αφαίρεσε μόνο το δικό σου υποκατάστημα από τα στοιχεία του.");
            }

            doctor.IsDeleted = true;
            doctor.IsActive = false;
            doctor.DeletedAt = DateTimeOffset.Now;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Delete", "Doctor", id.ToString());

            return NoContent();
        }

        // Free slots for one calendar day: the doctor's recurring weekly template
        // (DoctorSchedules) minus whatever is already booked that day. Callers
        // build the booking screen's slot picker directly from this. With
        // clinicId, only that branch's schedules count (a doctor may work at
        // several); existing bookings at any branch still block a slot.
        [HttpGet("{id:guid}/Availability")]
        public async Task<ActionResult<List<DoctorAvailabilitySlotDto>>> GetAvailability(Guid id, [FromQuery] DateOnly date, [FromQuery] Guid? clinicId)
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
                    && (!clinicId.HasValue || s.ClinicId == clinicId)
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

        // Doctors.Specialty is no longer typed in — it mirrors the name of the
        // doctor's specialty from the shared list (025_shared_specialties.sql).
        private Task<string?> GetActiveSpecialtyNameAsync(Guid departmentId) =>
            _db.Departments.Where(d => d.DepartmentId == departmentId && d.IsActive).Select(d => (string?)d.Name).FirstOrDefaultAsync();

        private async Task<ActionResult?> GetClinicScopeErrorAsync(Guid clinicId)
        {
            if (!User.IsInRole("ClinicManager") || IsHigherPrivileged()) return null;
            var ownClinicIds = await ClinicScopeHelper.GetManagedClinicIdsAsync(_db, User.GetUserId());
            return ownClinicIds.Contains(clinicId) ? null : Forbid();
        }

        // Every branch the doctor works at, always including the main one.
        private static List<Guid> NormalizeClinicIds(Guid mainClinicId, List<Guid>? clinicIds) =>
            (clinicIds ?? new List<Guid>()).Append(mainClinicId).Where(cid => cid != Guid.Empty).Distinct().ToList();

        private static readonly Expression<Func<Doctor, DoctorDto>> ToDto = d => new DoctorDto
        {
            DoctorId = d.DoctorId,
            ClinicId = d.ClinicId,
            ClinicName = d.Clinic.Name,
            Clinics = d.DoctorClinics
                .OrderBy(dc => dc.ClinicId != d.ClinicId).ThenBy(dc => dc.Clinic!.Name)
                .Select(dc => new LookupItemDto { Id = dc.ClinicId, Text = dc.Clinic!.Name })
                .ToList(),
            DepartmentId = d.DepartmentId,
            DepartmentName = d.Department.Name,
            FullName = d.User.FullName,
            Email = d.User.Email,
            Amka = d.Amka,
            Specialty = d.Specialty,
            LicenseNumber = d.LicenseNumber,
            IsActive = d.IsActive
        };
    }
}
