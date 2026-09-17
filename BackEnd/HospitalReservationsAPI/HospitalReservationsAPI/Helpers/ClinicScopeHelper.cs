using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Helpers
{
    // "Κλινικές (scope: δική του)" — a ClinicManager is tied to exactly one
    // Clinic via Clinics.ManagerUserId, and every clinic-owned screen
    // (Departments, Doctors, DoctorSchedules, Appointments, Reports) narrows
    // to it. Admin/SuperUser/Reception stay unscoped — this helper is only
    // ever consulted for the ClinicManager role specifically.
    public static class ClinicScopeHelper
    {
        public static async Task<Guid?> GetOwnManagedClinicIdAsync(HospitalReservationsContext db, Guid? userId)
        {
            if (userId is null) return null;
            return await db.Clinics.Where(c => c.ManagerUserId == userId && !c.IsDeleted).Select(c => (Guid?)c.ClinicId).FirstOrDefaultAsync();
        }
    }
}
