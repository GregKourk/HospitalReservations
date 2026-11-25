namespace HospitalReservationsAPI.Model.DTOs
{
    // A specialty ("Ειδικότητα") from the business-wide list — no longer tied
    // to one clinic (025_shared_specialties.sql). The Department name is kept
    // in code so routes, tables and audit EntityType stay unchanged.
    public class DepartmentDto
    {
        public Guid DepartmentId { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        // Active doctors in this specialty, across all branches (or only the
        // requested/own branch when the list is filtered by clinic).
        public int DoctorCount { get; set; }
    }

    public class DepartmentUpsertRequest
    {
        public string Name { get; set; } = string.Empty;
    }
}
