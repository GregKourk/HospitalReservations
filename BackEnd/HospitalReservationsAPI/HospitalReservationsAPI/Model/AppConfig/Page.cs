namespace HospitalReservationsAPI.Model.AppConfig
{
    public class Page
    {
        public long App_Forms_Id { get; set; }
        public long? ParentId { get; set; }
        public string Name { get; set; }
        public string? RouteElement { get; set; }
        public string? RouteCombPath { get; set; }
        public string? NavUrl { get; set; }
        public string NavTitle { get; set; }
        public string NavIcon { get; set; }
        public string? NavFontIcon { get; set; }
        public bool? NavHasBullet { get; set; }
        public bool? NavHasChildren { get; set; }
        public bool? CanEdit { get; set; }
        public bool? Visible { get; set; }
        public bool? DevVisible { get; set; }
        public int? OrderValue { get; set; }
        public bool? OnlyRoute { get; set; }
        public bool? IsExternalLink { get; set; }
        public bool UserHasEditRight { get; set; }
        public List<Page>? Pages { get; set; } = new List<Page>();
    }
}
