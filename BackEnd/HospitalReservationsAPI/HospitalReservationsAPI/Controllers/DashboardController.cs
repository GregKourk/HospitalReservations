using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // System-wide KPIs for the Admin/SuperUser landing page, and the same
    // shape scoped to "their own clinic" for a ClinicManager ("KPIs
    // κλινικής"). Everything here is a read-only aggregate over data other
    // controllers already own — this controller has no writes of its own.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
    public class DashboardController : ControllerBase
    {
        private const byte CancelledStatusId = 5;
        private const byte NoShowStatusId = 6;

        private readonly HospitalReservationsContext _db;

        public DashboardController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet("Summary")]
        public async Task<ActionResult<DashboardSummaryDto>> Summary()
        {
            var now = DateTimeOffset.Now;
            var todayStart = new DateTimeOffset(now.Date, now.Offset);
            var todayEnd = todayStart.AddDays(1);
            var weekEnd = todayStart.AddDays(7);
            var thirtyDaysAgo = todayStart.AddDays(-30);

            List<Guid>? clinicScope = null;
            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
                clinicScope = await ClinicScopeHelper.GetManagedClinicIdsAsync(_db, User.GetUserId());

            var appointmentsQuery = _db.Appointments.Where(a => !a.IsDeleted);
            if (clinicScope is not null) appointmentsQuery = appointmentsQuery.Where(a => clinicScope.Contains(a.ClinicId));

            var summary = new DashboardSummaryDto
            {
                TotalClinics = clinicScope is not null ? clinicScope.Count : await _db.Clinics.CountAsync(c => c.IsActive && !c.IsDeleted),
                // For a branch: the specialties it offers (has active doctors in).
                TotalDepartments = await _db.Departments.CountAsync(d => d.IsActive &&
                    (clinicScope == null || d.Doctors.Any(doc => doc.IsActive && !doc.IsDeleted && doc.DoctorClinics.Any(dc => clinicScope.Contains(dc.ClinicId))))),
                TotalDoctors = await _db.Doctors.CountAsync(d => d.IsActive && !d.IsDeleted && (clinicScope == null || d.DoctorClinics.Any(dc => clinicScope.Contains(dc.ClinicId)))),
                // Patients has no ClinicId of its own — for a ClinicManager we
                // approximate "their" patients as whoever has an appointment there.
                TotalPatients = clinicScope is not null
                    ? await appointmentsQuery.Select(a => a.PatientId).Distinct().CountAsync()
                    : await _db.Patients.CountAsync(p => !p.IsDeleted),
                // Users has no ClinicId either — the closest clinic-scoped
                // reading of "active users" is that clinic's active doctors.
                TotalActiveUsers = clinicScope is not null
                    ? await _db.Doctors.CountAsync(d => d.IsActive && !d.IsDeleted && d.DoctorClinics.Any(dc => clinicScope.Contains(dc.ClinicId)))
                    : await _db.Users.CountAsync(u => u.IsActive && !u.IsDeleted),
            };

            summary.AppointmentsToday = await appointmentsQuery
                .Where(a => a.ScheduledStart >= todayStart && a.ScheduledStart < todayEnd)
                .GroupBy(a => new { a.AppointmentStatus.Code, a.AppointmentStatus.Description })
                .Select(g => new StatusCountDto { StatusCode = g.Key.Code, Description = g.Key.Description, Count = g.Count() })
                .ToListAsync();

            summary.AppointmentsThisWeek = await appointmentsQuery
                .CountAsync(a => a.ScheduledStart >= todayStart && a.ScheduledStart < weekEnd);

            summary.CancellationsLast30Days = await appointmentsQuery
                .CountAsync(a => a.AppointmentStatusId == CancelledStatusId && a.ScheduledStart >= thirtyDaysAgo && a.ScheduledStart < todayEnd);

            summary.NoShowsLast30Days = await appointmentsQuery
                .CountAsync(a => a.AppointmentStatusId == NoShowStatusId && a.ScheduledStart >= thirtyDaysAgo && a.ScheduledStart < todayEnd);

            summary.RecentActivity = clinicScope is not null
                ? await GetClinicScopedActivityAsync(clinicScope)
                : await (
                    from log in _db.audit_AuditLogs
                    join user in _db.Users on log.UserId equals user.UserId into gj
                    from user in gj.DefaultIfEmpty()
                    orderby log.Timestamp descending
                    select new RecentActivityDto
                    {
                        Timestamp = log.Timestamp,
                        UserName = user != null ? user.FullName : null,
                        Role = log.Role,
                        ActionType = log.ActionType,
                        EntityType = log.EntityType,
                        EntityId = log.EntityId
                    }).Take(10).ToListAsync();

            return Ok(summary);
        }

        private bool IsHigherPrivileged() => User.IsInRole("Admin") || User.IsInRole("SuperUser");

        // AuditLogs has no ClinicId of its own, so "activity for my clinic"
        // means: entries whose EntityId names something that belongs to this
        // clinic (an appointment, doctor or schedule of it), or
        // the clinic record itself.
        private async Task<List<RecentActivityDto>> GetClinicScopedActivityAsync(List<Guid> clinicIds)
        {
            var appointmentIds = await _db.Appointments.Where(a => clinicIds.Contains(a.ClinicId)).Select(a => a.AppointmentId.ToString()).ToListAsync();
            var doctorIds = await _db.Doctors.Where(d => d.DoctorClinics.Any(dc => clinicIds.Contains(dc.ClinicId))).Select(d => d.DoctorId.ToString()).ToListAsync();
            var scheduleIds = await _db.DoctorSchedules.Where(s => clinicIds.Contains(s.ClinicId)).Select(s => s.ScheduleId.ToString()).ToListAsync();
            var clinicIdStrs = clinicIds.Select(id => id.ToString()).ToList();

            return await (
                from log in _db.audit_AuditLogs
                join user in _db.Users on log.UserId equals user.UserId into gj
                from user in gj.DefaultIfEmpty()
                where (log.EntityType == "Appointment" && appointmentIds.Contains(log.EntityId!))
                    || (log.EntityType == "Doctor" && doctorIds.Contains(log.EntityId!))
                    || (log.EntityType == "DoctorSchedule" && scheduleIds.Contains(log.EntityId!))
                    || (log.EntityType == "Clinic" && clinicIdStrs.Contains(log.EntityId!))
                orderby log.Timestamp descending
                select new RecentActivityDto
                {
                    Timestamp = log.Timestamp,
                    UserName = user != null ? user.FullName : null,
                    Role = log.Role,
                    ActionType = log.ActionType,
                    EntityType = log.EntityType,
                    EntityId = log.EntityId
                }).Take(10).ToListAsync();
        }
    }
}
