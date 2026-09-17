/* ============================================================================
   Doctor role completion:
     - Grants Doctor access to the existing "Dashboard" menu item — the page
       now renders a Doctor-specific "σημερινό πρόγραμμα" view for Doctor
       (distinct from Reception's daily desk and Admin's system-wide view).
     - New "Διαθεσιμότητα / Άδειες" (LeaveRequests) menu item — a Doctor
       requests time off, ClinicManager/Admin/SuperUser approve/reject.
       Approving actually blocks that doctor's availability (see
       Helpers/LeaveHelper.cs), not just a paperwork trail.

   Run after 017_leave_requests.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (
    SELECT 1 FROM dbo.LoginApplicationFormRights fr
    JOIN dbo.LoginApplicationForms f ON f.Id = fr.ApplicationFormId
    JOIN dbo.Roles r ON r.RoleId = fr.RoleId
    WHERE f.RouteElement = 'Dashboard' AND r.Name = 'Doctor'
)
BEGIN
    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT f.Id, r.RoleId
    FROM dbo.LoginApplicationForms f, dbo.Roles r
    WHERE f.RouteElement = 'Dashboard' AND r.Name = 'Doctor';
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LoginApplicationForms WHERE RouteElement = 'LeaveRequests')
BEGIN
    DECLARE @NewId BIGINT = (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.LoginApplicationForms);
    SET IDENTITY_INSERT dbo.LoginApplicationForms ON;
    INSERT INTO dbo.LoginApplicationForms
        (Id, ParentId, Name, RouteElement, RouteCombPath, NavUrl, NavTitle, NavIcon, NavHasBullet, NavHasChildren, CanEdit, Visible, DevVisible, OrderValue, OnlyRoute, IsExternalLink, IsForAllUser)
    VALUES
        (@NewId, NULL, 'LeaveRequests', 'LeaveRequests', '/admin/leave-requests', '/admin/leave-requests', N'Διαθεσιμότητα / Άδειες', 'calendar', 0, 0, NULL, 1, 1, 19, 0, 0, 0);
    SET IDENTITY_INSERT dbo.LoginApplicationForms OFF;

    INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
    SELECT @NewId, r.RoleId FROM dbo.Roles r WHERE r.Name IN ('SuperUser', 'ClinicManager', 'Doctor');
END
GO
