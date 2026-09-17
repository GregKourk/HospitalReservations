import type { BadgeProps } from '@/components/ui/badge';

// Shared between the Audit Log viewer and the Dashboard's recent-activity
// feed so the two never drift into showing different wording for the same
// audit ActionType.
export const ACTION_TYPES = [
  'Create', 'Update', 'Delete', 'StatusChange', 'Reschedule',
  'Login', 'LoginFailed', 'LoginProvisioned', 'MockLogin', 'Logout',
  'UpdateRoles', 'Activate', 'Deactivate', 'Export',
];

export const ACTION_LABELS_FALLBACK: Record<string, string> = {
  Create: 'Δημιουργία',
  Update: 'Ενημέρωση',
  Delete: 'Διαγραφή',
  StatusChange: 'Αλλαγή κατάστασης',
  Reschedule: 'Μετάθεση',
  Login: 'Σύνδεση',
  LoginFailed: 'Αποτυχημένη σύνδεση',
  LoginProvisioned: 'Νέος λογαριασμός (Gov.gr)',
  MockLogin: 'Δοκιμαστική σύνδεση',
  Logout: 'Αποσύνδεση',
  UpdateRoles: 'Αλλαγή ρόλων',
  Activate: 'Ενεργοποίηση',
  Deactivate: 'Απενεργοποίηση',
  Export: 'Εξαγωγή',
};

export const ACTION_VARIANT: Record<string, BadgeProps['variant']> = {
  Create: 'success',
  Update: 'secondary',
  Delete: 'destructive',
  StatusChange: 'secondary',
  Reschedule: 'outline',
  Login: 'info',
  LoginFailed: 'destructive',
  LoginProvisioned: 'info',
  MockLogin: 'outline',
  Logout: 'outline',
  UpdateRoles: 'warning',
  Activate: 'success',
  Deactivate: 'destructive',
  Export: 'secondary',
};

export const actionLabel = (t: string) => ACTION_LABELS_FALLBACK[t] ?? t;
