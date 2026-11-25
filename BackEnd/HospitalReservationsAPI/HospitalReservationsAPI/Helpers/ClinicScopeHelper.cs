using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Helpers
{
    // "Υποκαταστήματα (scope: δικά του)" — a ClinicManager runs every Clinic
    // whose Clinics.ManagerUserId is them (one or more branches), and every
    // clinic-owned screen (Doctors, DoctorSchedules, Appointments, Reports,
    // Waitlist, Dashboard) narrows to that set. Admin/SuperUser/Reception stay
    // unscoped — this helper is only ever consulted for the ClinicManager role.
    public static class ClinicScopeHelper
    {
        // Empty (never null) when the user manages no clinic, so filters like
        // ids.Contains(x.ClinicId) correctly match nothing.
        public static async Task<List<Guid>> GetManagedClinicIdsAsync(HospitalReservationsContext db, Guid? userId)
        {
            if (userId is null) return new List<Guid>();
            return await db.Clinics.Where(c => c.ManagerUserId == userId && !c.IsDeleted).Select(c => c.ClinicId).ToListAsync();
        }
    }
}
