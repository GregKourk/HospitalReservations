using System.ComponentModel.DataAnnotations;

namespace HospitalReservationsAPI.Model.DTOs
{
    public class LeaveRequestDto
    {
        public Guid LeaveRequestId { get; set; }
        public Guid DoctorId { get; set; }
        public string DoctorName { get; set; } = string.Empty;
        public DateOnly StartDate { get; set; }
        public DateOnly EndDate { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTimeOffset RequestedAt { get; set; }
        public string? ReviewedByName { get; set; }
        public DateTimeOffset? ReviewedAt { get; set; }
        public string? ReviewNote { get; set; }
    }

    public class LeaveRequestCreateRequest
    {
        [Required]
        public DateOnly StartDate { get; set; }
        [Required]
        public DateOnly EndDate { get; set; }
        public string? Reason { get; set; }
    }

    public class LeaveRequestReviewRequest
    {
        [Required]
        public bool Approve { get; set; }
        public string? ReviewNote { get; set; }
    }
}
