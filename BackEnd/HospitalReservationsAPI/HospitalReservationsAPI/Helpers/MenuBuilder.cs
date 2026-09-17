using HospitalReservationsAPI.Model.AppConfig;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Helpers
{
    // Builds the per-user menu/route tree from LoginApplicationForms +
    // LoginApplicationFormRights at login time. Admin bypasses the rights
    // table entirely (sees every visible form); every other role only sees
    // a form if it's IsForAllUser, a group header (NavHasChildren — pruned
    // below if it ends up with no visible children), or explicitly granted
    // to one of the caller's roles via LoginApplicationFormRights.
    public static class MenuBuilder
    {
        public static async Task<List<Page>> BuildRootPagesAsync(HospitalReservationsContext db, IEnumerable<string> roleNames)
        {
            var roles = roleNames.ToList();
            var isAdmin = roles.Contains("Admin");

            var roleIds = await db.Roles.Where(r => roles.Contains(r.Name)).Select(r => r.RoleId).ToListAsync();

            var forms = await db.LoginApplicationForms
                .Include(f => f.LoginApplicationFormRights)
                .Where(f => f.Visible == true)
                .OrderBy(f => f.OrderValue)
                .ToListAsync();

            var byParent = forms
                .Where(f =>
                    isAdmin ||
                    f.IsForAllUser ||
                    f.NavHasChildren == true ||
                    f.LoginApplicationFormRights.Any(r => roleIds.Contains(r.RoleId)))
                .GroupBy(f => f.ParentId ?? 0L)
                .ToDictionary(g => g.Key, g => g.ToList());

            List<Page> Build(long parentId)
            {
                if (!byParent.TryGetValue(parentId, out var items))
                    return new List<Page>();

                var result = new List<Page>();
                foreach (var f in items)
                {
                    var children = Build(f.Id);

                    // A group header nobody has any visible children under is noise, not a menu item.
                    if (f.NavHasChildren == true && children.Count == 0)
                        continue;

                    result.Add(new Page
                    {
                        App_Forms_Id = f.Id,
                        ParentId = f.ParentId,
                        Name = f.Name,
                        RouteElement = f.RouteElement,
                        RouteCombPath = f.RouteCombPath,
                        NavUrl = f.NavUrl,
                        NavTitle = f.NavTitle,
                        NavIcon = f.NavIcon,
                        NavFontIcon = f.NavFontIcon,
                        NavHasBullet = f.NavHasBullet,
                        NavHasChildren = f.NavHasChildren,
                        CanEdit = f.CanEdit,
                        Visible = f.Visible,
                        DevVisible = f.DevVisible,
                        OrderValue = f.OrderValue,
                        OnlyRoute = f.OnlyRoute,
                        IsExternalLink = f.IsExternalLink,
                        Pages = children
                    });
                }
                return result;
            }

            return Build(0L);
        }
    }
}
