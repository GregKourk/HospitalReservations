using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Helpers
{
    // Shared by Doctors/{id}/Availability (hides slots) and
    // AppointmentsController (hard-blocks Create/Reschedule) — an Approved
    // leave request blocks just that one doctor, unlike a Holiday which
    // blocks everyone.
    public static class LeaveHelper
    {
        public static async Task<bool> IsDoctorOnLeaveAsync(HospitalReservationsContext db, Guid doctorId, DateOnly date)
            => await db.LeaveRequests.AnyAsync(l =>
                l.DoctorId == doctorId && l.Status == "Approved" && l.StartDate <= date && l.EndDate >= date);
    }
}
