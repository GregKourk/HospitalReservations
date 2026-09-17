namespace HospitalReservationsAPI
{
    // Hand-written to match database/012_system_settings.sql — re-run the EF
    // Power Tools scaffold and this file can be deleted once it picks the
    // table up. Doctors/{id}/Availability checks this before computing any
    // slots — a holiday zeroes out availability for every doctor that day
    // regardless of their own weekly schedule.
    public class Holiday
    {
        public Guid HolidayId { get; set; } = Guid.NewGuid();
        public DateOnly HolidayDate { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        // When true, matches every year on the same month/day (Christmas,
        // New Year's) instead of just the one HolidayDate stored here.
        public bool IsRecurringAnnual { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
    }
}
