namespace HospitalReservationsAPI
{
    // Hand-written to match database/023_reminders_and_waitlist.sql — re-run
    // the EF Power Tools scaffold and this file can be deleted once it picks
    // the table up. A patient joins this when a doctor has no open slot on
    // their chosen date; when an appointment for that doctor/date gets
    // Cancelled, every "Waiting" entry is notified (see
    // AppointmentsController.NotifyWaitlistAsync) and flips to "Notified" —
    // booking afterward is a normal Appointments/Create, not automatic.
    public class AppointmentWaitlistEntry
    {
        public Guid WaitlistId { get; set; } = Guid.NewGuid();
        public Guid PatientId { get; set; }
        public Guid ClinicId { get; set; }
        public Guid DepartmentId { get; set; }
        public Guid DoctorId { get; set; }
        public DateOnly PreferredDate { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = "Waiting";
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.Now;

        public Patient? Patient { get; set; }
        public Clinic? Clinic { get; set; }
        public Department? Department { get; set; }
        public Doctor? Doctor { get; set; }
    }
}
