/* ============================================================================
   Adds annual-recurrence to Holidays (e.g. Christmas, New Year's — same
   month/day every year) so they don't need to be re-entered annually.
   A non-recurring holiday still matches only its exact HolidayDate.

   Run after 013_system_settings_menu.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Holidays') AND name = 'IsRecurringAnnual')
    ALTER TABLE dbo.Holidays ADD IsRecurringAnnual BIT NOT NULL DEFAULT 0;
GO
