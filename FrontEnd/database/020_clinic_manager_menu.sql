/* ============================================================================
   Grants ClinicManager access to the three menu forms it was missing:
     - Clinics (Id 3)    — "Κλινικές (scope: δική του)"
     - Dashboard (Id 12) — "Πίνακας Ελέγχου (KPIs κλινικής)"
     - Reports (Id 13)   — "Αναφορές" (Πληρότητα Γιατρών / Ακυρώσεις-No-shows / Export)

   ClinicManager already had Reception, Appointments, Calendar, LeaveRequests,
   Departments, Doctors, Schedules, Patients from earlier migrations — this
   closes the remaining menu gap for the role.

   Run after 019_clinic_manager_scope.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

INSERT INTO dbo.LoginApplicationFormRights (ApplicationFormId, RoleId)
SELECT f.Id, r.RoleId
FROM dbo.LoginApplicationForms f
CROSS JOIN dbo.Roles r
WHERE f.Id IN (3, 12, 13)
  AND r.Name = 'ClinicManager'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.LoginApplicationFormRights fr
      WHERE fr.ApplicationFormId = f.Id AND fr.RoleId = r.RoleId
  );
GO
