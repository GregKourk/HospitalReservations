/* ============================================================================
   System Settings: business hours / holidays / cancellation & reschedule
   policies / notification templates. Three small tables rather than one
   giant one, because Holidays and NotificationTemplates are real record
   lists (need their own CRUD + ids), while the hours/policy values are
   scalar knobs that fit a generic key-value table.

   Run after 011_audit_log_menu.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SystemSettings' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.SystemSettings (
        SettingKey      NVARCHAR(100)      NOT NULL,
        SettingValue    NVARCHAR(MAX)      NULL,
        Description     NVARCHAR(300)      NULL,
        UpdatedAt       DATETIMEOFFSET(3)  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedByUserId UNIQUEIDENTIFIER   NULL,
        CONSTRAINT PK_SystemSettings PRIMARY KEY CLUSTERED (SettingKey)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Holidays' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Holidays (
        HolidayId    UNIQUEIDENTIFIER   NOT NULL DEFAULT NEWID(),
        HolidayDate  DATE               NOT NULL,
        Name         NVARCHAR(200)      NOT NULL,
        IsActive     BIT                NOT NULL DEFAULT 1,
        CreatedAt    DATETIMEOFFSET(3)  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_Holidays PRIMARY KEY CLUSTERED (HolidayId)
    );
    CREATE UNIQUE INDEX UQ_Holidays_Date ON dbo.Holidays(HolidayDate);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'NotificationTemplates' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.NotificationTemplates (
        TemplateId   UNIQUEIDENTIFIER   NOT NULL DEFAULT NEWID(),
        Code         NVARCHAR(50)       NOT NULL,
        Name         NVARCHAR(200)      NOT NULL,
        Subject      NVARCHAR(300)      NOT NULL,
        Body         NVARCHAR(MAX)      NOT NULL,
        IsActive     BIT                NOT NULL DEFAULT 1,
        UpdatedAt    DATETIMEOFFSET(3)  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_NotificationTemplates PRIMARY KEY CLUSTERED (TemplateId)
    );
    CREATE UNIQUE INDEX UQ_NotificationTemplates_Code ON dbo.NotificationTemplates(Code);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE SettingKey = 'BusinessHoursStart')
INSERT INTO dbo.SystemSettings (SettingKey, SettingValue, Description) VALUES
    ('BusinessHoursStart', '08:00', N'Νωρίτερη επιτρεπόμενη ώρα έναρξης προγράμματος γιατρού'),
    ('BusinessHoursEnd', '20:00', N'Αργότερη επιτρεπόμενη ώρα λήξης προγράμματος γιατρού'),
    ('CancellationMinHours', '2', N'Ελάχιστες ώρες πριν το ραντεβού για ακύρωση (δεν ισχύει για Admin/SuperUser)'),
    ('RescheduleMinHours', '2', N'Ελάχιστες ώρες πριν το ραντεβού για αλλαγή ώρας (δεν ισχύει για Admin/SuperUser)');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.NotificationTemplates WHERE Code = 'AppointmentConfirmed')
INSERT INTO dbo.NotificationTemplates (Code, Name, Subject, Body) VALUES
    ('AppointmentConfirmed', N'Επιβεβαίωση ραντεβού', N'Το ραντεβού σας επιβεβαιώθηκε',
        N'Γεια σας {PatientName}, το ραντεβού σας με {DoctorName} στις {AppointmentDateTime} επιβεβαιώθηκε.'),
    ('AppointmentCancelled', N'Ακύρωση ραντεβού', N'Το ραντεβού σας ακυρώθηκε',
        N'Γεια σας {PatientName}, το ραντεβού σας με {DoctorName} στις {AppointmentDateTime} ακυρώθηκε. Αιτία: {Reason}'),
    ('AppointmentRescheduled', N'Αλλαγή ώρας ραντεβού', N'Το ραντεβού σας μετατέθηκε',
        N'Γεια σας {PatientName}, το ραντεβού σας με {DoctorName} μετατέθηκε στις {AppointmentDateTime}.'),
    ('AppointmentReminder', N'Υπενθύμιση ραντεβού', N'Υπενθύμιση ραντεβού',
        N'Γεια σας {PatientName}, υπενθυμίζουμε το ραντεβού σας με {DoctorName} στις {AppointmentDateTime}.'),
    ('AppointmentNoShow', N'Μη προσέλευση', N'Καταγραφή μη προσέλευσης',
        N'Ο ασθενής {PatientName} δεν προσήλθε στο ραντεβού με {DoctorName} στις {AppointmentDateTime}.');
GO
