/* ============================================================================
   Menu entry for Doctor Schedules (src/pages/AppPages/schedules.tsx) — nested
   under "Διαχείριση" next to "Γιατροί" (it's master data for a doctor, same
   as Departments/Doctors). Granted to SuperUser/ClinicManager (manage any
   doctor's schedule) and Doctor (self-service, own schedule only — enforced
   server-side in DoctorSchedulesController). Admin bypasses per MenuBuilder.

   Run after 007_appointment_statuses_greek.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'Schedules')
BEGIN
    DECLARE @AdminParentId BIGINT = (SELECT Id FROM dbo.LoginApplicationForms WHERE RouteElement IS NULL AND NavHasChildren = 1);
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);

    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;

    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, @AdminParentId, 'Schedules', 'Schedules', '/admin/schedules', '/admin/schedules', N'Πρόγραμμα Γιατρών', 'calendar', 0, 0, NULL, 1, 1, 35, 0, 0, 0);

    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT @NewId, r.RoleId
    FROM dbo.Roles r
    WHERE r.Name IN ('SuperUser', 'ClinicManager', 'Doctor');
END
GO
