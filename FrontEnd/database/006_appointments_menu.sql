/* ============================================================================
   Menu entry for the full Appointments management screen
   (src/pages/AppPages/appointments.tsx) — top-level, sibling to "Ρεσεψιόν",
   not nested under "Διαχείριση" (that group is for the Clinic/Department/
   Doctor/Patient master-data CRUD screens; appointments is a workflow, not
   master data). Doctor is granted here (their own schedule, not just
   "today" like Reception) — Reception/ClinicManager/SuperUser get the full
   view; Admin bypasses per MenuBuilder.

   Run after 005_patients_unique_fix.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'Appointments')
BEGIN
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);

    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;

    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, NULL, 'Appointments', 'Appointments', '/admin/appointments', '/admin/appointments', N'Ραντεβού', 'calendar', 0, 0, NULL, 1, 1, 15, 0, 0, 0);

    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT @NewId, r.RoleId
    FROM dbo.Roles r
    WHERE r.Name IN ('SuperUser', 'ClinicManager', 'Reception', 'Doctor');
END
GO
