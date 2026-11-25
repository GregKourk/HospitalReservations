namespace HospitalReservationsAPI
{
    // Hand-written to match database/026_doctor_clinics.sql — re-run the EF
    // Power Tools scaffold and this file can be deleted once it picks the
    // table up. Every branch a doctor works at; Doctors.ClinicId (the main
    // branch) is always one of these rows (DoctorsController keeps them in sync).
    public class DoctorClinic
    {
        public Guid DoctorId { get; set; }
        public Guid ClinicId { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;

        public Doctor? Doctor { get; set; }
        public Clinic? Clinic { get; set; }
    }

    public partial class Doctor
    {
        public ICollection<DoctorClinic> DoctorClinics { get; set; } = new List<DoctorClinic>();
    }
}
