namespace HospitalReservationsAPI
{
    // Hand-written to match database/012_system_settings.sql — re-run the EF
    // Power Tools scaffold and this file can be deleted once it picks the
    // table up. Codes are fixed (seeded, matching the appointment lifecycle
    // events that would eventually send them) — admins edit wording, not
    // create arbitrary new codes nothing will ever fire.
    public class NotificationTemplate
    {
        public Guid TemplateId { get; set; } = Guid.NewGuid();
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.Now;
    }
}
