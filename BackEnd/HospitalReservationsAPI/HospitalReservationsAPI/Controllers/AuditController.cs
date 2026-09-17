using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // The exports themselves (PDF/Excel) are generated entirely client-side
    // (DevExtreme + ExcelJS/jsPDF, no data round-trip) — this is purely the
    // audit hook the SPA calls right after one completes, per
    // .agent.master.md's "report exports" line in the audit requirements.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize]
    public class AuditController : BaseApiController
    {
        // "Security events" isn't a separate log — it's this same audit
        // trail, curated to the action types that matter for a security
        // review (auth failures, account status flips, privilege changes,
        // auto-provisioned external accounts).
        private static readonly string[] SecurityActionTypes =
            { "LoginFailed", "Activate", "Deactivate", "UpdateRoles", "LoginProvisioned" };

        private readonly HospitalReservationsContext _db;

        public AuditController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpPost("Export")]
        public async Task<IActionResult> LogExport(ExportLogRequest request)
        {
            await AuditLogger.LogAsync(_db, HttpContext, "Export", request.EntityType, null, after: new { request.Format });
            return NoContent();
        }

        // Generic log viewer — the frontend's three tabs (Όλα / Αποτυχημένες
        // Συνδέσεις / Γεγονότα Ασφαλείας) are just different actionTypes
        // values against this one endpoint, not separate data sources.
        [HttpGet("Logs")]
        [Authorize(Roles = "Admin,SuperUser")]
        public async Task<ActionResult<List<AuditLogDto>>> GetLogs(
            [FromQuery] DateTimeOffset? from,
            [FromQuery] DateTimeOffset? to,
            [FromQuery] string? actionTypes, // comma-separated
            [FromQuery] string? entityType,
            [FromQuery] string? search, // matches user name/email, role, or entity id
            [FromQuery] bool securityOnly = false,
            [FromQuery] int take = 300)
        {
            var query = _db.audit_AuditLogs.AsQueryable();

            query = query.Where(l => l.Timestamp >= (from ?? DateTimeOffset.Now.AddDays(-30)));
            if (to.HasValue) query = query.Where(l => l.Timestamp <= to);

            if (securityOnly)
            {
                query = query.Where(l => SecurityActionTypes.Contains(l.ActionType));
            }
            else if (!string.IsNullOrWhiteSpace(actionTypes))
            {
                var types = actionTypes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                query = query.Where(l => types.Contains(l.ActionType));
            }

            if (!string.IsNullOrWhiteSpace(entityType))
                query = query.Where(l => l.EntityType == entityType);

            var take_ = Math.Clamp(take, 1, 1000);

            var joined =
                from log in query
                join user in _db.Users on log.UserId equals user.UserId into gj
                from user in gj.DefaultIfEmpty()
                select new AuditLogDto
                {
                    AuditLogId = log.AuditLogId,
                    Timestamp = log.Timestamp,
                    UserId = log.UserId,
                    UserName = user != null ? user.FullName : null,
                    Role = log.Role,
                    ActionType = log.ActionType,
                    EntityType = log.EntityType,
                    EntityId = log.EntityId,
                    SourceIp = log.SourceIp,
                    UserAgent = log.UserAgent,
                    BeforeSnapshot = log.BeforeSnapshot,
                    AfterSnapshot = log.AfterSnapshot
                };

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                joined = joined.Where(l =>
                    (l.UserName != null && l.UserName.Contains(term)) ||
                    (l.Role != null && l.Role.Contains(term)) ||
                    (l.EntityId != null && l.EntityId.Contains(term)));
            }

            var results = await joined
                .OrderByDescending(l => l.Timestamp)
                .Take(take_)
                .ToListAsync();

            return Ok(results);
        }
    }
}
