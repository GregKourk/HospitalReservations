using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using HospitalReservationsAPI.Model.SignalR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize]
    public class AppointmentsController : BaseApiController
    {
        private const byte ConfirmedStatusId = 2;
        private const byte CancelledStatusId = 5;
        private const byte NoShowStatusId = 6;
        private const byte RescheduledStatusId = 7;

        private readonly HospitalReservationsContext _db;
        private readonly IHubContext<SignalRHub> _hub;

        public AppointmentsController(HospitalReservationsContext db, IHubContext<SignalRHub> hub)
        {
            _db = db;
            _hub = hub;
        }

        [HttpGet]
        public async Task<ActionResult<List<AppointmentDto>>> GetAll(
            [FromQuery] Guid? clinicId,
            [FromQuery] Guid? doctorId,
            [FromQuery] Guid? patientId,
            [FromQuery] byte? statusId,
            [FromQuery] DateTimeOffset? from,
            [FromQuery] DateTimeOffset? to)
        {
            var query = _db.Appointments.Where(a => !a.IsDeleted);

            // Reception/admin/manager see whatever they filter for; a doctor is
            // pinned to their own calendar and a patient to their own history —
            // separated flows per .agent.master.md, not left to the client to ask nicely for.
            if (!IsPrivilegedStaff() && User.IsInRole("Doctor"))
            {
                var ownDoctorId = await GetOwnDoctorIdAsync();
                query = query.Where(a => a.DoctorId == ownDoctorId);
            }
            else if (!IsPrivilegedStaff() && User.IsInRole("Patient"))
            {
                var ownPatientId = await GetOwnPatientIdAsync();
                query = query.Where(a => a.PatientId == ownPatientId);
            }
            else if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                // "Ραντεβού (εποπτεία κλινικής)" — a ClinicManager only ever
                // supervises their own clinic, regardless of what clinicId they pass.
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                query = query.Where(a => a.ClinicId == ownClinicId);
                if (doctorId.HasValue) query = query.Where(a => a.DoctorId == doctorId);
                if (patientId.HasValue) query = query.Where(a => a.PatientId == patientId);
            }
            else
            {
                if (clinicId.HasValue) query = query.Where(a => a.ClinicId == clinicId);
                if (doctorId.HasValue) query = query.Where(a => a.DoctorId == doctorId);
                if (patientId.HasValue) query = query.Where(a => a.PatientId == patientId);
            }

            if (statusId.HasValue) query = query.Where(a => a.AppointmentStatusId == statusId);
            if (from.HasValue) query = query.Where(a => a.ScheduledEnd > from);
            if (to.HasValue) query = query.Where(a => a.ScheduledStart < to);

            var appointments = await query
                .OrderBy(a => a.ScheduledStart)
                .Select(a => new AppointmentDto
                {
                    AppointmentId = a.AppointmentId,
                    ClinicId = a.ClinicId,
                    DepartmentId = a.DepartmentId,
                    DoctorId = a.DoctorId,
                    DoctorName = a.Doctor.User.FullName,
                    PatientId = a.PatientId,
                    PatientName = a.Patient.FirstName + " " + a.Patient.LastName,
                    ScheduledStart = a.ScheduledStart,
                    ScheduledEnd = a.ScheduledEnd,
                    AppointmentStatusId = a.AppointmentStatusId,
                    StatusCode = a.AppointmentStatus.Code,
                    Reason = a.Reason
                })
                .ToListAsync();

            return Ok(appointments);
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<AppointmentDto>> GetById(Guid id)
        {
            var appointment = await _db.Appointments.Where(a => a.AppointmentId == id && !a.IsDeleted)
                .Select(a => new AppointmentDto
                {
                    AppointmentId = a.AppointmentId,
                    ClinicId = a.ClinicId,
                    DepartmentId = a.DepartmentId,
                    DoctorId = a.DoctorId,
                    DoctorName = a.Doctor.User.FullName,
                    PatientId = a.PatientId,
                    PatientName = a.Patient.FirstName + " " + a.Patient.LastName,
                    ScheduledStart = a.ScheduledStart,
                    ScheduledEnd = a.ScheduledEnd,
                    AppointmentStatusId = a.AppointmentStatusId,
                    StatusCode = a.AppointmentStatus.Code,
                    Reason = a.Reason
                })
                .FirstOrDefaultAsync();

            return appointment is null ? NotFound() : Ok(appointment);
        }

        [HttpPost]
        public async Task<ActionResult<Guid>> Create(AppointmentCreateRequest request)
        {
            if (request.ScheduledEnd <= request.ScheduledStart)
                return BadRequest("Appointment end must be after start.");

            var holiday = await HolidayHelper.FindMatchAsync(_db, DateOnly.FromDateTime(request.ScheduledStart.Date));
            if (holiday is not null)
                return BadRequest($"Δεν επιτρέπεται ραντεβού σε ημέρα αργίας: {holiday.Name}.");

            if (await LeaveHelper.IsDoctorOnLeaveAsync(_db, request.DoctorId, DateOnly.FromDateTime(request.ScheduledStart.Date)))
                return BadRequest("Ο γιατρός είναι σε άδεια αυτή την ημερομηνία.");

            var callerId = User.GetUserId();
            if (callerId is null) return Unauthorized();

            if (!IsPrivilegedStaff() && User.IsInRole("Patient"))
            {
                var ownPatientId = await GetOwnPatientIdAsync();
                if (ownPatientId != request.PatientId)
                    return Forbid();
            }

            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                if (request.ClinicId != ownClinicId) return Forbid();
            }

            var appointment = new Appointment
            {
                ClinicId = request.ClinicId,
                DepartmentId = request.DepartmentId,
                DoctorId = request.DoctorId,
                PatientId = request.PatientId,
                ScheduledStart = request.ScheduledStart,
                ScheduledEnd = request.ScheduledEnd,
                Reason = request.Reason,
                CreatedByUserId = callerId.Value
            };

            _db.Appointments.Add(appointment);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException)
            {
                // The only two things that can fail an Appointments write at the DB level are
                // the time-range CHECK constraint (already validated above) and
                // trg_Appointments_NoOverlap — so any SqlException here is a booking conflict.
                return Conflict("Ο γιατρός έχει ήδη ραντεβού σε αυτό το χρονικό διάστημα.");
            }

            await AuditLogger.LogAsync(_db, HttpContext, "Create", "Appointment", appointment.AppointmentId.ToString(), after: request);
            await NotifyAsync(appointment, "AppointmentCreated");
            await SendAppointmentNotificationAsync(appointment, "AppointmentCreated", notifyPatient: true, notifyDoctor: true);
            await ResolveWaitlistOnBookingAsync(appointment);

            return CreatedAtAction(nameof(GetById), new { id = appointment.AppointmentId }, appointment.AppointmentId);
        }

        [HttpPut("{id:guid}/Status")]
        public async Task<IActionResult> ChangeStatus(Guid id, AppointmentStatusChangeRequest request)
        {
            var appointment = await _db.Appointments.FirstOrDefaultAsync(a => a.AppointmentId == id && !a.IsDeleted);
            if (appointment is null) return NotFound();

            if (!IsPrivilegedStaff())
            {
                if (User.IsInRole("Doctor"))
                {
                    var ownDoctorId = await GetOwnDoctorIdAsync();
                    if (appointment.DoctorId != ownDoctorId) return Forbid();
                }
                else if (User.IsInRole("Patient"))
                {
                    // A patient may only cancel their own appointment — every other
                    // transition (confirm, check-in, complete, no-show) is staff-only.
                    if (request.AppointmentStatusId != CancelledStatusId) return Forbid();
                    var ownPatientId = await GetOwnPatientIdAsync();
                    if (appointment.PatientId != ownPatientId) return Forbid();
                }
                else
                {
                    return Forbid();
                }
            }

            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                if (appointment.ClinicId != ownClinicId) return Forbid();
            }

            if (request.AppointmentStatusId == CancelledStatusId && !User.IsInRole("Admin") && !User.IsInRole("SuperUser"))
            {
                var policyError = await ValidateGracePeriodAsync(appointment.ScheduledStart, "CancellationMinHours", "ακύρωση");
                if (policyError is not null) return BadRequest(policyError);
            }

            var before = new { appointment.AppointmentStatusId };

            appointment.AppointmentStatusId = request.AppointmentStatusId;
            if (!string.IsNullOrWhiteSpace(request.Reason))
                appointment.Reason = request.Reason;
            appointment.UpdatedAt = DateTimeOffset.Now;

            await _db.SaveChangesAsync(); // trg_Appointments_StatusHistory records the transition

            await AuditLogger.LogAsync(_db, HttpContext, "StatusChange", "Appointment", id.ToString(), before, request);
            await NotifyAsync(appointment, "AppointmentStatusChanged");

            if (request.AppointmentStatusId == ConfirmedStatusId)
                await SendAppointmentNotificationAsync(appointment, "AppointmentConfirmed", notifyPatient: true, notifyDoctor: false);
            else if (request.AppointmentStatusId == CancelledStatusId)
            {
                await SendAppointmentNotificationAsync(appointment, "AppointmentCancelled", notifyPatient: true, notifyDoctor: true, reason: request.Reason);
                await NotifyWaitlistAsync(appointment);
            }
            else if (request.AppointmentStatusId == NoShowStatusId)
                await SendAppointmentNotificationAsync(appointment, "AppointmentNoShow", notifyPatient: false, notifyDoctor: true);

            return NoContent();
        }

        [HttpPut("{id:guid}/Reschedule")]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager,Reception,Doctor")]
        public async Task<IActionResult> Reschedule(Guid id, AppointmentRescheduleRequest request)
        {
            if (request.ScheduledEnd <= request.ScheduledStart)
                return BadRequest("Appointment end must be after start.");

            var holiday = await HolidayHelper.FindMatchAsync(_db, DateOnly.FromDateTime(request.ScheduledStart.Date));
            if (holiday is not null)
                return BadRequest($"Δεν επιτρέπεται ραντεβού σε ημέρα αργίας: {holiday.Name}.");

            var appointment = await _db.Appointments.FirstOrDefaultAsync(a => a.AppointmentId == id && !a.IsDeleted);
            if (appointment is null) return NotFound();

            if (await LeaveHelper.IsDoctorOnLeaveAsync(_db, appointment.DoctorId, DateOnly.FromDateTime(request.ScheduledStart.Date)))
                return BadRequest("Ο γιατρός είναι σε άδεια αυτή την ημερομηνία.");

            if (!IsPrivilegedStaff() && User.IsInRole("Doctor"))
            {
                var ownDoctorId = await GetOwnDoctorIdAsync();
                if (appointment.DoctorId != ownDoctorId) return Forbid();
            }

            if (User.IsInRole("ClinicManager") && !IsHigherPrivileged())
            {
                var ownClinicId = await ClinicScopeHelper.GetOwnManagedClinicIdAsync(_db, User.GetUserId());
                if (appointment.ClinicId != ownClinicId) return Forbid();
            }

            if (!User.IsInRole("Admin") && !User.IsInRole("SuperUser"))
            {
                var policyError = await ValidateGracePeriodAsync(appointment.ScheduledStart, "RescheduleMinHours", "αλλαγή ώρας");
                if (policyError is not null) return BadRequest(policyError);
            }

            var before = new { appointment.ScheduledStart, appointment.ScheduledEnd };

            appointment.ScheduledStart = request.ScheduledStart;
            appointment.ScheduledEnd = request.ScheduledEnd;
            appointment.AppointmentStatusId = RescheduledStatusId;
            appointment.UpdatedAt = DateTimeOffset.Now;

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException)
            {
                return Conflict("Ο γιατρός έχει ήδη ραντεβού σε αυτό το χρονικό διάστημα.");
            }

            await AuditLogger.LogAsync(_db, HttpContext, "Reschedule", "Appointment", id.ToString(), before, request);
            await NotifyAsync(appointment, "AppointmentRescheduled");
            await SendAppointmentNotificationAsync(appointment, "AppointmentRescheduled", notifyPatient: true, notifyDoctor: true);

            return NoContent();
        }

        // Renders the named NotificationTemplate and delivers it to whichever
        // of patient/doctor have a login to receive it (walk-in patients
        // created by Reception often have no UserId — they simply can't be
        // notified in-app since they have no account).
        private async Task SendAppointmentNotificationAsync(Appointment appointment, string templateCode, bool notifyPatient, bool notifyDoctor, string? reason = null)
        {
            var info = await _db.Appointments.Where(a => a.AppointmentId == appointment.AppointmentId)
                .Select(a => new
                {
                    DoctorUserId = a.Doctor.UserId,
                    DoctorName = a.Doctor.User.FullName,
                    PatientUserId = a.Patient.UserId,
                    PatientName = a.Patient.FirstName + " " + a.Patient.LastName,
                })
                .FirstOrDefaultAsync();
            if (info is null) return;

            var placeholders = new Dictionary<string, string?>
            {
                ["PatientName"] = info.PatientName,
                ["DoctorName"] = info.DoctorName,
                ["AppointmentDateTime"] = appointment.ScheduledStart.ToString("dd/MM/yyyy HH:mm"),
                ["Reason"] = reason ?? appointment.Reason,
            };

            if (notifyPatient && info.PatientUserId.HasValue)
                await NotificationHelper.NotifyFromTemplateAsync(_db, _hub, templateCode, info.PatientUserId.Value, placeholders, "Appointment", appointment.AppointmentId.ToString());

            if (notifyDoctor)
                await NotificationHelper.NotifyFromTemplateAsync(_db, _hub, templateCode, info.DoctorUserId, placeholders, "Appointment", appointment.AppointmentId.ToString());
        }

        // A cancellation frees up that doctor's day, not that exact slot — a
        // waitlist entry is per doctor+date (see patient-book-appointment.tsx),
        // so every "Waiting" entry for this doctor on this date gets notified,
        // not just the one that would exactly fit the freed time.
        private async Task NotifyWaitlistAsync(Appointment appointment)
        {
            var preferredDate = DateOnly.FromDateTime(appointment.ScheduledStart.Date);
            var waiting = await _db.AppointmentWaitlistEntries
                .Where(w => w.DoctorId == appointment.DoctorId && w.PreferredDate == preferredDate && w.Status == "Waiting")
                .ToListAsync();
            if (waiting.Count == 0) return;

            var doctorName = await _db.Doctors.Where(d => d.DoctorId == appointment.DoctorId).Select(d => d.User.FullName).FirstOrDefaultAsync();

            foreach (var entry in waiting)
            {
                var patient = await _db.Patients.Where(p => p.PatientId == entry.PatientId)
                    .Select(p => new { p.UserId, p.FirstName, p.LastName }).FirstOrDefaultAsync();

                if (patient?.UserId is Guid patientUserId)
                {
                    var placeholders = new Dictionary<string, string?>
                    {
                        ["PatientName"] = $"{patient.FirstName} {patient.LastName}",
                        ["DoctorName"] = doctorName,
                        ["PreferredDate"] = preferredDate.ToString("dd/MM/yyyy"),
                    };
                    await NotificationHelper.NotifyFromTemplateAsync(_db, _hub, "WaitlistSlotAvailable", patientUserId, placeholders, "AppointmentWaitlist", entry.WaitlistId.ToString());
                }

                entry.Status = "Notified";
                entry.UpdatedAt = DateTimeOffset.Now;
            }

            await _db.SaveChangesAsync();
        }

        // Once this patient actually has a booking with this doctor on this
        // date, their own waitlist entry (if any) for that doctor/date is
        // done — clears it so it doesn't linger as "Waiting"/"Notified" forever.
        private async Task ResolveWaitlistOnBookingAsync(Appointment appointment)
        {
            var preferredDate = DateOnly.FromDateTime(appointment.ScheduledStart.Date);
            var entries = await _db.AppointmentWaitlistEntries
                .Where(w => w.PatientId == appointment.PatientId && w.DoctorId == appointment.DoctorId
                    && w.PreferredDate == preferredDate && (w.Status == "Waiting" || w.Status == "Notified"))
                .ToListAsync();
            if (entries.Count == 0) return;

            foreach (var entry in entries)
            {
                entry.Status = "Booked";
                entry.UpdatedAt = DateTimeOffset.Now;
            }
            await _db.SaveChangesAsync();
        }

        private bool IsPrivilegedStaff() =>
            User.IsInRole("Admin") || User.IsInRole("SuperUser") || User.IsInRole("ClinicManager") || User.IsInRole("Reception");

        private bool IsHigherPrivileged() => User.IsInRole("Admin") || User.IsInRole("SuperUser");

        // Admin/SuperUser bypass this (checked by the caller) — everyone
        // else, including Reception and ClinicManager, respects the
        // configured grace period since it's a scheduling policy, not an
        // authorization boundary.
        private async Task<string?> ValidateGracePeriodAsync(DateTimeOffset scheduledStart, string settingKey, string actionGreek)
        {
            var minHours = await SystemSettingsHelper.GetIntAsync(_db, settingKey, 0);
            if (minHours <= 0) return null;

            if (scheduledStart - DateTimeOffset.Now < TimeSpan.FromHours(minHours))
                return $"Δεν επιτρέπεται {actionGreek} λιγότερο από {minHours} {(minHours == 1 ? "ώρα" : "ώρες")} πριν το ραντεβού.";

            return null;
        }

        private async Task<Guid?> GetOwnDoctorIdAsync()
        {
            var userId = User.GetUserId();
            return await _db.Doctors.Where(d => d.UserId == userId).Select(d => (Guid?)d.DoctorId).FirstOrDefaultAsync();
        }

        private async Task<Guid?> GetOwnPatientIdAsync()
        {
            var userId = User.GetUserId();
            return await _db.Patients.Where(p => p.UserId == userId).Select(p => (Guid?)p.PatientId).FirstOrDefaultAsync();
        }

        // Groups per .agent.master.md, SignalR design (clinic, doctor, patient scopes).
        // NOTE: SignalRHub.OnConnectedAsync doesn't join these groups yet — it still
        // only joins the legacy role/tenant groups — so wire that up before relying on this.
        private async Task NotifyAsync(Appointment appointment, string eventName)
        {
            var payload = new { appointment.AppointmentId, appointment.ScheduledStart, appointment.AppointmentStatusId };
            await _hub.Clients.Group($"doctor_{appointment.DoctorId}").SendAsync(eventName, payload);
            await _hub.Clients.Group($"clinic_{appointment.ClinicId}").SendAsync(eventName, payload);
            await _hub.Clients.Group($"patient_{appointment.PatientId}").SendAsync(eventName, payload);
        }
    }
}
