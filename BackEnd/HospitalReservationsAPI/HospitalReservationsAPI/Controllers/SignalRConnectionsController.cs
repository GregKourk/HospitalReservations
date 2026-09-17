using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HospitalReservationsAPI.Model.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    [Route("[controller]")]
    [ApiController]
    [Authorize]
    public class SignalRConnectionsController : ControllerBase
    {
        private readonly HospitalReservationsContext _hospitalReservationsContext;
        private readonly SignalRConnectionMapping _connectionMapping;

        public SignalRConnectionsController(HospitalReservationsContext hospitalReservationsContext, SignalRConnectionMapping connectionMapping)
        {
            _hospitalReservationsContext = hospitalReservationsContext;
            _connectionMapping = connectionMapping;
        }

        [HttpGet("activeConnections")]
        public IActionResult GetActiveConnections()
        {
            var activeConnections = _connectionMapping.GetAllConnections();
            return Ok(activeConnections);
        }

        [HttpGet("activeUsers")]
        public async Task<IActionResult> GetActiveUsers()
        {
            // Connections are keyed by UserId (see SignalRHub.OnConnectedAsync).
            var activeConnections = _connectionMapping.GetAllConnections();

            var userIds = activeConnections.Keys
                .Select(k => Guid.TryParse(k, out var id) ? id : (Guid?)null)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .ToList();

            if (userIds.Count == 0)
                return Ok(new List<object>());

            var users = await _hospitalReservationsContext.Users
                .Where(u => userIds.Contains(u.UserId))
                .Select(u => new { u.UserId, u.FullName })
                .ToListAsync();

            var result = users.Select(u => new
            {
                DisplayName = u.FullName,
                ConnectionsCount = activeConnections.TryGetValue(u.UserId.ToString(), out var conns) ? conns.Count : 0
            });

            return Ok(result);
        }
    }
}
