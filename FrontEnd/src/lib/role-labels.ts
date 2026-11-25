// Greek display names for the role codes in dbo.Roles.Name. The codes
// themselves ('ClinicManager', ...) stay as they are — the backend's
// [Authorize(Roles=...)] and every roles.includes(...) check depend on them —
// only what the user sees is translated.
export const ROLE_LABELS: Record<string, string> = {
  Admin: 'Διαχειριστής',
  SuperUser: 'SuperUser',
  ClinicManager: 'Υπεύθυνος Υποκαταστήματος',
  Doctor: 'Γιατρός',
  Reception: 'Ρεσεψιόν',
  Patient: 'Ασθενής',
};

export const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;
