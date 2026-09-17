namespace HospitalReservationsAPI.Model.Interfaces
{
    public class IAppUser
    {
        int UserId { get; set; }
        string FirstName { get; set; }
        string LastName { get; set; }
        string Ama { get; set; }
        string Title { get; set; }
        int ThesiId { get; set; }
        string Thesi { get; set; }
        int UnitId { get; set; }
        string? UserIpAddress { get; set; }
        List<string> Roles { get; set; }
        Dictionary<string, string> Claims { get; set; }
        int TopLevelUnitId { get; set; }
        string? TopLevelTitle { get; set; }
        string? FullNameShort { get; }
        string? FullName { get; }
    }
}
