using System.ComponentModel.DataAnnotations.Schema;

namespace HospitalReservationsAPI.Entities.EPOE
{
    public partial class LoginApplicationForm
    {
        [NotMapped]
        public List<LoginApplicationForm> Pages { get; set; } = new List<LoginApplicationForm>();
        [NotMapped]
        public bool HasPages => Pages != null ? Pages.Any() : false ;
        [NotMapped]
        public bool ParentEmpty { get; set; } = false;
        [NotMapped]
        public bool UserHasEditRight { get; set; } = false;
    }
}
