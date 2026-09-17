using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // Drives what Doctors/{id}/Availability actually offers Reception — a
    // doctor with no rows here has zero bookable slots, no matter how many
    // appointments/clinics exist. Staff (Admin/SuperUser/ClinicManager)
    // manage any doctor's schedule; a Doctor manages only their own.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize]
    public class DoctorSchedulesController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public DoctorSchedulesController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<DoctorScheduleDto>>> GetAll([FromQuery] Guid? doctorId, [FromQuery] Guid? clinicId)
        {
            var query = _db.DoctorSchedules.AsQueryable();

            if (IsFullyPrivileged())
            {
                if (doctorId.HasValue) query = query.Where(s => s.DoctorId == doctorId);
                if (clinicId.HasValue) query = query.Where(s => s.ClinicId == clinicId);
            }
            else if (User.IsInRole("ClinicManager"))
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                query = query.Where(s => s.ClinicId == ownClinicId);
                if (doctorId.HasValue) query = query.Where(s => s.DoctorId == doctorId);
            }
            else if (User.IsInRole("Doctor"))
            {
                var ownDoctorId = await GetOwnDoctorIdAsync();
                query = query.Where(s => s.DoctorId == ownDoctorId);
            }
            else
            {
                return Forbid();
            }

            var schedules = await query
                .OrderBy(s => s.DayOfWeek).ThenBy(s => s.StartTime)
                .Select(s => new DoctorScheduleDto
                {
                    ScheduleId = s.ScheduleId,
                    DoctorId = s.DoctorId,
                    DoctorName = s.Doctor.User.FullName,
                    ClinicId = s.ClinicId,
                    ClinicName = s.Clinic.Name,
                    DayOfWeek = s.DayOfWeek,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime,
                    SlotMinutes = s.SlotMinutes,
                    EffectiveFrom = s.EffectiveFrom,
                    EffectiveTo = s.EffectiveTo,
                    IsActive = s.IsActive
                })
                .ToListAsync();

            return Ok(schedules);
        }

        [HttpPost]
        public async Task<ActionResult<Guid>> Create(DoctorScheduleCreateRequest request)
        {
            if (request.EndTime <= request.StartTime)
                return BadRequest("Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.");

            var businessHoursError = await ValidateBusinessHoursAsync(request.StartTime, request.EndTime);
            if (businessHoursError is not null) return BadRequest(businessHoursError);

            if (!IsFullyPrivileged())
            {
                if (User.IsInRole("ClinicManager"))
                {
                    var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                    if (request.ClinicId != ownClinicId) return Forbid();
                }
                else if (User.IsInRole("Doctor"))
                {
                    var ownDoctorId = await GetOwnDoctorIdAsync();
                    if (request.DoctorId != ownDoctorId) return Forbid();
                }
                else
                {
                    return Forbid();
                }
            }

            var schedule = new DoctorSchedule
            {
                DoctorId = request.DoctorId,
                ClinicId = request.ClinicId,
                DayOfWeek = request.DayOfWeek,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                SlotMinutes = request.SlotMinutes,
                EffectiveFrom = request.EffectiveFrom,
                EffectiveTo = request.EffectiveTo
            };
            _db.DoctorSchedules.Add(schedule);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException)
            {
                // The only unique constraint here is (DoctorId, DayOfWeek, StartTime, EffectiveFrom).
                return Conflict("Υπάρχει ήδη πρόγραμμα για αυτόν τον γιατρό σε αυτή την ημέρα/ώρα/ημερομηνία έναρξης.");
            }

            await AuditLogger.LogAsync(_db, HttpContext, "Create", "DoctorSchedule", schedule.ScheduleId.ToString(), after: request);

            return Ok(schedule.ScheduleId);
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, DoctorScheduleUpdateRequest request)
        {
            if (request.EndTime <= request.StartTime)
                return BadRequest("Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.");

            var businessHoursError = await ValidateBusinessHoursAsync(request.StartTime, request.EndTime);
            if (businessHoursError is not null) return BadRequest(businessHoursError);

            var schedule = await _db.DoctorSchedules.FirstOrDefaultAsync(s => s.ScheduleId == id);
            if (schedule is null) return NotFound();

            if (await GetScheduleScopeErrorAsync(schedule) is { } scopeError) return scopeError;

            var before = new { schedule.DayOfWeek, schedule.StartTime, schedule.EndTime, schedule.SlotMinutes, schedule.EffectiveFrom, schedule.EffectiveTo, schedule.IsActive };

            schedule.DayOfWeek = request.DayOfWeek;
            schedule.StartTime = request.StartTime;
            schedule.EndTime = request.EndTime;
            schedule.SlotMinutes = request.SlotMinutes;
            schedule.EffectiveFrom = request.EffectiveFrom;
            schedule.EffectiveTo = request.EffectiveTo;
            schedule.IsActive = request.IsActive;

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException)
            {
                return Conflict("Υπάρχει ήδη πρόγραμμα για αυτόν τον γιατρό σε αυτή την ημέρα/ώρα/ημερομηνία έναρξης.");
            }

            await AuditLogger.LogAsync(_db, HttpContext, "Update", "DoctorSchedule", id.ToString(), before, request);

            return NoContent();
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var schedule = await _db.DoctorSchedules.FirstOrDefaultAsync(s => s.ScheduleId == id);
            if (schedule is null) return NotFound();

            if (await GetScheduleScopeErrorAsync(schedule) is { } scopeError) return scopeError;

            schedule.IsActive = false;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Delete", "DoctorSchedule", id.ToString());

            return NoContent();
        }

        private async Task<string?> ValidateBusinessHoursAsync(TimeSpan start, TimeSpan end)
        {
            var businessStart = await SystemSettingsHelper.GetTimeAsync(_db, "BusinessHoursStart");
            var businessEnd = await SystemSettingsHelper.GetTimeAsync(_db, "BusinessHoursEnd");

            if (businessStart.HasValue && start < businessStart)
                return $"Η ώρα έναρξης δεν μπορεί να είναι πριν τις {businessStart:hh\\:mm} (ωράριο λειτουργίας).";
            if (businessEnd.HasValue && end > businessEnd)
                return $"Η ώρα λήξης δεν μπορεί να είναι μετά τις {businessEnd:hh\\:mm} (ωράριο λειτουργίας).";

            return null;
        }

        private bool IsFullyPrivileged() => User.IsInRole("Admin") || User.IsInRole("SuperUser");

        private async Task<Guid?> GetOwnDoctorIdAsync()
        {
            var userId = User.GetUserId();
            return await _db.Doctors.Where(d => d.UserId == userId).Select(d => (Guid?)d.DoctorId).FirstOrDefaultAsync();
        }

        // A ClinicManager may only touch schedules within their own clinic;
        // a Doctor only their own. Admin/SuperUser bypass entirely.
        private async Task<IActionResult?> GetScheduleScopeErrorAsync(DoctorSchedule schedule)
        {
            if (IsFullyPrivileged()) return null;

            if (User.IsInRole("ClinicManager"))
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                return schedule.ClinicId == ownClinicId ? null : Forbid();
            }

            if (User.IsInRole("Doctor"))
            {
                var ownDoctorId = await GetOwnDoctorIdAsync();
                return schedule.DoctorId == ownDoctorId ? null : Forbid();
            }

            return Forbid();
        }
    }
}
