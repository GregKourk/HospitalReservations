using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.SignalR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Services
{
    // Closes the "υπενθύμιση" (reminder) leg of the Patient role's own
    // Ειδοποιήσεις outline — the "AppointmentReminder" template was seeded
    // from day one (012_system_settings.sql) but nothing ever fired it.
    // Polls for appointments starting within SystemSettings["ReminderLeadHours"]
    // (default 24h) and sends the reminder once per appointment,
    // deduped via Appointments.ReminderSentAt.
    public class AppointmentReminderService : BackgroundService
    {
        private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(15);

        private const byte CompletedStatusId = 4;
        private const byte CancelledStatusId = 5;
        private const byte NoShowStatusId = 6;

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AppointmentReminderService> _logger;

        public AppointmentReminderService(IServiceScopeFactory scopeFactory, ILogger<AppointmentReminderService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(PollInterval);
            do
            {
                try
                {
                    await SendDueRemindersAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    // A failed tick (e.g. transient DB hiccup) must not kill the
                    // whole background service — the next tick just tries again.
                    _logger.LogError(ex, "AppointmentReminderService tick failed.");
                }
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }

        private async Task SendDueRemindersAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<HospitalReservationsContext>();
            var hub = scope.ServiceProvider.GetRequiredService<IHubContext<SignalRHub>>();

            var leadHours = await SystemSettingsHelper.GetIntAsync(db, "ReminderLeadHours", 24);
            var now = DateTimeOffset.Now;
            var dueBy = now.AddHours(leadHours);

            var due = await db.Appointments
                .Where(a => !a.IsDeleted
                    && a.ReminderSentAt == null
                    && a.ScheduledStart > now
                    && a.ScheduledStart <= dueBy
                    && a.AppointmentStatusId != CancelledStatusId
                    && a.AppointmentStatusId != NoShowStatusId
                    && a.AppointmentStatusId != CompletedStatusId)
                .Select(a => new { a.AppointmentId, a.ScheduledStart, a.DoctorId, a.PatientId })
                .ToListAsync(ct);

            if (due.Count == 0) return;

            foreach (var appointment in due)
            {
                var info = await db.Appointments.Where(a => a.AppointmentId == appointment.AppointmentId)
                    .Select(a => new { PatientUserId = a.Patient.UserId, PatientName = a.Patient.FirstName + " " + a.Patient.LastName, DoctorName = a.Doctor.User.FullName })
                    .FirstOrDefaultAsync(ct);

                if (info?.PatientUserId is Guid patientUserId)
                {
                    var placeholders = new Dictionary<string, string?>
                    {
                        ["PatientName"] = info.PatientName,
                        ["DoctorName"] = info.DoctorName,
                        ["AppointmentDateTime"] = appointment.ScheduledStart.ToString("dd/MM/yyyy HH:mm"),
                    };
                    await NotificationHelper.NotifyFromTemplateAsync(db, hub, "AppointmentReminder", patientUserId, placeholders, "Appointment", appointment.AppointmentId.ToString());
                }

                await db.Appointments.Where(a => a.AppointmentId == appointment.AppointmentId)
                    .ExecuteUpdateAsync(s => s.SetProperty(a => a.ReminderSentAt, DateTimeOffset.Now), ct);
            }
        }
    }
}
