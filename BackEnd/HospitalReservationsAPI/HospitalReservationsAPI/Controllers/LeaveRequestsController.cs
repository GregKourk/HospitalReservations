using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // "Διαθεσιμότητα / Άδειες" — a Doctor requests a date range off,
    // ClinicManager/Admin/SuperUser approve or reject it. Approving actually
    // blocks that doctor's availability (see LeaveHelper) — this isn't a
    // paperwork-only trail, it changes what Reception can book.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize]
    public class LeaveRequestsController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public LeaveRequestsController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<LeaveRequestDto>>> GetAll([FromQuery] string? status)
        {
            var query = _db.LeaveRequests.AsQueryable();

            if (!IsReviewer())
            {
                if (!User.IsInRole("Doctor")) return Forbid();
                var ownDoctorId = await GetOwnDoctorIdAsync();
                query = query.Where(l => l.DoctorId == ownDoctorId);
            }

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(l => l.Status == status);

            var results = await (
                from l in query
                join reviewer in _db.Users on l.ReviewedByUserId equals reviewer.UserId into gj
                from reviewer in gj.DefaultIfEmpty()
                orderby l.RequestedAt descending
                select new LeaveRequestDto
                {
                    LeaveRequestId = l.LeaveRequestId,
                    DoctorId = l.DoctorId,
                    DoctorName = l.Doctor.User.FullName,
                    StartDate = l.StartDate,
                    EndDate = l.EndDate,
                    Reason = l.Reason,
                    Status = l.Status,
                    RequestedAt = l.RequestedAt,
                    ReviewedByName = reviewer != null ? reviewer.FullName : null,
                    ReviewedAt = l.ReviewedAt,
                    ReviewNote = l.ReviewNote
                }).ToListAsync();

            return Ok(results);
        }

        [HttpPost]
        [Authorize(Roles = "Doctor")]
        public async Task<ActionResult<Guid>> Create(LeaveRequestCreateRequest request)
        {
            if (request.EndDate < request.StartDate)
                return BadRequest("Η ημερομηνία λήξης πρέπει να είναι μετά ή ίδια με την ημερομηνία έναρξης.");

            var ownDoctorId = await GetOwnDoctorIdAsync();
            if (ownDoctorId is null) return Forbid();

            var leave = new LeaveRequest
            {
                DoctorId = ownDoctorId.Value,
                StartDate = request.StartDate,
                EndDate = request.EndDate,
                Reason = request.Reason,
                Status = "Pending"
            };
            _db.LeaveRequests.Add(leave);
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Create", "LeaveRequest", leave.LeaveRequestId.ToString(), after: request);

            return Ok(leave.LeaveRequestId);
        }

        [HttpPut("{id:guid}/Review")]
        [Authorize(Roles = "Admin,SuperUser,ClinicManager")]
        public async Task<IActionResult> Review(Guid id, LeaveRequestReviewRequest request)
        {
            var leave = await _db.LeaveRequests.FirstOrDefaultAsync(l => l.LeaveRequestId == id);
            if (leave is null) return NotFound();
            if (leave.Status != "Pending") return BadRequest("Το αίτημα έχει ήδη αξιολογηθεί.");

            var before = new { leave.Status };
            leave.Status = request.Approve ? "Approved" : "Rejected";
            leave.ReviewedByUserId = User.GetUserId();
            leave.ReviewedAt = DateTimeOffset.Now;
            leave.ReviewNote = request.ReviewNote;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Review", "LeaveRequest", id.ToString(), before, new { leave.Status, request.ReviewNote });

            return NoContent();
        }

        [HttpPut("{id:guid}/Cancel")]
        [Authorize(Roles = "Doctor")]
        public async Task<IActionResult> Cancel(Guid id)
        {
            var ownDoctorId = await GetOwnDoctorIdAsync();
            var leave = await _db.LeaveRequests.FirstOrDefaultAsync(l => l.LeaveRequestId == id);
            if (leave is null) return NotFound();
            if (leave.DoctorId != ownDoctorId) return Forbid();
            if (leave.Status != "Pending") return BadRequest("Μόνο εκκρεμή αιτήματα μπορούν να ακυρωθούν.");

            leave.Status = "Cancelled";
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Cancel", "LeaveRequest", id.ToString());

            return NoContent();
        }

        private bool IsReviewer() => User.IsInRole("Admin") || User.IsInRole("SuperUser") || User.IsInRole("ClinicManager");

        private async Task<Guid?> GetOwnDoctorIdAsync()
        {
            var userId = User.GetUserId();
            return await _db.Doctors.Where(d => d.UserId == userId).Select(d => (Guid?)d.DoctorId).FirstOrDefaultAsync();
        }
    }
}
