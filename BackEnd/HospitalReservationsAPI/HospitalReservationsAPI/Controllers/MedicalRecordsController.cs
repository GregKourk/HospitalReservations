using HospitalReservationsAPI.Helpers;
using HospitalReservationsAPI.Model.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalReservationsAPI.Controllers
{
    // Clinical notes, not administrative data — deliberately narrower access
    // than Patients itself: a Doctor only ever sees/writes their OWN notes
    // on a patient (not another doctor's), and Reception/ClinicManager have
    // no access at all here even though they can see the patient record.
    // Admin/SuperUser can see everything for support/oversight.
    [ApiController]
    [Route("[controller]")]
    [EnableCors]
    [Authorize(Roles = "Doctor,Admin,SuperUser")]
    public class MedicalRecordsController : BaseApiController
    {
        private readonly HospitalReservationsContext _db;

        public MedicalRecordsController(HospitalReservationsContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<List<MedicalRecordDto>>> GetAll([FromQuery] Guid patientId)
        {
            var query = _db.MedicalRecords.Where(m => m.PatientId == patientId && !m.IsDeleted);

            if (!User.IsInRole("Admin") && !User.IsInRole("SuperUser"))
            {
                var ownDoctorId = await GetOwnDoctorIdAsync();
                query = query.Where(m => m.DoctorId == ownDoctorId);
            }

            var records = await query
                .OrderByDescending(m => m.CreatedAt)
                .Select(m => new MedicalRecordDto
                {
                    RecordId = m.RecordId,
                    PatientId = m.PatientId,
                    AppointmentId = m.AppointmentId,
                    DoctorId = m.DoctorId,
                    DoctorName = m.Doctor.User.FullName,
                    Notes = m.Notes,
                    CreatedAt = m.CreatedAt,
                    UpdatedAt = m.UpdatedAt
                })
                .ToListAsync();

            return Ok(records);
        }

        [HttpPost]
        [Authorize(Roles = "Doctor")]
        public async Task<ActionResult<Guid>> Create(MedicalRecordCreateRequest request)
        {
            var ownDoctorId = await GetOwnDoctorIdAsync();
            if (ownDoctorId is null) return Forbid();

            var record = new MedicalRecord
            {
                PatientId = request.PatientId,
                AppointmentId = request.AppointmentId,
                DoctorId = ownDoctorId.Value,
                Notes = request.Notes
            };
            _db.MedicalRecords.Add(record);
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Create", "MedicalRecord", record.RecordId.ToString(), after: new { request.PatientId, request.AppointmentId });

            return Ok(record.RecordId);
        }

        [HttpPut("{id:guid}")]
        [Authorize(Roles = "Doctor")]
        public async Task<IActionResult> Update(Guid id, MedicalRecordUpdateRequest request)
        {
            var ownDoctorId = await GetOwnDoctorIdAsync();
            var record = await _db.MedicalRecords.FirstOrDefaultAsync(m => m.RecordId == id && !m.IsDeleted);
            if (record is null) return NotFound();
            if (record.DoctorId != ownDoctorId) return Forbid();

            var before = new { record.Notes };
            record.Notes = request.Notes;
            record.UpdatedAt = DateTimeOffset.Now;
            await _db.SaveChangesAsync();

            await AuditLogger.LogAsync(_db, HttpContext, "Update", "MedicalRecord", id.ToString(), before, request);

            return NoContent();
        }

        private async Task<Guid?> GetOwnDoctorIdAsync()
        {
            var userId = User.GetUserId();
            return await _db.Doctors.Where(d => d.UserId == userId).Select(d => (Guid?)d.DoctorId).FirstOrDefaultAsync();
        }
    }
}
