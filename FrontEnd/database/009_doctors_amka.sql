/* ============================================================================
   Adds an optional AMKA column to Doctors, matching Patients.AMKA (char(11),
   nullable — not every doctor record will have it entered right away).
   Filtered unique index for the same reason as UQ_Patients_AMKA: AMKA
   identifies one real person, so two doctor records can't legitimately
   share one, but it's optional so a plain UNIQUE constraint (which allows
   only one NULL total) would break as soon as a second doctor is created
   without it.

   Run after 008_doctor_schedules_menu.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Doctors') AND name = 'AMKA')
    ALTER TABLE dbo.Doctors ADD AMKA CHAR(11) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Doctors_AMKA' AND object_id = OBJECT_ID('dbo.Doctors'))
    CREATE UNIQUE INDEX UQ_Doctors_AMKA ON dbo.Doctors(AMKA) WHERE AMKA IS NOT NULL;
GO
