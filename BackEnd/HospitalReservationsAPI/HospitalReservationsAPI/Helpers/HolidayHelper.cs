using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Helpers
{
    // Shared holiday match used by both Doctors/{id}/Availability (hides
    // slots) and AppointmentsController (hard-blocks Create/Reschedule) so
    // the two can't drift into disagreeing about what counts as a holiday.
    // The Holidays table is always small, so this loads active rows once and
    // matches in memory rather than trying to translate month/day
    // comparisons into SQL.
    public static class HolidayHelper
    {
        public static async Task<Holiday?> FindMatchAsync(HospitalReservationsContext db, DateOnly date)
        {
            var holidays = await db.Holidays.Where(h => h.IsActive).ToListAsync();
            return holidays.FirstOrDefault(h =>
                h.HolidayDate == date ||
                (h.IsRecurringAnnual && h.HolidayDate.Month == date.Month && h.HolidayDate.Day == date.Day));
        }
    }
}
