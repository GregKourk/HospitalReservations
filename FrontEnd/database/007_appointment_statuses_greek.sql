/* ============================================================================
   AppointmentStatuses.Description was seeded in English (hospital-schema.sql)
   — every other label in the UI is Greek, so the status badges ("Visit
   completed" etc.) stood out. Translate them in place; Code stays the same
   (it's the wire-format key the frontend switches on).

   Run after 006_appointments_menu.sql.
   ============================================================================ */

SET QUOTED_IDENTIFIER ON;
GO

UPDATE dbo.AppointmentStatuses SET Description = N'Προγραμματισμένο, αναμονή επιβεβαίωσης' WHERE Code = 'Scheduled';
UPDATE dbo.AppointmentStatuses SET Description = N'Επιβεβαιωμένο' WHERE Code = 'Confirmed';
UPDATE dbo.AppointmentStatuses SET Description = N'Άφιξη ασθενή' WHERE Code = 'CheckedIn';
UPDATE dbo.AppointmentStatuses SET Description = N'Ολοκληρώθηκε' WHERE Code = 'Completed';
UPDATE dbo.AppointmentStatuses SET Description = N'Ακυρώθηκε' WHERE Code = 'Cancelled';
UPDATE dbo.AppointmentStatuses SET Description = N'Μη προσέλευση' WHERE Code = 'NoShow';
UPDATE dbo.AppointmentStatuses SET Description = N'Μετατέθηκε' WHERE Code = 'Rescheduled';
GO
