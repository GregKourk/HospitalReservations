/* ============================================================================
   Polyclinic relabel — the business is a polyclinic with branches, not a
   hospital with clinics/departments. Only user-visible text changes here:
   table, column, route and role codes (Clinics, ClinicId, '/admin/clinics',
   'ClinicManager') stay as they are, since the backend and frontend key on
   them.

     - Menu: "Κλινικές" -> "Υποκαταστήματα", "Τμήματα" -> "Ειδικότητες"
     - Role description for ClinicManager (the Greek display name itself
       lives in the frontend, src/lib/role-labels.ts)

   Notification templates mention no clinic/department, so they're untouched.
   Idempotent — safe to re-run.

   Run after 023_reminders_and_waitlist.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

-- N'...' is required on every Greek literal (see 004_menu_seed.sql).
UPDATE dbo.LoginApplicationForms SET NavTitle = N'Υποκαταστήματα' WHERE Id = 3 AND Name = 'Clinics';
UPDATE dbo.LoginApplicationForms SET NavTitle = N'Ειδικότητες'    WHERE Id = 4 AND Name = 'Departments';
GO

UPDATE dbo.Roles
SET Description = N'Υπεύθυνος Υποκαταστήματος — διαχειρίζεται γιατρούς, ειδικότητες και προγράμματα του υποκαταστήματός του'
WHERE Name = 'ClinicManager';
GO
