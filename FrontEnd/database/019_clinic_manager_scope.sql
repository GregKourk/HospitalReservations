/* ============================================================================
   ClinicManager role completion: "scope: δική του" — a ClinicManager needs
   to be tied to exactly one Clinic so every screen can be narrowed to it.
   Adds Clinics.ManagerUserId (nullable — most clinics won't have one set
   immediately, and a clinic with no manager just means no ClinicManager
   sees it yet).

   Run after 018_doctor_role_menu.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clinics') AND name = 'ManagerUserId')
BEGIN
    ALTER TABLE dbo.Clinics ADD ManagerUserId UNIQUEIDENTIFIER NULL;
    ALTER TABLE dbo.Clinics ADD CONSTRAINT FK_Clinics_ManagerUser FOREIGN KEY (ManagerUserId) REFERENCES dbo.Users(UserId);
END
GO
