/* ============================================================================
   Two independent additions:

   1) Appointment reminders — the "AppointmentReminder" template was seeded
      back in 012_system_settings.sql but nothing ever sent it. Adds
      Appointments.ReminderSentAt (dedupe flag) and a ReminderLeadHours
      policy knob; AppointmentReminderService (a BackgroundService) polls
      for due appointments and fires the template through the same
      NotificationHelper path everything else already uses.

   2) Patient waitlist — "Νέο Ραντεβού" self-service booking has no fallback
      when a doctor has no open slot on the chosen date. A patient can now
      join a waitlist for that doctor/date; when an appointment there gets
      cancelled, every waiting entry is notified (see
      AppointmentsController.NotifyWaitlistAsync).

   Run after 022_appointment_created_notification.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Appointments') AND name = 'ReminderSentAt')
    ALTER TABLE dbo.Appointments ADD ReminderSentAt DATETIMEOFFSET NULL;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE SettingKey = 'ReminderLeadHours')
INSERT INTO dbo.SystemSettings (SettingKey, SettingValue, Description) VALUES
    ('ReminderLeadHours', '24', N'Πόσες ώρες πριν το ραντεβού αποστέλλεται η υπενθύμιση στον ασθενή.');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.NotificationTemplates WHERE Code = 'WaitlistSlotAvailable')
INSERT INTO dbo.NotificationTemplates (Code, Name, Subject, Body) VALUES
    ('WaitlistSlotAvailable', N'Ελεύθερη θέση (λίστα αναμονής)', N'Ελευθερώθηκε ραντεβού',
        N'Γεια σας {PatientName}, ελευθερώθηκε ραντεβού με τον/την {DoctorName} στις {PreferredDate}. Κάντε κράτηση όσο πιο σύντομα γίνεται, όσο υπάρχει ακόμα διαθεσιμότητα.');
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AppointmentWaitlist' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.AppointmentWaitlist (
        WaitlistId    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        PatientId     UNIQUEIDENTIFIER NOT NULL,
        ClinicId      UNIQUEIDENTIFIER NOT NULL,
        DepartmentId  UNIQUEIDENTIFIER NOT NULL,
        DoctorId      UNIQUEIDENTIFIER NOT NULL,
        PreferredDate DATE             NOT NULL,
        Reason        NVARCHAR(300)    NULL,
        Status        NVARCHAR(20)     NOT NULL DEFAULT 'Waiting',
        CreatedAt     DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt     DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT PK_AppointmentWaitlist PRIMARY KEY CLUSTERED (WaitlistId),
        CONSTRAINT FK_AppointmentWaitlist_Patient FOREIGN KEY (PatientId) REFERENCES dbo.Patients(PatientId),
        CONSTRAINT FK_AppointmentWaitlist_Clinic FOREIGN KEY (ClinicId) REFERENCES dbo.Clinics(ClinicId),
        CONSTRAINT FK_AppointmentWaitlist_Department FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(DepartmentId),
        CONSTRAINT FK_AppointmentWaitlist_Doctor FOREIGN KEY (DoctorId) REFERENCES dbo.Doctors(DoctorId),
        CONSTRAINT CK_AppointmentWaitlist_Status CHECK (Status IN ('Waiting', 'Notified', 'Booked', 'Cancelled'))
    );
    CREATE INDEX IX_AppointmentWaitlist_Doctor_Date_Status ON dbo.AppointmentWaitlist(DoctorId, PreferredDate, Status);
    CREATE INDEX IX_AppointmentWaitlist_PatientId ON dbo.AppointmentWaitlist(PatientId);
END
GO
