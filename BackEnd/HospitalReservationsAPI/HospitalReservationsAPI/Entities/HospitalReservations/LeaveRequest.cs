namespace HospitalReservationsAPI
{
    // Hand-written to match database/017_leave_requests.sql — re-run the EF
    // Power Tools scaffold and this file can be deleted once it picks the
    // table up. An Approved request blocks Doctors/{id}/Availability and
    // Appointments Create/Reschedule for that doctor over [StartDate,EndDate]
    // — see Helpers/LeaveHelper.cs.
    public class LeaveRequest
    {
        public Guid LeaveRequestId { get; set; } = Guid.NewGuid();
        public Guid DoctorId { get; set; }
        public DateOnly StartDate { get; set; }
        public DateOnly EndDate { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = "Pending";
        public DateTimeOffset RequestedAt { get; set; } = DateTimeOffset.Now;
        public Guid? ReviewedByUserId { get; set; }
        public DateTimeOffset? ReviewedAt { get; set; }
        public string? ReviewNote { get; set; }

        public Doctor? Doctor { get; set; }
    }
}
