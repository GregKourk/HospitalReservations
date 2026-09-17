/* ============================================================================
   Menu seed data — LoginApplicationForms (the nav/route tree) and
   LoginApplicationFormRights (which roles see which form).

   Admin is never granted explicitly here — .../Helpers/MenuBuilder.cs gives
   Admin every visible form unconditionally, so a row for Admin would just be
   dead data. "Ρεσεψιόν" is the only form with a real frontend page today
   (src/pages/AppPages/reception.tsx); the four under "Διαχείριση" describe
   the intended admin screens and will 404 until those pages exist — the menu
   and rights model is what's being delivered now, not those screens.

   Run after 003_menu_role_rights.sql.
   ============================================================================ */

SET IDENTITY_INSERT dbo.LoginApplicationForms ON;

-- N'...' is required on every Greek literal — a plain '...' string gets read
-- through the connection's non-Unicode codepage and silently mangles the text.
INSERT INTO dbo.LoginApplicationForms
    (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
VALUES
    (1, NULL, 'Reception',    'Reception',    '/reception',        '/reception',        N'Ρεσεψιόν',  'calendar',    0, 0, NULL, 1, 1, 10, 0, 0, 0),
    (2, NULL, 'Administration', NULL,         NULL,                NULL,                N'Διαχείριση', 'settings',   0, 1, NULL, 1, 1, 20, 0, 0, 0),
    (3, 2,    'Clinics',      'Clinics',      '/admin/clinics',    '/admin/clinics',    N'Κλινικές',  'building',    0, 0, NULL, 1, 1, 10, 0, 0, 0),
    (4, 2,    'Departments',  'Departments',  '/admin/departments','/admin/departments',N'Τμήματα',   'layers',      0, 0, NULL, 1, 1, 20, 0, 0, 0),
    (5, 2,    'Doctors',      'Doctors',      '/admin/doctors',    '/admin/doctors',    N'Γιατροί',   'stethoscope', 0, 0, NULL, 1, 1, 30, 0, 0, 0),
    (6, 2,    'Patients',     'Patients',     '/admin/patients',   '/admin/patients',   N'Ασθενείς',  'users',       0, 0, NULL, 1, 1, 40, 0, 0, 0);

SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;
GO

-- Grants mirror each admin screen's actual API authorization
-- (ClinicsController/DepartmentsController/DoctorsController/PatientsController)
-- so a role never sees a menu item for an action the API would refuse anyway.
INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
SELECT f.Id, r.RoleId
FROM (VALUES
    (1, 'SuperUser'),      -- Reception
    (1, 'ClinicManager'),
    (1, 'Reception'),
    (3, 'SuperUser'),      -- Clinics — matches ClinicsController.Create/Delete
    (4, 'SuperUser'),      -- Departments
    (4, 'ClinicManager'),
    (5, 'SuperUser'),      -- Doctors
    (5, 'ClinicManager'),
    (6, 'SuperUser'),      -- Patients
    (6, 'ClinicManager'),
    (6, 'Reception'),
    (6, 'Doctor')
) AS grant_(FormId, RoleName)
JOIN dbo.LoginApplicationForms f ON f.Id = grant_.FormId
JOIN dbo.Roles r ON r.Name = grant_.RoleName;
GO
