/* ============================================================================
   Menu + demo-data for the Patient role's self-service screens:
     - Αρχική (home)
     - Τα Ραντεβού μου (group) → Νέο Ραντεβού / Επερχόμενα / Ιστορικό
     - Το Προφίλ μου (group) → Προσωπικά Στοιχεία
     - Ειδοποιήσεις / Ρυθμίσεις Λογαριασμού already exist as IsForAllUser
       (Notifications, MyAccount — 015_dashboard_reports_notifications_menu.sql)

   Also repairs the demo.patient@mock.local account, which predates the
   code that now provisions a Patient login fully (see
   AuthController.MockLogin/GovGrComplete) and was left with two gaps:
     - no linked Patients row (every *real* login path creates one)
     - no UserRoles row at all, so its JWT carried zero role claims and
       every [Authorize(Roles=...)] check on it — including this one — failed

   Run after 020_clinic_manager_menu.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles ur JOIN dbo.Users u ON u.UserId = ur.UserId WHERE u.Email = 'demo.patient@mock.local')
BEGIN
    INSERT INTO dbo.UserRoles (UserId, RoleId)
    SELECT u.UserId, r.RoleId
    FROM dbo.Users u
    JOIN dbo.Roles r ON r.Name = 'Patient'
    WHERE u.Email = 'demo.patient@mock.local';
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Patients p JOIN dbo.Users u ON u.UserId = p.UserId WHERE u.Email = 'demo.patient@mock.local')
BEGIN
    INSERT INTO dbo.Patients (PatientId, UserId, FirstName, LastName, DateOfBirth)
    SELECT NEWID(), u.UserId, N'Demo', N'Patient', '1990-01-01'
    FROM dbo.Users u
    WHERE u.Email = 'demo.patient@mock.local';
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'PatientHome')
BEGIN
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);
    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, NULL, 'PatientHome', 'PatientHome', '/patient/home', '/patient/home', N'Αρχική', 'home', 0, 0, NULL, 1, 1, 1, 0, 0, 0);
    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT @NewId, r.RoleId FROM dbo.Roles r WHERE r.Name = 'Patient';
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE Name = 'PatientMyAppointments')
BEGIN
    DECLARE @GroupId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);
    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@GroupId, NULL, 'PatientMyAppointments', NULL, NULL, NULL, N'Τα Ραντεβού μου', 'calendar', 0, 1, NULL, 1, 1, 5, 0, 0, 0);

    DECLARE @BookId BIGINT = @GroupId + 1;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@BookId, @GroupId, 'PatientBookAppointment', 'PatientBookAppointment', '/patient/book-appointment', '/patient/book-appointment', N'Νέο Ραντεβού', 'calendar-plus', 0, 0, NULL, 1, 1, 10, 0, 0, 0);

    DECLARE @UpcomingId BIGINT = @GroupId + 2;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@UpcomingId, @GroupId, 'PatientAppointmentsUpcoming', 'PatientAppointmentsUpcoming', '/patient/appointments/upcoming', '/patient/appointments/upcoming', N'Επερχόμενα', 'calendar-clock', 0, 0, NULL, 1, 1, 20, 0, 0, 0);

    DECLARE @HistoryId BIGINT = @GroupId + 3;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@HistoryId, @GroupId, 'PatientAppointmentsHistory', 'PatientAppointmentsHistory', '/patient/appointments/history', '/patient/appointments/history', N'Ιστορικό', 'history', 0, 0, NULL, 1, 1, 30, 0, 0, 0);
    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT f.Id, r.RoleId
    FROM dbo.LoginApplicationForms f
    CROSS JOIN dbo.Roles r
    WHERE f.Id IN (@BookId, @UpcomingId, @HistoryId) AND r.Name = 'Patient';
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE Name = 'PatientMyProfile')
BEGIN
    DECLARE @GroupId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);
    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@GroupId, NULL, 'PatientMyProfile', NULL, NULL, NULL, N'Το Προφίλ μου', 'user', 0, 1, NULL, 1, 1, 40, 0, 0, 0);

    DECLARE @ProfileId BIGINT = @GroupId + 1;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@ProfileId, @GroupId, 'PatientProfile', 'PatientProfile', '/patient/profile', '/patient/profile', N'Προσωπικά Στοιχεία', 'id-card', 0, 0, NULL, 1, 1, 10, 0, 0, 0);
    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT @ProfileId, r.RoleId FROM dbo.Roles r WHERE r.Name = 'Patient';
END
GO
