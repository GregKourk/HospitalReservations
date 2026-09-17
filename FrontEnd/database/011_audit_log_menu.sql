/* ============================================================================
   Menu entry for the Audit & Security log viewer
   (src/pages/AppPages/audit-log.tsx) — nested under "Διαχείριση".
   Admin/SuperUser only: the underlying GET /Audit/Logs endpoint enforces the
   same restriction server-side regardless of what the menu shows.

   Run after 010_users_menu.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'AuditLog')
BEGIN
    DECLARE @AdminParentId BIGINT = (SELECT Id FROM dbo.LoginApplicationForms WHERE RouteElement IS NULL AND NavHasChildren = 1);
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);

    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;

    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, @AdminParentId, 'AuditLog', 'AuditLog', '/admin/audit-log', '/admin/audit-log', N'Audit & Ασφάλεια', 'shield', 0, 0, NULL, 1, 1, 45, 0, 0, 0);

    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT @NewId, r.RoleId
    FROM dbo.Roles r
    WHERE r.Name IN ('Admin', 'SuperUser');
END
GO
