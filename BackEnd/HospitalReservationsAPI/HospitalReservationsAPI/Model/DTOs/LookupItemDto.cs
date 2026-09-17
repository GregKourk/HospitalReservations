namespace HospitalReservationsAPI.Model.DTOs
{
    public class LookupItemDto
    {
        public Guid Id { get; set; }
        public string Text { get; set; } = string.Empty;
    }

    public class StatusLookupDto
    {
        public byte Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string? Description { get; set; }
    }
}
