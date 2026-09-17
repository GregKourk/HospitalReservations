using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // Doctors/{id}/Availability checks this before computing any slots — a
    // holiday zeroes out availability for every doctor that day regardless
    // of their own weekly DoctorSchedules.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize(Roles = "Admin,SuperUser")]
    public class HolidaysController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public HolidaysController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<HolidayDto>>> GetAll([FromQuery] bool includeInactive = false)
        {
            var query = _db.Holidays.AsQueryable();
            if (!includeInactive) query = query.Where(h => h.IsActive);

            var holidays = await query
                .OrderBy(h => h.HolidayDate)
                .Select(h => new HolidayDto { HolidayId = h.HolidayId, HolidayDate = h.HolidayDate, Name = h.Name, IsActive = h.IsActive, IsRecurringAnnual = h.IsRecurringAnnual })
                .ToListAsync();

            return Ok(holidays);
        }

        [HttpPost]
        public async Task<ActionResult<Guid>> Create(HolidayUpsertRequest request)
        {
            var holiday = new Holiday { HolidayDate = request.HolidayDate, Name = request.Name, IsActive = request.IsActive, IsRecurringAnnual = request.IsRecurringAnnual };
            _db.Holidays.Add(holiday);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException)
            {
                return Conflict("Υπάρχει ήδη αργία καταχωρημένη για αυτή την ημερομηνία.");
            }

            await AuditLogger.LogAsync(_db, HttpContext, "Create", "Holiday", holiday.HolidayId.ToString(), after: request);

            return Ok(holiday.HolidayId);
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, HolidayUpsertRequest request)
        {
            var holiday = await _db.Holidays.FirstOrDefaultAsync(h => h.HolidayId == id);
            if (holiday is null) return NotFound();

            var before = new { holiday.HolidayDate, holiday.Name, holiday.IsActive, holiday.IsRecurringAnnual };
            holiday.HolidayDate = request.HolidayDate;
            holiday.Name = request.Name;
            holiday.IsActive = request.IsActive;
            holiday.IsRecurringAnnual = request.IsRecurringAnnual;

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException)
            {
                return Conflict("Υπάρχει ήδη αργία καταχωρημένη για αυτή την ημερομηνία.");
            }

            await AuditLogger.LogAsync(_db, HttpContext, "Update", "Holiday", id.ToString(), before, request);

            return NoContent();
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var holiday = await _db.Holidays.FirstOrDefaultAsync(h => h.HolidayId == id);
            if (holiday is null) return NotFound();

            _db.Holidays.Remove(holiday);
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Delete", "Holiday", id.ToString());

            return NoContent();
        }
    }
}
