using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // Scalar policy knobs — business hours and cancellation/reschedule grace
    // periods — actually enforced by DoctorSchedulesController and
    // AppointmentsController via SystemSettingsHelper. Holidays and
    // NotificationTemplates are separate controllers (real record lists,
    // not scalar values).
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize(Roles = "Admin,SuperUser")]
    public class SystemSettingsController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public SystemSettingsController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<SystemSettingDto>>> GetAll()
        {
            var settings = await _db.SystemSettings
                .OrderBy(s => s.SettingKey)
                .Select(s => new SystemSettingDto { SettingKey = s.SettingKey, SettingValue = s.SettingValue, Description = s.Description, UpdatedAt = s.UpdatedAt })
                .ToListAsync();

            return Ok(settings);
        }

        [HttpPut("{key}")]
        public async Task<IActionResult> Update(string key, SystemSettingUpdateRequest request)
        {
            var setting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.SettingKey == key);
            if (setting is null) return NotFound();

            if ((key == "BusinessHoursStart" || key == "BusinessHoursEnd") && !TimeSpan.TryParse(request.SettingValue, out _))
                return BadRequest("Η ώρα πρέπει να έχει μορφή HH:mm.");
            if (key == "CancellationMinHours" || key == "RescheduleMinHours" || key == "ReminderLeadHours")
            {
                if (!int.TryParse(request.SettingValue, out var hours))
                    return BadRequest("Η τιμή πρέπει να είναι ακέραιος αριθμός ωρών.");
                if (hours < 0)
                    return BadRequest("Η τιμή δεν μπορεί να είναι αρνητική.");
            }

            var before = new { setting.SettingValue };
            setting.SettingValue = request.SettingValue;
            setting.UpdatedAt = DateTimeOffset.Now;
            setting.UpdatedByUserId = User.GetUserId();
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Update", "SystemSetting", key, before, new { setting.SettingValue });

            return NoContent();
        }
    }
}
