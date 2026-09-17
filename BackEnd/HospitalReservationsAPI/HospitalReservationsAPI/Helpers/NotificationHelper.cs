using System.Text.Json;
using HospitalReservationsAPI.Model.SignalR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Helpers
{
    // Renders a dbo.NotificationTemplates row against {Placeholder} values,
    // persists one dbo.Notifications row per recipient, and pushes it over
    // SignalR to that user's personal group (SignalRHub joins "user_{id}" on
    // connect) so the topbar bell updates live without a page refresh.
    public static class NotificationHelper
    {
        public static async Task NotifyFromTemplateAsync(
            HospitalReservationsContext db,
            IHubContext<SignalRHub> hub,
            string templateCode,
            Guid recipientUserId,
            Dictionary<string, string?> placeholders,
            string? entityType = null,
            string? entityId = null)
        {
            var template = await db.NotificationTemplates.FirstOrDefaultAsync(t => t.Code == templateCode && t.IsActive);
            if (template is null) return; // disabled or not seeded — silently skip, not a failure

            var title = Render(template.Subject, placeholders);
            var body = Render(template.Body, placeholders);

            var notification = new Notification
            {
                UserId = recipientUserId,
                Type = templateCode,
                Payload = JsonSerializer.Serialize(new { Title = title, Body = body, EntityType = entityType, EntityId = entityId })
            };
            db.Notifications.Add(notification);
            await db.SaveChangesAsync();

            await hub.Clients.Group($"user_{recipientUserId}").SendAsync("Notification", new
            {
                notification.NotificationId,
                notification.Type,
                Title = title,
                Body = body,
                EntityType = entityType,
                EntityId = entityId,
                notification.CreatedAt
            });
        }

        private static string Render(string template, Dictionary<string, string?> values)
        {
            var result = template;
            foreach (var (key, value) in values)
                result = result.Replace("{" + key + "}", value ?? string.Empty);
            return result;
        }
    }
}
