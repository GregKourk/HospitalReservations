using System.Text.Json;
using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // Every role's own notification feed — the topbar bell and the
    // "Ειδοποιήσεις" page both read this. Rows are written by
    // NotificationHelper from appointment lifecycle events; there's no
    // create endpoint here, only read/mark-read on the caller's own rows.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize]
    public class NotificationsController : BaseApiController
    {
        private record PayloadShape(string? Title, string? Body, string? EntityType, string? EntityId);

        private readonly HospitalReservationsContext _db;

        public NotificationsController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<NotificationDto>>> GetAll([FromQuery] bool unreadOnly = false, [FromQuery] int take = 100)
        {
            var userId = User.GetUserId();
            if (userId is null) return Unauthorized();

            var query = _db.Notifications.Where(n => n.UserId == userId);
            if (unreadOnly) query = query.Where(n => !n.IsRead);

            var rows = await query
                .OrderByDescending(n => n.CreatedAt)
                .Take(Math.Clamp(take, 1, 500))
                .ToListAsync();

            return Ok(rows.Select(ToDto).ToList());
        }

        [HttpGet("UnreadCount")]
        public async Task<ActionResult<int>> UnreadCount()
        {
            var userId = User.GetUserId();
            if (userId is null) return Unauthorized();

            var count = await _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);
            return Ok(count);
        }

        [HttpPut("{id:guid}/Read")]
        public async Task<IActionResult> MarkRead(Guid id)
        {
            var userId = User.GetUserId();
            var notification = await _db.Notifications.FirstOrDefaultAsync(n => n.NotificationId == id && n.UserId == userId);
            if (notification is null) return NotFound();

            if (!notification.IsRead)
            {
                notification.IsRead = true;
                notification.ReadAt = DateTimeOffset.Now;
                await _db.SaveChangesAsync();
            }

            return NoContent();
        }

        [HttpPut("ReadAll")]
        public async Task<IActionResult> MarkAllRead()
        {
            var userId = User.GetUserId();
            var unread = await _db.Notifications.Where(n => n.UserId == userId && !n.IsRead).ToListAsync();
            foreach (var n in unread)
            {
                n.IsRead = true;
                n.ReadAt = DateTimeOffset.Now;
            }
            await _db.SaveChangesAsync();

            return NoContent();
        }

        private static NotificationDto ToDto(Notification n)
        {
            var payload = JsonSerializer.Deserialize<PayloadShape>(n.Payload) ?? new PayloadShape(null, null, null, null);
            return new NotificationDto
            {
                NotificationId = n.NotificationId,
                Type = n.Type,
                Title = payload.Title ?? n.Type,
                Body = payload.Body ?? string.Empty,
                EntityType = payload.EntityType,
                EntityId = payload.EntityId,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            };
        }
    }
}
