/* ============================================================================
   Reception role completion:
     - Grants Reception access to the existing "Dashboard" menu item — the
       page itself now renders a role-aware view (Admin/SuperUser get the
       system-wide dashboard, everyone else gets a daily front-desk view).
     - New "Ημερολόγιο" (Calendar) menu item — visual weekly/day scheduler
       grouped by doctor, per clinic. Granted to Reception, ClinicManager,
       Doctor, SuperUser (Admin bypasses via MenuBuilder).

   Run after 015_dashboard_reports_notifications_menu.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (
    SELECT 1 FROM dbo.LoginApplicationFormRights fr
    JOIN dbo.LoginApplicationForms f ON f.Id = fr.ApplicationFormId
    JOIN dbo.Roles r ON r.RoleId = fr.RoleId
    WHERE f.RouteElement = 'Dashboard' AND r.Name = 'Reception'
)
BEGIN
    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT f.Id, r.RoleId
    FROM dbo.LoginApplicationForms f, dbo.Roles r
    WHERE f.RouteElement = 'Dashboard' AND r.Name = 'Reception';
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'Calendar')
BEGIN
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);
    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, NULL, 'Calendar', 'Calendar', '/admin/calendar', '/admin/calendar', N'Ημερολόγιο', 'calendar', 0, 0, NULL, 1, 1, 17, 0, 0, 0);
    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT @NewId, r.RoleId FROM dbo.Roles r WHERE r.Name IN ('SuperUser', 'ClinicManager', 'Reception', 'Doctor');
END
GO
