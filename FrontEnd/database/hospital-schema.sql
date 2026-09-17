/* ============================================================================
   Hospital Reservation System — SQL Server schema
   Implements: .agent.database.md (Database Architect persona)
   Target: SQL Server 2019+ / Azure SQL
   ============================================================================ */

SET NOCOUNT ON;
GO

IF SCHEMA_ID('audit') IS NULL
    EXEC('CREATE SCHEMA audit AUTHORIZATION dbo');
GO

/* ----------------------------------------------------------------------------
   Identity & access: Roles, Permissions, Users
---------------------------------------------------------------------------- */

CREATE TABLE dbo.Roles (
    RoleId          INT IDENTITY(1,1)   NOT NULL,
    Name            NVARCHAR(50)        NOT NULL,
    Description     NVARCHAR(200)       NULL,
    CreatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_Roles PRIMARY KEY CLUSTERED (RoleId),
    CONSTRAINT UQ_Roles_Name UNIQUE (Name)
);
GO

CREATE TABLE dbo.Permissions (
    PermissionId    INT IDENTITY(1,1)   NOT NULL,
    Name            NVARCHAR(100)       NOT NULL,
    Description     NVARCHAR(200)       NULL,
    CONSTRAINT PK_Permissions PRIMARY KEY CLUSTERED (PermissionId),
    CONSTRAINT UQ_Permissions_Name UNIQUE (Name)
);
GO

CREATE TABLE dbo.RolePermissions (
    RoleId          INT NOT NULL,
    PermissionId    INT NOT NULL,
    CONSTRAINT PK_RolePermissions PRIMARY KEY CLUSTERED (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId) ON DELETE CASCADE,
    CONSTRAINT FK_RolePermissions_Permission FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions(PermissionId) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Users (
    UserId              UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    Email               NVARCHAR(256)       NOT NULL,
    FullName            NVARCHAR(200)       NOT NULL,
    ExternalProvider    NVARCHAR(50)        NULL,   -- e.g. 'GovGr'
    ExternalSubjectId   NVARCHAR(200)       NULL,   -- external OIDC 'sub' claim
    IsActive            BIT                 NOT NULL DEFAULT 1,
    IsDeleted           BIT                 NOT NULL DEFAULT 0,
    CreatedAt           DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt           DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    DeletedAt           DATETIMEOFFSET(3)   NULL,
    CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (UserId),
    CONSTRAINT UQ_Users_Email UNIQUE (Email)
);
GO
CREATE UNIQUE INDEX UQ_Users_ExternalIdentity ON dbo.Users(ExternalProvider, ExternalSubjectId)
    WHERE ExternalProvider IS NOT NULL AND ExternalSubjectId IS NOT NULL;
GO

CREATE TABLE dbo.UserRoles (
    UserId              UNIQUEIDENTIFIER    NOT NULL,
    RoleId              INT                 NOT NULL,
    AssignedAt          DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    AssignedByUserId    UNIQUEIDENTIFIER    NULL,
    CONSTRAINT PK_UserRoles PRIMARY KEY CLUSTERED (UserId, RoleId),
    CONSTRAINT FK_UserRoles_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_AssignedBy FOREIGN KEY (AssignedByUserId) REFERENCES dbo.Users(UserId)
);
GO

/* ----------------------------------------------------------------------------
   Clinical domain: Clinics, Departments, Doctors, DoctorSchedules, Patients
---------------------------------------------------------------------------- */

CREATE TABLE dbo.Clinics (
    ClinicId        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    Name            NVARCHAR(200)       NOT NULL,
    Address         NVARCHAR(300)       NULL,
    Phone           NVARCHAR(30)        NULL,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    IsDeleted       BIT                 NOT NULL DEFAULT 0,
    CreatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    DeletedAt       DATETIMEOFFSET(3)   NULL,
    CONSTRAINT PK_Clinics PRIMARY KEY CLUSTERED (ClinicId)
);
GO

CREATE TABLE dbo.Departments (
    DepartmentId    UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    ClinicId        UNIQUEIDENTIFIER    NOT NULL,
    Name            NVARCHAR(150)       NOT NULL,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    CreatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_Departments PRIMARY KEY CLUSTERED (DepartmentId),
    CONSTRAINT FK_Departments_Clinic FOREIGN KEY (ClinicId) REFERENCES dbo.Clinics(ClinicId),
    CONSTRAINT UQ_Departments_Clinic_Name UNIQUE (ClinicId, Name)
);
GO
CREATE INDEX IX_Departments_ClinicId ON dbo.Departments(ClinicId);
GO

CREATE TABLE dbo.Doctors (
    DoctorId        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    ClinicId        UNIQUEIDENTIFIER    NOT NULL,
    DepartmentId    UNIQUEIDENTIFIER    NOT NULL,
    Specialty       NVARCHAR(150)       NOT NULL,
    LicenseNumber   NVARCHAR(50)        NOT NULL,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    IsDeleted       BIT                 NOT NULL DEFAULT 0,
    CreatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    DeletedAt       DATETIMEOFFSET(3)   NULL,
    CONSTRAINT PK_Doctors PRIMARY KEY CLUSTERED (DoctorId),
    CONSTRAINT FK_Doctors_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Doctors_Clinic FOREIGN KEY (ClinicId) REFERENCES dbo.Clinics(ClinicId),
    CONSTRAINT FK_Doctors_Department FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(DepartmentId),
    CONSTRAINT UQ_Doctors_User UNIQUE (UserId),
    CONSTRAINT UQ_Doctors_LicenseNumber UNIQUE (LicenseNumber)
);
GO
CREATE INDEX IX_Doctors_ClinicId ON dbo.Doctors(ClinicId);
CREATE INDEX IX_Doctors_DepartmentId ON dbo.Doctors(DepartmentId);
GO

-- Recurring weekly availability template. The hard no-overlap rule that matters
-- for booking correctness is enforced on dbo.Appointments (see trigger below);
-- this table only needs to stop the same doctor from getting duplicate shift rows.
CREATE TABLE dbo.DoctorSchedules (
    ScheduleId      UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    DoctorId        UNIQUEIDENTIFIER    NOT NULL,
    ClinicId        UNIQUEIDENTIFIER    NOT NULL,
    DayOfWeek       TINYINT             NOT NULL,   -- 0 = Sunday .. 6 = Saturday
    StartTime       TIME(0)             NOT NULL,
    EndTime         TIME(0)             NOT NULL,
    SlotMinutes     INT                 NOT NULL DEFAULT 15,
    EffectiveFrom   DATE                NOT NULL,
    EffectiveTo     DATE                NULL,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    CreatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_DoctorSchedules PRIMARY KEY CLUSTERED (ScheduleId),
    CONSTRAINT FK_DoctorSchedules_Doctor FOREIGN KEY (DoctorId) REFERENCES dbo.Doctors(DoctorId),
    CONSTRAINT FK_DoctorSchedules_Clinic FOREIGN KEY (ClinicId) REFERENCES dbo.Clinics(ClinicId),
    CONSTRAINT CK_DoctorSchedules_TimeRange CHECK (EndTime > StartTime),
    CONSTRAINT CK_DoctorSchedules_DayOfWeek CHECK (DayOfWeek BETWEEN 0 AND 6),
    CONSTRAINT CK_DoctorSchedules_SlotMinutes CHECK (SlotMinutes > 0),
    CONSTRAINT UQ_DoctorSchedules_Shift UNIQUE (DoctorId, DayOfWeek, StartTime, EffectiveFrom)
);
GO
CREATE INDEX IX_DoctorSchedules_DoctorId ON dbo.DoctorSchedules(DoctorId);
GO

CREATE TABLE dbo.Patients (
    PatientId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    UserId          UNIQUEIDENTIFIER    NULL,       -- null until the patient has a portal login
    FirstName       NVARCHAR(100)       NOT NULL,
    LastName        NVARCHAR(100)       NOT NULL,
    AMKA            CHAR(11)            NULL,        -- Greek social security / health number
    DateOfBirth     DATE                NOT NULL,
    Phone           NVARCHAR(30)        NULL,
    Email           NVARCHAR(256)       NULL,
    IsDeleted       BIT                 NOT NULL DEFAULT 0,
    CreatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    DeletedAt       DATETIMEOFFSET(3)   NULL,
    CONSTRAINT PK_Patients PRIMARY KEY CLUSTERED (PatientId),
    CONSTRAINT FK_Patients_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT UQ_Patients_User UNIQUE (UserId),
    CONSTRAINT UQ_Patients_AMKA UNIQUE (AMKA)
);
GO

/* ----------------------------------------------------------------------------
   Appointments & lifecycle
---------------------------------------------------------------------------- */

CREATE TABLE dbo.AppointmentStatuses (
    AppointmentStatusId    TINYINT         NOT NULL,
    Code                    NVARCHAR(30)    NOT NULL,
    Description              NVARCHAR(100)   NULL,
    CONSTRAINT PK_AppointmentStatuses PRIMARY KEY CLUSTERED (AppointmentStatusId),
    CONSTRAINT UQ_AppointmentStatuses_Code UNIQUE (Code)
);
GO

CREATE TABLE dbo.Appointments (
    AppointmentId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    ClinicId            UNIQUEIDENTIFIER    NOT NULL,
    DepartmentId        UNIQUEIDENTIFIER    NOT NULL,
    DoctorId            UNIQUEIDENTIFIER    NOT NULL,
    PatientId           UNIQUEIDENTIFIER    NOT NULL,
    ScheduledStart      DATETIMEOFFSET(3)   NOT NULL,
    ScheduledEnd        DATETIMEOFFSET(3)   NOT NULL,
    AppointmentStatusId TINYINT             NOT NULL DEFAULT 1,
    Reason              NVARCHAR(300)       NULL,
    CreatedByUserId     UNIQUEIDENTIFIER    NOT NULL,
    CreatedAt           DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt           DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    IsDeleted           BIT                 NOT NULL DEFAULT 0,
    CONSTRAINT PK_Appointments PRIMARY KEY CLUSTERED (AppointmentId),
    CONSTRAINT FK_Appointments_Clinic FOREIGN KEY (ClinicId) REFERENCES dbo.Clinics(ClinicId),
    CONSTRAINT FK_Appointments_Department FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(DepartmentId),
    CONSTRAINT FK_Appointments_Doctor FOREIGN KEY (DoctorId) REFERENCES dbo.Doctors(DoctorId),
    CONSTRAINT FK_Appointments_Patient FOREIGN KEY (PatientId) REFERENCES dbo.Patients(PatientId),
    CONSTRAINT FK_Appointments_Status FOREIGN KEY (AppointmentStatusId) REFERENCES dbo.AppointmentStatuses(AppointmentStatusId),
    CONSTRAINT FK_Appointments_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Appointments_TimeRange CHECK (ScheduledEnd > ScheduledStart)
);
GO

-- Read-model indexes for scheduler/dashboard/report queries
CREATE INDEX IX_Appointments_DoctorId_ScheduledStart
    ON dbo.Appointments(DoctorId, ScheduledStart)
    INCLUDE (AppointmentStatusId, PatientId, ScheduledEnd)
    WHERE IsDeleted = 0;
CREATE INDEX IX_Appointments_ClinicId_ScheduledStart
    ON dbo.Appointments(ClinicId, ScheduledStart)
    WHERE IsDeleted = 0;
CREATE INDEX IX_Appointments_PatientId ON dbo.Appointments(PatientId);
CREATE INDEX IX_Appointments_AppointmentStatusId ON dbo.Appointments(AppointmentStatusId);
GO

CREATE TABLE dbo.AppointmentStatusHistory (
    HistoryId           BIGINT IDENTITY(1,1)   NOT NULL,
    AppointmentId        UNIQUEIDENTIFIER       NOT NULL,
    OldStatusId          TINYINT                NULL,
    NewStatusId          TINYINT                NOT NULL,
    ChangedByUserId       UNIQUEIDENTIFIER       NULL,   -- null when the app can't attribute a system change
    ChangedAt            DATETIMEOFFSET(3)      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    Reason                NVARCHAR(300)          NULL,
    CONSTRAINT PK_AppointmentStatusHistory PRIMARY KEY CLUSTERED (HistoryId),
    CONSTRAINT FK_AppointmentStatusHistory_Appointment FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(AppointmentId),
    CONSTRAINT FK_AppointmentStatusHistory_OldStatus FOREIGN KEY (OldStatusId) REFERENCES dbo.AppointmentStatuses(AppointmentStatusId),
    CONSTRAINT FK_AppointmentStatusHistory_NewStatus FOREIGN KEY (NewStatusId) REFERENCES dbo.AppointmentStatuses(AppointmentStatusId),
    CONSTRAINT FK_AppointmentStatusHistory_ChangedBy FOREIGN KEY (ChangedByUserId) REFERENCES dbo.Users(UserId)
);
GO
CREATE INDEX IX_AppointmentStatusHistory_AppointmentId ON dbo.AppointmentStatusHistory(AppointmentId);
GO

/* No-overlap enforcement: a doctor cannot hold two active (non-cancelled,
   non-no-show) appointments whose time ranges intersect. */
CREATE TRIGGER dbo.trg_Appointments_NoOverlap
ON dbo.Appointments
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Appointments a
            ON a.DoctorId = i.DoctorId
           AND a.AppointmentId <> i.AppointmentId
           AND a.IsDeleted = 0
           AND a.AppointmentStatusId NOT IN (5 /* Cancelled */, 6 /* NoShow */)
           AND a.ScheduledStart < i.ScheduledEnd
           AND a.ScheduledEnd   > i.ScheduledStart
        WHERE i.IsDeleted = 0
          AND i.AppointmentStatusId NOT IN (5, 6)
    )
    BEGIN
        RAISERROR('Doctor already has an overlapping appointment in this time range.', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO

/* Every status change is captured automatically. The app sets the acting user
   once per connection: EXEC sp_set_session_context 'UserId', @UserId; */
CREATE TRIGGER dbo.trg_Appointments_StatusHistory
ON dbo.Appointments
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.AppointmentStatusHistory (AppointmentId, OldStatusId, NewStatusId, ChangedByUserId, ChangedAt)
    SELECT
        i.AppointmentId,
        d.AppointmentStatusId,
        i.AppointmentStatusId,
        TRY_CAST(SESSION_CONTEXT(N'UserId') AS UNIQUEIDENTIFIER),
        SYSDATETIMEOFFSET()
    FROM inserted i
    JOIN deleted d ON d.AppointmentId = i.AppointmentId
    WHERE i.AppointmentStatusId <> d.AppointmentStatusId;
END;
GO

/* ----------------------------------------------------------------------------
   Medical records & notifications
---------------------------------------------------------------------------- */

-- Notes carries clinical detail: put it behind column-level encryption
-- (Always Encrypted or TDE + application-level encryption) before go-live.
CREATE TABLE dbo.MedicalRecords (
    RecordId        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER    NOT NULL,
    AppointmentId   UNIQUEIDENTIFIER    NULL,
    DoctorId        UNIQUEIDENTIFIER    NOT NULL,
    Notes           NVARCHAR(MAX)       NOT NULL,
    IsDeleted       BIT                 NOT NULL DEFAULT 0,
    CreatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    DeletedAt       DATETIMEOFFSET(3)   NULL,
    CONSTRAINT PK_MedicalRecords PRIMARY KEY CLUSTERED (RecordId),
    CONSTRAINT FK_MedicalRecords_Patient FOREIGN KEY (PatientId) REFERENCES dbo.Patients(PatientId),
    CONSTRAINT FK_MedicalRecords_Appointment FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(AppointmentId),
    CONSTRAINT FK_MedicalRecords_Doctor FOREIGN KEY (DoctorId) REFERENCES dbo.Doctors(DoctorId)
);
GO
CREATE INDEX IX_MedicalRecords_PatientId ON dbo.MedicalRecords(PatientId);
GO

CREATE TABLE dbo.Notifications (
    NotificationId  UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    UserId          UNIQUEIDENTIFIER    NOT NULL,
    Type            NVARCHAR(50)        NOT NULL,   -- AppointmentCreated | Cancelled | Confirmed | Rescheduled ...
    Payload         NVARCHAR(MAX)       NULL,        -- JSON
    IsRead          BIT                 NOT NULL DEFAULT 0,
    CreatedAt       DATETIMEOFFSET(3)   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    ReadAt          DATETIMEOFFSET(3)   NULL,
    CONSTRAINT PK_Notifications PRIMARY KEY CLUSTERED (NotificationId),
    CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
);
GO
CREATE INDEX IX_Notifications_UserId_IsRead ON dbo.Notifications(UserId, IsRead);
GO

/* ----------------------------------------------------------------------------
   Audit — separate schema, append-only, no FKs so a write here never fails
   because of referential integrity on the operational tables it's watching.
---------------------------------------------------------------------------- */

CREATE TABLE audit.AuditLogs (
    AuditLogId      BIGINT IDENTITY(1,1)   NOT NULL,
    UserId          UNIQUEIDENTIFIER       NULL,   -- null for pre-auth events (e.g. failed login)
    Role            NVARCHAR(50)           NULL,
    [Timestamp]     DATETIMEOFFSET(3)      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    ActionType      NVARCHAR(50)           NOT NULL,
    EntityType      NVARCHAR(50)           NOT NULL,
    EntityId        NVARCHAR(100)          NULL,
    SourceIp        NVARCHAR(45)           NULL,   -- IPv4 or IPv6
    UserAgent       NVARCHAR(400)          NULL,
    BeforeSnapshot  NVARCHAR(MAX)          NULL,   -- JSON
    AfterSnapshot   NVARCHAR(MAX)          NULL,   -- JSON
    CONSTRAINT PK_AuditLogs PRIMARY KEY CLUSTERED (AuditLogId)
);
GO
CREATE INDEX IX_AuditLogs_Timestamp ON audit.AuditLogs([Timestamp]);
CREATE INDEX IX_AuditLogs_UserId_Timestamp ON audit.AuditLogs(UserId, [Timestamp]);
CREATE INDEX IX_AuditLogs_EntityType_EntityId ON audit.AuditLogs(EntityType, EntityId);
GO

/* ----------------------------------------------------------------------------
   Seed data
---------------------------------------------------------------------------- */

SET IDENTITY_INSERT dbo.Roles ON;
INSERT INTO dbo.Roles (RoleId, Name, Description) VALUES
    (1, 'Admin', 'Full system administration'),
    (2, 'SuperUser', 'Elevated privileges beyond standard admin'),
    (3, 'ClinicManager', 'Manages a clinic''s doctors, departments and schedules'),
    (4, 'Doctor', 'Clinical calendar, appointments, patient history'),
    (5, 'Reception', 'Front-desk booking and check-in workflows'),
    (6, 'Patient', 'Own appointments only');
SET IDENTITY_INSERT dbo.Roles OFF;
GO

INSERT INTO dbo.AppointmentStatuses (AppointmentStatusId, Code, Description) VALUES
    (1, 'Scheduled',   'Booked, awaiting confirmation'),
    (2, 'Confirmed',   'Confirmed by clinic or patient'),
    (3, 'CheckedIn',   'Patient has arrived'),
    (4, 'Completed',   'Visit completed'),
    (5, 'Cancelled',   'Cancelled by patient, reception or doctor'),
    (6, 'NoShow',      'Patient did not attend'),
    (7, 'Rescheduled', 'Moved to a new time slot');
GO
