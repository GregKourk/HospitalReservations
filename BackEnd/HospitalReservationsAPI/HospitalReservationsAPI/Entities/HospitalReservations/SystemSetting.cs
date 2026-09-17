namespace HospitalReservationsAPI
{
    // Hand-written to match database/012_system_settings.sql — re-run the EF
    // Power Tools scaffold and this file can be deleted once it picks the
    // table up. Simple key-value store for scalar policy knobs (business
    // hours, cancellation/reschedule grace periods) — Holidays and
    // NotificationTemplates are real record lists and get their own tables.
    public class SystemSetting
    {
        public string SettingKey { get; set; } = string.Empty;
        public string? SettingValue { get; set; }
        public string? Description { get; set; }
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.Now;
        public Guid? UpdatedByUserId { get; set; }
    }
}
