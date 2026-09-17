using System.ComponentModel.DataAnnotations;

namespace HospitalReservationsAPI.Model.DTOs
{
    public class SystemSettingDto
    {
        public string SettingKey { get; set; } = string.Empty;
        public string? SettingValue { get; set; }
        public string? Description { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    public class SystemSettingUpdateRequest
    {
        [Required]
        public string SettingValue { get; set; } = string.Empty;
    }

    public class HolidayDto
    {
        public Guid HolidayId { get; set; }
        public DateOnly HolidayDate { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public bool IsRecurringAnnual { get; set; }
    }

    public class HolidayUpsertRequest
    {
        [Required]
        public DateOnly HolidayDate { get; set; }
        [Required]
        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public bool IsRecurringAnnual { get; set; }
    }

    public class NotificationTemplateDto
    {
        public Guid TemplateId { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    public class NotificationTemplateUpdateRequest
    {
        [Required]
        public string Subject { get; set; } = string.Empty;
        [Required]
        public string Body { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
    }
}
