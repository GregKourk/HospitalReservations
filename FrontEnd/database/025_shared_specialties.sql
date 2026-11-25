/* ============================================================================
   Β2 — one shared list of specialties ("Ειδικότητες") for every branch.

   Until now every Department belonged to one Clinic (Departments.ClinicId),
   so "Καρδιολογικό" had to be created again for each branch and reports by
   specialty split across those copies. From here on dbo.Departments is the
   business-wide specialty list:

     1. Departments with the same name (trimmed, compared by the column's
        collation — case-insensitive by default) are merged into one: the
        active one wins, then the oldest. Doctors, Appointments and
        AppointmentWaitlist rows are re-pointed to the survivor and the
        duplicates are deleted.
     2. Departments.ClinicId (with its FK and indexes) is dropped and the
        name becomes unique across the whole table (UQ_Departments_Name).
     3. Doctors.Specialty, which was free text, is set to the specialty's
        name — the API now fills it from the Department on every save.

   Which branches offer a specialty is no longer stored on the specialty: it
   follows from which branches have active doctors in it.

   Everything runs in one transaction and is skipped if ClinicId is already
   gone, so the script is safe to re-run. Run the preview query at the bottom
   first if you want to see what will be merged.

   Run after 024_polyclinic_labels.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

IF COL_LENGTH('dbo.Departments', 'ClinicId') IS NOT NULL
BEGIN
    BEGIN TRANSACTION;

    -- 1. Pick a survivor per name and map every department to it.
    UPDATE dbo.Departments SET Name = LTRIM(RTRIM(Name)) WHERE DATALENGTH(Name) <> DATALENGTH(LTRIM(RTRIM(Name))); -- '=' ignores trailing spaces

    CREATE TABLE #DeptMap (OldId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, NewId UNIQUEIDENTIFIER NOT NULL);

    ;WITH ranked AS (
        SELECT DepartmentId, Name,
               ROW_NUMBER() OVER (PARTITION BY Name ORDER BY IsActive DESC, CreatedAt, DepartmentId) AS rn
        FROM dbo.Departments
    )
    INSERT INTO #DeptMap (OldId, NewId)
    SELECT r.DepartmentId, s.DepartmentId
    FROM ranked r
    JOIN ranked s ON s.Name = r.Name AND s.rn = 1
    WHERE r.rn > 1;

    UPDATE d SET DepartmentId = m.NewId FROM dbo.Doctors d      JOIN #DeptMap m ON m.OldId = d.DepartmentId;
    UPDATE a SET DepartmentId = m.NewId FROM dbo.Appointments a JOIN #DeptMap m ON m.OldId = a.DepartmentId;
    IF OBJECT_ID('dbo.AppointmentWaitlist', 'U') IS NOT NULL
        EXEC (N'UPDATE w SET DepartmentId = m.NewId FROM dbo.AppointmentWaitlist w JOIN #DeptMap m ON m.OldId = w.DepartmentId;');

    -- A merged specialty stays active if any of its copies was active.
    UPDATE s SET IsActive = 1
    FROM dbo.Departments s
    WHERE s.IsActive = 0
      AND EXISTS (SELECT 1 FROM #DeptMap m JOIN dbo.Departments o ON o.DepartmentId = m.OldId
                  WHERE m.NewId = s.DepartmentId AND o.IsActive = 1);

    DELETE dep FROM dbo.Departments dep JOIN #DeptMap m ON m.OldId = dep.DepartmentId;

    DROP TABLE #DeptMap;

    -- 2. Detach Departments from Clinics.
    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_Departments_Clinic_Name')
        ALTER TABLE dbo.Departments DROP CONSTRAINT UQ_Departments_Clinic_Name;
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Departments_Clinic')
        ALTER TABLE dbo.Departments DROP CONSTRAINT FK_Departments_Clinic;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Departments_ClinicId' AND object_id = OBJECT_ID('dbo.Departments'))
        DROP INDEX IX_Departments_ClinicId ON dbo.Departments;

    ALTER TABLE dbo.Departments DROP COLUMN ClinicId;
    ALTER TABLE dbo.Departments ADD CONSTRAINT UQ_Departments_Name UNIQUE (Name);

    -- 3. Doctors.Specialty follows the specialty's name from now on.
    UPDATE d SET Specialty = dep.Name
    FROM dbo.Doctors d JOIN dbo.Departments dep ON dep.DepartmentId = d.DepartmentId
    WHERE d.Specialty <> dep.Name;

    COMMIT TRANSACTION;
END
GO

/* Preview (run on its own, before the script above) — which departments
   will be merged into one:

SELECT LTRIM(RTRIM(d.Name)) AS Specialty, COUNT(*) AS Copies,
       STRING_AGG(c.Name, N', ') AS Branches
FROM dbo.Departments d JOIN dbo.Clinics c ON c.ClinicId = d.ClinicId
GROUP BY LTRIM(RTRIM(d.Name))
HAVING COUNT(*) > 1
ORDER BY Specialty;
*/
