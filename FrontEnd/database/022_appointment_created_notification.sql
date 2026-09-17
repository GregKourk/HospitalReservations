/* ============================================================================
   Booking a brand-new appointment never sent any notification — only
   Confirm/Cancel/NoShow/Reschedule did (AppointmentsController.Create only
   pushed a raw SignalR event to legacy doctor_/clinic_/patient_ groups, never
   through NotificationHelper, so nothing was ever persisted or delivered to
   the recipient's own "user_{id}" group). The Patient role's own outline
   ("Ειδοποιήσεις: νέο/ακύρωση/υπενθύμιση ραντεβού") explicitly expects a "νέο"
   (new) notification, so this adds the missing template.

   Run after 021_patient_menu.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.NotificationTemplates WHERE Code = 'AppointmentCreated')
INSERT INTO dbo.NotificationTemplates (Code, Name, Subject, Body) VALUES
    ('AppointmentCreated', N'Νέο ραντεβού', N'Το ραντεβού σας καταχωρήθηκε',
        N'Γεια σας {PatientName}, το ραντεβού σας με {DoctorName} στις {AppointmentDateTime} καταχωρήθηκε.');
GO
