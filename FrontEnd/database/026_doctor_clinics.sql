/* ============================================================================
   Β1 — a doctor can work at more than one branch.

   New table dbo.DoctorClinics (DoctorId, ClinicId): every branch a doctor
   works at. Doctors.ClinicId stays as the doctor's main ("κύριο") branch and
   is always one of the DoctorClinics rows — the API keeps them in sync.
   Every list that asks "which doctors work at branch X" (lookups, booking,
   doctor admin, dashboard, reports) now goes through DoctorClinics.

   Schedules already carry their own ClinicId (DoctorSchedules.ClinicId), so
   a doctor's weekly program is set per branch with no schema change; the API
   now rejects a schedule at a branch the doctor doesn't work at, and one that
   overlaps the same doctor's schedule at another branch.

   Β3 (a ClinicManager over several branches) needs no schema change:
   Clinics.ManagerUserId already allows the same user on several clinics; only
   the API used to read just the first one.

   Idempotent — safe to re-run.

   Run after 025_shared_specialties.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.DoctorClinics', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DoctorClinics (
        DoctorId    UNIQUEIDENTIFIER   NOT NULL,
        ClinicId    UNIQUEIDENTIFIER   NOT NULL,
        CreatedAt   DATETIMEOFFSET(3)  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_DoctorClinics PRIMARY KEY CLUSTERED (DoctorId, ClinicId),
        CONSTRAINT FK_DoctorClinics_Doctor FOREIGN KEY (DoctorId) REFERENCES dbo.Doctors(DoctorId),
        CONSTRAINT FK_DoctorClinics_Clinic FOREIGN KEY (ClinicId) REFERENCES dbo.Clinics(ClinicId)
    );
    CREATE INDEX IX_DoctorClinics_ClinicId ON dbo.DoctorClinics(ClinicId);
END
GO

-- Every doctor works at least at their main branch.
INSERT INTO dbo.DoctorClinics (DoctorId, ClinicId)
SELECT d.DoctorId, d.ClinicId
FROM dbo.Doctors d
WHERE NOT EXISTS (SELECT 1 FROM dbo.DoctorClinics dc WHERE dc.DoctorId = d.DoctorId AND dc.ClinicId = d.ClinicId);
GO

-- A doctor who already has schedules at another branch works there too.
INSERT INTO dbo.DoctorClinics (DoctorId, ClinicId)
SELECT DISTINCT s.DoctorId, s.ClinicId
FROM dbo.DoctorSchedules s
WHERE s.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.DoctorClinics dc WHERE dc.DoctorId = s.DoctorId AND dc.ClinicId = s.ClinicId);
GO
