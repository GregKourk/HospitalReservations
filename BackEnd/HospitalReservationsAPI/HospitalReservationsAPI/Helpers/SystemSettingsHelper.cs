using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Helpers
{
    // Small reader for dbo.SystemSettings — the policy knobs (business
    // hours, cancellation/reschedule grace periods) consumed by
    // DoctorSchedulesController and AppointmentsController.
    public static class SystemSettingsHelper
    {
        public static async Task<string?> GetAsync(HospitalReservationsContext db, string key)
            => await db.SystemSettings.Where(s => s.SettingKey == key).Select(s => s.SettingValue).FirstOrDefaultAsync();

        public static async Task<int> GetIntAsync(HospitalReservationsContext db, string key, int fallback)
        {
            var raw = await GetAsync(db, key);
            return int.TryParse(raw, out var value) ? value : fallback;
        }

        public static async Task<TimeSpan?> GetTimeAsync(HospitalReservationsContext db, string key)
        {
            var raw = await GetAsync(db, key);
            return TimeSpan.TryParse(raw, out var value) ? value : null;
        }
    }
}
