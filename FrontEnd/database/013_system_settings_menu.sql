/* ============================================================================
   Menu entry for System Settings (src/pages/AppPages/system-settings.tsx) —
   business hours, holidays, cancellation/reschedule policies, notification
   templates. Nested under "Διαχείριση", Admin/SuperUser only (matches
   SystemSettingsController/HolidaysController/NotificationTemplatesController's
   [Authorize(Roles = "Admin,SuperUser")]).

   Run after 012_system_settings.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'SystemSettings')
BEGIN
    DECLARE @AdminParentId BIGINT = (SELECT Id FROM dbo.LoginApplicationForms WHERE RouteElement IS NULL AND NavHasChildren = 1);
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);

    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;

    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, @AdminParentId, 'SystemSettings', 'SystemSettings', '/admin/system-settings', '/admin/system-settings', N'Ρυθμίσεις Συστήματος', 'settings', 0, 0, NULL, 1, 1, 50, 0, 0, 0);

    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT @NewId, r.RoleId
    FROM dbo.Roles r
    WHERE r.Name IN ('Admin', 'SuperUser');
END
GO
