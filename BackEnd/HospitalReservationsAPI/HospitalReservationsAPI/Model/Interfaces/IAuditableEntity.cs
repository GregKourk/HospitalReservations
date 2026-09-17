namespace HospitalReservationsAPI.Model.Interfaces
{
    public interface IAuditableEntity
    {
        DateTime? AddedDate { get; set; }
        DateTime? ModifiedDate { get; set; }
        string? ModifiedBy { get; set; }
        string? ModifiedFromIp { get; set; }
    }
}
