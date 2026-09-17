using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Diagnostics;

namespace HospitalReservationsAPI.Model.SignalR
{
    [Authorize]
    public class SignalRHub : Hub
    {
        private readonly SignalRConnectionMapping _connectionMapping;

        public SignalRHub(SignalRConnectionMapping connectionMapping)
        {
            _connectionMapping = connectionMapping;
        }

        public override async Task<Task> OnConnectedAsync()
        {
            var user = Context.User;
            var userId = user.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userId))            
                _connectionMapping.AddConnection(userId, Context.ConnectionId);          
                
            if (user?.Identity?.IsAuthenticated == true)
            {
                var roles = user.Claims
                    .Where(c => c.Type == System.Security.Claims.ClaimTypes.Role || c.Type == "role")
                    .Select(c => c.Value);
                foreach (var role in roles)
                    await Groups.AddToGroupAsync(Context.ConnectionId, role);

                // Join all visible tenant groups (TenantIds is comma-separated list)
                var tenantIdsRaw = user.Claims.FirstOrDefault(c => c.Type == "TenantIds")?.Value;
                if (!string.IsNullOrEmpty(tenantIdsRaw))
                {
                    foreach (var id in tenantIdsRaw.Split(',', StringSplitOptions.RemoveEmptyEntries))
                        await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{id.Trim()}");
                }
                else
                {
                    // Fallback: single TenantId claim
                    var tenantId = user.Claims.FirstOrDefault(c => c.Type == "TenantId")?.Value;
                    if (!string.IsNullOrEmpty(tenantId))
                        await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
                }

                // GlobalViewer joins the catch-all group
                var isGlobalViewer = user.Claims.FirstOrDefault(c => c.Type == "GlobalViewer")?.Value == "True";
                if (isGlobalViewer)
                    await Groups.AddToGroupAsync(Context.ConnectionId, "tenant_global");

                // ← add: personal user group for direct targeting
                var nameId = user.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(nameId))
                    await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{nameId}");
            }

            return base.OnConnectedAsync();
        }

        public override async Task<Task> OnDisconnectedAsync(Exception? exception)
        {
            var user = Context.User;
            var userId = user.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userId))
                _connectionMapping.RemoveConnection(userId, Context.ConnectionId);

            if (user?.Identity?.IsAuthenticated == true)
            {
                var roles = user.Claims
                    .Where(c => c.Type == System.Security.Claims.ClaimTypes.Role || c.Type == "role")
                    .Select(c => c.Value);
                foreach (var role in roles)
                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, role);

                var tenantIdsRaw = user.Claims.FirstOrDefault(c => c.Type == "TenantIds")?.Value;
                if (!string.IsNullOrEmpty(tenantIdsRaw))
                {
                    foreach (var id in tenantIdsRaw.Split(',', StringSplitOptions.RemoveEmptyEntries))
                        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"tenant_{id.Trim()}");
                }
                else
                {
                    var tenantId = user.Claims.FirstOrDefault(c => c.Type == "TenantId")?.Value;
                    if (!string.IsNullOrEmpty(tenantId))
                        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
                }

                var isGlobalViewer = user.Claims.FirstOrDefault(c => c.Type == "GlobalViewer")?.Value == "True";
                if (isGlobalViewer)
                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, "tenant_global");

                // ← add: leave personal group
                var nameId = user.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(nameId))
                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{nameId}");
            }

            return base.OnDisconnectedAsync(exception);
        }
    }
}
