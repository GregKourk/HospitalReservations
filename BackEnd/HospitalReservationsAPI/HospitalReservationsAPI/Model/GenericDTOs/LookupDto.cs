namespace HospitalReservationsAPI.Model.DTOs
{
    public class LookupDto
    {
        public int Id { get; set; }
        public string Description { get; set; }
        public string? PropStr1 { get; set; }
        public string? PropStr2 { get; set; }
        public int? PropInt1 { get; set; }
        public int? PropInt2 { get; set; }
        public object? PropObject { get; set; }
        public bool PropBoolean { get; set; }
    }
}
