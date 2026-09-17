namespace HospitalReservationsAPI.Model.AppConfig
{
    // Body για ActionLogController.LogClientAction — καταγραφή ενεργειών (π.χ. exports)
    // που συμβαίνουν εξ ολοκλήρου client-side (DevExtreme exportDataGrid), οπότε ο μόνος
    // τρόπος να καταγραφούν στο ALL_ACTION_LOG είναι το frontend να το ζητήσει ρητά.
    public record ClientActionLogRequest(string Action, string? TargetType, long? TargetId, string? Details);
}
