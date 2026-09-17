using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // Codes are fixed/seeded (database/012_system_settings.sql), matching
    // the appointment lifecycle events an eventual notification-sending
    // pipeline would fire on — only wording (subject/body) and active state
    // are editable here, not the code itself.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize(Roles = "Admin,SuperUser")]
    public class NotificationTemplatesController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public NotificationTemplatesController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<NotificationTemplateDto>>> GetAll()
        {
            var templates = await _db.NotificationTemplates
                .OrderBy(t => t.Name)
                .Select(t => new NotificationTemplateDto
                {
                    TemplateId = t.TemplateId,
                    Code = t.Code,
                    Name = t.Name,
                    Subject = t.Subject,
                    Body = t.Body,
                    IsActive = t.IsActive,
                    UpdatedAt = t.UpdatedAt
                })
                .ToListAsync();

            return Ok(templates);
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, NotificationTemplateUpdateRequest request)
        {
            var template = await _db.NotificationTemplates.FirstOrDefaultAsync(t => t.TemplateId == id);
            if (template is null) return NotFound();

            var before = new { template.Subject, template.Body, template.IsActive };
            template.Subject = request.Subject;
            template.Body = request.Body;
            template.IsActive = request.IsActive;
            template.UpdatedAt = DateTimeOffset.Now;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Update", "NotificationTemplate", id.ToString(), before, request);

            return NoContent();
        }
    }
}
