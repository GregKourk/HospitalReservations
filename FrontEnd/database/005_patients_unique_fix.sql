/* ============================================================================
   Fix: UQ_Patients_User and UQ_Patients_AMKA were plain UNIQUE constraints on
   nullable columns. SQL Server treats NULL as a comparable value for a plain
   UNIQUE constraint, so it allows at most ONE NULL total across the whole
   table — the second patient ever created without a linked User (or without
   an AMKA) fails with "Cannot insert duplicate key ... (<NULL>)". Most
   patients (walk-in/admin-registered, not self-service via gov.gr) will have
   neither, so this broke almost immediately. Replaced with filtered unique
   indexes, same pattern already used for Users.UQ_Users_ExternalIdentity.

   Run after 004_menu_seed.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UQ_Patients_User' AND type = 'UQ')
    ALTER TABLE dbo.Patients DROP CONSTRAINT UQ_Patients_User;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Patients_User' AND object_id = OBJECT_ID('dbo.Patients'))
    CREATE UNIQUE INDEX UQ_Patients_User ON dbo.Patients(UserId) WHERE UserId IS NOT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UQ_Patients_AMKA' AND type = 'UQ')
    ALTER TABLE dbo.Patients DROP CONSTRAINT UQ_Patients_AMKA;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Patients_AMKA' AND object_id = OBJECT_ID('dbo.Patients'))
    CREATE UNIQUE INDEX UQ_Patients_AMKA ON dbo.Patients(AMKA) WHERE AMKA IS NOT NULL;
GO
