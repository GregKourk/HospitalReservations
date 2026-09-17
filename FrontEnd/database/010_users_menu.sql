/* ============================================================================
   Menu entry for staff account provisioning + role assignment
   (src/pages/AppPages/users.tsx) — nested under "Διαχείριση". Admin/SuperUser
   only: this is the only place a Reception/ClinicManager/Admin/SuperUser
   account gets its role, since self-service Gov.gr sign-in only ever grants
   Patient (see AuthController.GovGrComplete).

   Run after 009_doctors_amka.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'Users')
BEGIN
    DECLARE @AdminParentId BIGINT = (SELECT Id FROM dbo.LoginApplicationForms WHERE RouteElement IS NULL AND NavHasChildren = 1);
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);

    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;

    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, @AdminParentId, 'Users', 'Users', '/admin/users', '/admin/users', N'Ρόλοι & Χρήστες', 'users', 0, 0, NULL, 1, 1, 40, 0, 0, 0);

    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT @NewId, r.RoleId
    FROM dbo.Roles r
    WHERE r.Name IN ('Admin', 'SuperUser');
END
GO
