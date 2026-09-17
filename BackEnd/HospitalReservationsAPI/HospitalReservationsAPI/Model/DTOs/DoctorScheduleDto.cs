using System.ComponentModel.DataAnnotations;

namespace HospitalReservationsAPI.Model.DTOs
{
    public class DoctorScheduleDto
    {
        public Guid ScheduleId { get; set; }
        public Guid DoctorId { get; set; }
        public string DoctorName { get; set; } = string.Empty;
        public Guid ClinicId { get; set; }
        public string ClinicName { get; set; } = string.Empty;
        public byte DayOfWeek { get; set; } // 0 = Sunday .. 6 = Saturday
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public int SlotMinutes { get; set; }
        public DateTime EffectiveFrom { get; set; }
        public DateTime? EffectiveTo { get; set; }
        public bool IsActive { get; set; }
    }

    public class DoctorScheduleCreateRequest
    {
        public Guid DoctorId { get; set; }
        public Guid ClinicId { get; set; }
        [Range(0, 6)]
        public byte DayOfWeek { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        [Range(5, 480)]
        public int SlotMinutes { get; set; } = 15;
        public DateTime EffectiveFrom { get; set; }
        public DateTime? EffectiveTo { get; set; }
    }

    public class DoctorScheduleUpdateRequest
    {
        [Range(0, 6)]
        public byte DayOfWeek { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        [Range(5, 480)]
        public int SlotMinutes { get; set; }
        public DateTime EffectiveFrom { get; set; }
        public DateTime? EffectiveTo { get; set; }
        public bool IsActive { get; set; }
    }
}
