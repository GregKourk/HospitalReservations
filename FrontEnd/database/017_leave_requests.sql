/* ============================================================================
   Doctor leave/absence requests ("Διαθεσιμότητα / Άδειες") — a Doctor
   requests a date range off; ClinicManager/Admin/SuperUser approve or
   reject it. An Approved request blocks that doctor's availability the
   same way a Holiday does (Doctors/{id}/Availability, Appointments
   Create/Reschedule) — see Helpers/LeaveHelper.cs.

   Run after 016_reception_calendar_dashboard.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LeaveRequests' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.LeaveRequests (
        LeaveRequestId   UNIQUEIDENTIFIER   NOT NULL DEFAULT NEWID(),
        DoctorId         UNIQUEIDENTIFIER   NOT NULL,
        StartDate        DATE               NOT NULL,
        EndDate          DATE               NOT NULL,
        Reason           NVARCHAR(300)      NULL,
        Status           NVARCHAR(20)       NOT NULL DEFAULT 'Pending',
        RequestedAt      DATETIMEOFFSET(3)  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        ReviewedByUserId UNIQUEIDENTIFIER   NULL,
        ReviewedAt       DATETIMEOFFSET(3)  NULL,
        ReviewNote       NVARCHAR(300)      NULL,
        CONSTRAINT PK_LeaveRequests PRIMARY KEY CLUSTERED (LeaveRequestId),
        CONSTRAINT FK_LeaveRequests_Doctor FOREIGN KEY (DoctorId) REFERENCES dbo.Doctors(DoctorId),
        CONSTRAINT CK_LeaveRequests_Dates CHECK (EndDate >= StartDate),
        CONSTRAINT CK_LeaveRequests_Status CHECK (Status IN ('Pending', 'Approved', 'Rejected', 'Cancelled'))
    );
    CREATE INDEX IX_LeaveRequests_DoctorId ON dbo.LeaveRequests(DoctorId);
    CREATE INDEX IX_LeaveRequests_Status ON dbo.LeaveRequests(Status);
END
GO
