/* ============================================================================
   Menu entries for the next batch of top-level items:
     - Πίνακας Ελέγχου (Dashboard)  — Admin/SuperUser only for now
     - Αναφορές (Reports)          — Admin/SuperUser only for now
     - Ειδοποιήσεις (Notifications) — every role (IsForAllUser)
     - Ο Λογαριασμός μου (My Account) — every role (IsForAllUser)

   "Ραντεβού (σφαιρική εποπτεία)" already exists (006_appointments_menu.sql)
   — no new entry needed for it.

   Run after 014_holidays_recurring.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'Dashboard')
BEGIN
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);
    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, NULL, 'Dashboard', 'Dashboard', '/admin/dashboard', '/admin/dashboard', N'Πίνακας Ελέγχου', 'dashboard', 0, 0, NULL, 1, 1, 5, 0, 0, 0);
    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT @NewId, r.RoleId FROM dbo.Roles r WHERE r.Name IN ('Admin', 'SuperUser');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'Reports')
BEGIN
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);
    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, NULL, 'Reports', 'Reports', '/admin/reports', '/admin/reports', N'Αναφορές', 'forms', 0, 0, NULL, 1, 1, 25, 0, 0, 0);
    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT @NewId, r.RoleId FROM dbo.Roles r WHERE r.Name IN ('Admin', 'SuperUser');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'Notifications')
BEGIN
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);
    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, NULL, 'Notifications', 'Notifications', '/admin/notifications', '/admin/notifications', N'Ειδοποιήσεις', 'bell', 0, 0, NULL, 1, 1, 30, 0, 0, 1);
    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'MyAccount')
BEGIN
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);
    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, NULL, 'MyAccount', 'MyAccount', '/admin/my-account', '/admin/my-account', N'Ο Λογαριασμός μου', 'users', 0, 0, NULL, 1, 1, 999, 0, 0, 1);
    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;
END
GO
