using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // Read-only aggregate reports over Appointments — no writes, no new
    // state of its own. Default window is the last 30 days when no
    // from/to is given, matching AuditController's convention. A
    // ClinicManager gets the same reports but forced to their own clinic —
    // "Πληρότητα Γιατρών", "Ακυρώσεις/No-shows" per the outline.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
    public class ReportsController : ControllerBase
    {
        private const byte CompletedStatusId = 4;
        private const byte CancelledStatusId = 5;
        private const byte NoShowStatusId = 6;

        private readonly HospitalReservationsContext _db;

        public ReportsController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet("ClinicStats")]
        public async Task<ActionResult<List<ClinicStatDto>>> ClinicStats([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to)
        {
            var (start, end) = ResolveWindow(from, to);

            var query = _db.Appointments.Where(a => !a.IsDeleted && a.ScheduledStart >= start && a.ScheduledStart < end);
            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                query = query.Where(a => a.ClinicId == ownClinicId);
            }

            var stats = await query
                .GroupBy(a => new { a.ClinicId, a.Clinic.Name })
                .Select(g => new ClinicStatDto
                {
                    ClinicId = g.Key.ClinicId,
                    ClinicName = g.Key.Name,
                    Total = g.Count(),
                    Completed = g.Count(a => a.AppointmentStatusId == CompletedStatusId),
                    Cancelled = g.Count(a => a.AppointmentStatusId == CancelledStatusId),
                    NoShow = g.Count(a => a.AppointmentStatusId == NoShowStatusId),
                })
                .OrderByDescending(s => s.Total)
                .ToListAsync();

            foreach (var s in stats)
                s.CompletionRate = s.Total == 0 ? 0 : Math.Round(100.0 * s.Completed / s.Total, 1);

            return Ok(stats);
        }

        [HttpGet("DoctorStats")]
        public async Task<ActionResult<List<DoctorStatDto>>> DoctorStats([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to)
        {
            var (start, end) = ResolveWindow(from, to);

            var query = _db.Appointments.Where(a => !a.IsDeleted && a.ScheduledStart >= start && a.ScheduledStart < end);
            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                query = query.Where(a => a.ClinicId == ownClinicId);
            }

            var stats = await query
                .GroupBy(a => new { a.DoctorId, a.Doctor.User.FullName, ClinicName = a.Clinic.Name })
                .Select(g => new DoctorStatDto
                {
                    DoctorId = g.Key.DoctorId,
                    DoctorName = g.Key.FullName,
                    ClinicName = g.Key.ClinicName,
                    Total = g.Count(),
                    Completed = g.Count(a => a.AppointmentStatusId == CompletedStatusId),
                    Cancelled = g.Count(a => a.AppointmentStatusId == CancelledStatusId),
                    NoShow = g.Count(a => a.AppointmentStatusId == NoShowStatusId),
                })
                .OrderByDescending(s => s.Total)
                .ToListAsync();

            foreach (var s in stats)
                s.CompletionRate = s.Total == 0 ? 0 : Math.Round(100.0 * s.Completed / s.Total, 1);

            return Ok(stats);
        }

        [HttpGet("CancellationsNoShows")]
        public async Task<ActionResult<List<CancellationNoShowDto>>> CancellationsNoShows([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to)
        {
            var (start, end) = ResolveWindow(from, to);

            var query = _db.Appointments.Where(a => !a.IsDeleted && a.ScheduledStart >= start && a.ScheduledStart < end
                && (a.AppointmentStatusId == CancelledStatusId || a.AppointmentStatusId == NoShowStatusId));
            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                query = query.Where(a => a.ClinicId == ownClinicId);
            }

            var results = await query
                .OrderByDescending(a => a.ScheduledStart)
                .Select(a => new CancellationNoShowDto
                {
                    AppointmentId = a.AppointmentId,
                    ScheduledStart = a.ScheduledStart,
                    ClinicName = a.Clinic.Name,
                    DoctorName = a.Doctor.User.FullName,
                    PatientName = a.Patient.FirstName + " " + a.Patient.LastName,
                    StatusCode = a.AppointmentStatus.Code,
                    Reason = a.Reason
                })
                .ToListAsync();

            return Ok(results);
        }

        private static (DateTimeOffset start, DateTimeOffset end) ResolveWindow(DateTimeOffset? from, DateTimeOffset? to)
        {
            var end = to ?? DateTimeOffset.Now;
            var start = from ?? end.AddDays(-30);
            return (start, end);
        }

        private bool IsHigherPrivileged() => User.IsInRole("Admin") || User.IsInRole("SuperUser");
    }
}
