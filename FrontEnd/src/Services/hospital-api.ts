import axios from 'axios';

// Typed client for HospitalReservationsAPI's domain endpoints (Clinics,
// Doctors, Lookups, Patients, Appointments) — see BackEnd/.../Controllers.
// Plain array responses, not the DevExtreme.AspNet.Data LoadResult protocol
// (createEntityStore/EntityGrid don't apply here).

const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL_LOCAL
  : import.meta.env.VITE_API_URL;

export interface ClinicDto {
  clinicId: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
}

export interface ClinicUpsertRequest {
  name: string;
  address?: string;
  phone?: string;
}

export interface DepartmentDto {
  departmentId: string;
  clinicId: string;
  clinicName: string;
  name: string;
  isActive: boolean;
}

export interface DepartmentUpsertRequest {
  clinicId: string;
  name: string;
}

export interface FullDoctorDto {
  doctorId: string;
  clinicId: string;
  clinicName: string;
  departmentId: string;
  departmentName: string;
  fullName: string;
  email: string;
  amka?: string | null;
  specialty: string;
  licenseNumber: string;
  isActive: boolean;
}

// Creating a doctor also provisions the login identity behind it (find by
// email, or create) and grants the Doctor role.
export interface DoctorCreateRequest {
  email: string;
  fullName: string;
  clinicId: string;
  departmentId: string;
  amka?: string;
  specialty: string;
  licenseNumber: string;
}

export interface DoctorUpdateRequest {
  clinicId: string;
  departmentId: string;
  amka?: string;
  specialty: string;
  licenseNumber: string;
}

// Recurring weekly availability — this is what Doctors/{id}/Availability
// actually reads from. dayOfWeek: 0 = Sunday .. 6 = Saturday. Times are
// "HH:mm:ss" (.NET TimeSpan's default JSON format).
export interface DoctorScheduleDto {
  scheduleId: string;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  clinicName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
}

export interface DoctorScheduleCreateRequest {
  doctorId: string;
  clinicId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface DoctorScheduleUpdateRequest {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
}

export const DAY_OF_WEEK_NAMES = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];

export interface LookupItemDto {
  id: string;
  text: string;
}

export interface StatusLookupDto {
  id: number;
  code: string;
  description?: string | null;
}

export interface DoctorAvailabilitySlotDto {
  start: string;
  end: string;
}

export interface RoleLookupDto {
  id: number;
  name: string;
  description?: string | null;
}

// Staff account provisioning. Real sign-in only ever happens through
// Gov.gr, and self-service Gov.gr sign-in only ever grants Patient — so
// this is the only place a Reception/ClinicManager/Admin/SuperUser account
// gets its role, either pre-provisioned by email or granted afterwards.
export interface UserDto {
  userId: string;
  email: string;
  fullName: string;
  externalProvider?: string | null;
  isActive: boolean;
  createdAt: string;
  roles: string[];
}

export interface UserCreateRequest {
  email: string;
  fullName: string;
  roleIds: number[];
}

export interface PatientDto {
  patientId: string;
  firstName: string;
  lastName: string;
  amka?: string | null;
  dateOfBirth: string;
  phone?: string | null;
  email?: string | null;
}

export interface PatientUpsertRequest {
  firstName: string;
  lastName: string;
  amka?: string;
  dateOfBirth: string;
  phone?: string;
  email?: string;
}

export interface AppointmentDto {
  appointmentId: string;
  clinicId: string;
  departmentId: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientName: string;
  scheduledStart: string;
  scheduledEnd: string;
  appointmentStatusId: number;
  statusCode: string;
  reason?: string | null;
}

export interface AppointmentCreateRequest {
  clinicId: string;
  departmentId: string;
  doctorId: string;
  patientId: string;
  scheduledStart: string;
  scheduledEnd: string;
  reason?: string;
}

// Status ids match database/hospital-schema.sql's AppointmentStatuses seed.
export const APPOINTMENT_STATUS = {
  Scheduled: 1,
  Confirmed: 2,
  CheckedIn: 3,
  Completed: 4,
  Cancelled: 5,
  NoShow: 6,
  Rescheduled: 7,
} as const;

export type AppointmentBadgeVariant = 'secondary' | 'info' | 'primary' | 'success' | 'destructive' | 'warning' | 'outline';

// Shared status -> badge color mapping (Reception's daily list and the admin
// Appointments screen both render the same statuses and must agree on how
// they look).
export const STATUS_BADGE_VARIANT: Record<string, AppointmentBadgeVariant> = {
  Scheduled: 'secondary',
  Confirmed: 'info',
  CheckedIn: 'primary',
  Completed: 'success',
  Cancelled: 'destructive',
  NoShow: 'warning',
  Rescheduled: 'outline',
};

// A "Rescheduled" appointment is still a live, upcoming visit at its new
// time — not a dead end — so it gets the same next actions as Scheduled.
// Shared by the Reception booking screen and the admin Appointments screen
// so the two never drift into offering different actions for the same status.
export function getAvailableActions(statusCode: string) {
  const open = ['Scheduled', 'Confirmed', 'CheckedIn', 'Rescheduled'].includes(statusCode);
  return {
    canConfirm: statusCode === 'Scheduled' || statusCode === 'Rescheduled',
    canCheckIn: ['Scheduled', 'Confirmed', 'Rescheduled'].includes(statusCode),
    canComplete: statusCode === 'CheckedIn',
    canNoShow: ['Scheduled', 'Confirmed', 'Rescheduled'].includes(statusCode),
    canCancel: open,
    canReschedule: open,
  };
}

// Surfaces the backend's actual reason (ProblemDetails validation errors, a
// plain-text Conflict body, etc.) instead of a generic "something failed" —
// swallowing it makes real bugs (wrong role, expired token, FK conflict)
// indistinguishable from each other in the UI.
export function getErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;
  const data = anyErr?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0];
    if (typeof first === 'string') return first;
  }
  if (typeof data?.title === 'string') return data.title;
  if (anyErr?.response?.status) return `${fallback} (HTTP ${anyErr.response.status})`;
  return fallback;
}

export const getClinics = (includeInactive = false) =>
  axios.get<ClinicDto[]>(`${API_BASE_URL}/Clinics`, { params: { includeInactive } });

export const createClinic = (payload: ClinicUpsertRequest) =>
  axios.post<ClinicDto>(`${API_BASE_URL}/Clinics`, payload);

export const updateClinic = (id: string, payload: ClinicUpsertRequest) =>
  axios.put(`${API_BASE_URL}/Clinics/${id}`, payload);

export const deleteClinic = (id: string) =>
  axios.delete(`${API_BASE_URL}/Clinics/${id}`);

export const getDepartments = (clinicId?: string) =>
  axios.get<DepartmentDto[]>(`${API_BASE_URL}/Departments`, { params: clinicId ? { clinicId } : {} });

export const createDepartment = (payload: DepartmentUpsertRequest) =>
  axios.post<DepartmentDto>(`${API_BASE_URL}/Departments`, payload);

export const updateDepartment = (id: string, payload: DepartmentUpsertRequest) =>
  axios.put(`${API_BASE_URL}/Departments/${id}`, payload);

export const deleteDepartment = (id: string) =>
  axios.delete(`${API_BASE_URL}/Departments/${id}`);

export const getFullDoctors = (clinicId?: string, departmentId?: string) =>
  axios.get<FullDoctorDto[]>(`${API_BASE_URL}/Doctors`, { params: { clinicId, departmentId } });

export const createDoctor = (payload: DoctorCreateRequest) =>
  axios.post<string>(`${API_BASE_URL}/Doctors`, payload);

export const updateDoctor = (id: string, payload: DoctorUpdateRequest) =>
  axios.put(`${API_BASE_URL}/Doctors/${id}`, payload);

export const deleteDoctor = (id: string) =>
  axios.delete(`${API_BASE_URL}/Doctors/${id}`);

export const getOwnDoctor = () =>
  axios.get<FullDoctorDto>(`${API_BASE_URL}/Doctors/Me`);

export const getDoctorSchedules = (doctorId?: string, clinicId?: string) =>
  axios.get<DoctorScheduleDto[]>(`${API_BASE_URL}/DoctorSchedules`, { params: { doctorId, clinicId } });

export const createDoctorSchedule = (payload: DoctorScheduleCreateRequest) =>
  axios.post<string>(`${API_BASE_URL}/DoctorSchedules`, payload);

export const updateDoctorSchedule = (id: string, payload: DoctorScheduleUpdateRequest) =>
  axios.put(`${API_BASE_URL}/DoctorSchedules/${id}`, payload);

export const deleteDoctorSchedule = (id: string) =>
  axios.delete(`${API_BASE_URL}/DoctorSchedules/${id}`);

export const getLookupDepartments = (clinicId: string) =>
  axios.get<LookupItemDto[]>(`${API_BASE_URL}/Lookups/Departments`, { params: { clinicId } });

export const getLookupDoctors = (clinicId?: string, departmentId?: string) =>
  axios.get<LookupItemDto[]>(`${API_BASE_URL}/Lookups/Doctors`, { params: { clinicId, departmentId } });

export const getAppointmentStatuses = () =>
  axios.get<StatusLookupDto[]>(`${API_BASE_URL}/Lookups/AppointmentStatuses`);

export const getRoles = () =>
  axios.get<RoleLookupDto[]>(`${API_BASE_URL}/Lookups/Roles`);

export const getUsers = (search?: string, includeInactive = false) =>
  axios.get<UserDto[]>(`${API_BASE_URL}/Users`, { params: { search, includeInactive } });

export const createUser = (payload: UserCreateRequest) =>
  axios.post<string>(`${API_BASE_URL}/Users`, payload);

export const updateUserRoles = (id: string, roleIds: number[]) =>
  axios.put(`${API_BASE_URL}/Users/${id}/Roles`, { roleIds });

export const updateUserStatus = (id: string, isActive: boolean) =>
  axios.put(`${API_BASE_URL}/Users/${id}/Status`, { isActive });

export const getDoctorAvailability = (doctorId: string, isoDate: string) =>
  axios.get<DoctorAvailabilitySlotDto[]>(`${API_BASE_URL}/Doctors/${doctorId}/Availability`, { params: { date: isoDate } });

export const searchPatients = (search: string, take?: number) =>
  axios.get<PatientDto[]>(`${API_BASE_URL}/Patients`, { params: { ...(search ? { search } : {}), ...(take ? { take } : {}) } });

// Self-service: a Patient's own record — "Το Προφίλ μου / Προσωπικά Στοιχεία".
export const getOwnPatient = () =>
  axios.get<PatientDto>(`${API_BASE_URL}/Patients/Me`);

export const createPatient = (payload: PatientUpsertRequest) =>
  axios.post<PatientDto>(`${API_BASE_URL}/Patients`, payload);

export const updatePatient = (id: string, payload: PatientUpsertRequest) =>
  axios.put(`${API_BASE_URL}/Patients/${id}`, payload);

export const deletePatient = (id: string) =>
  axios.delete(`${API_BASE_URL}/Patients/${id}`);

export const getAppointments = (params: {
  clinicId?: string;
  doctorId?: string;
  patientId?: string;
  statusId?: number;
  from?: string;
  to?: string;
}) => axios.get<AppointmentDto[]>(`${API_BASE_URL}/Appointments`, { params });

export const createAppointment = (payload: AppointmentCreateRequest) =>
  axios.post<string>(`${API_BASE_URL}/Appointments`, payload);

export const changeAppointmentStatus = (id: string, appointmentStatusId: number, reason?: string) =>
  axios.put(`${API_BASE_URL}/Appointments/${id}/Status`, { appointmentStatusId, reason });

export const rescheduleAppointment = (id: string, scheduledStart: string, scheduledEnd: string) =>
  axios.put(`${API_BASE_URL}/Appointments/${id}/Reschedule`, { scheduledStart, scheduledEnd });

// ── Waitlist — "Νέο Ραντεβού" self-service has no open slot on the chosen
// date, so the patient joins this instead; notified when a slot there frees up. ──

export interface WaitlistEntryDto {
  waitlistId: string;
  patientId: string;
  patientName: string;
  clinicId: string;
  clinicName: string;
  departmentId: string;
  departmentName: string;
  doctorId: string;
  doctorName: string;
  preferredDate: string;
  reason?: string | null;
  status: string;
  createdAt: string;
}

export interface WaitlistCreateRequest {
  clinicId: string;
  departmentId: string;
  doctorId: string;
  patientId: string;
  preferredDate: string;
  reason?: string;
}

export const getWaitlist = (params?: { clinicId?: string; doctorId?: string; status?: string }) =>
  axios.get<WaitlistEntryDto[]>(`${API_BASE_URL}/Waitlist`, { params });

export const joinWaitlist = (payload: WaitlistCreateRequest) =>
  axios.post<string>(`${API_BASE_URL}/Waitlist`, payload);

export const cancelWaitlistEntry = (id: string) =>
  axios.put(`${API_BASE_URL}/Waitlist/${id}/Cancel`);

// Fire-and-forget audit hook for client-side PDF/Excel exports (the file
// itself never touches the server) — who/when come from the JWT, this just
// says what was exported and in which format.
export const logExport = (entityType: string, format: 'pdf' | 'excel') =>
  axios.post(`${API_BASE_URL}/Audit/Export`, { entityType, format });

export interface AuditLogDto {
  auditLogId: number;
  timestamp: string;
  userId?: string | null;
  userName?: string | null;
  role?: string | null;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  sourceIp?: string | null;
  userAgent?: string | null;
  beforeSnapshot?: string | null;
  afterSnapshot?: string | null;
}

export const getAuditLogs = (params: {
  from?: string;
  to?: string;
  actionTypes?: string; // comma-separated
  entityType?: string;
  search?: string;
  securityOnly?: boolean;
  take?: number;
}) => axios.get<AuditLogDto[]>(`${API_BASE_URL}/Audit/Logs`, { params });

// ── System Settings: business hours, holidays, cancellation/reschedule
// policies, notification templates ─────────────────────────────────────────

export interface SystemSettingDto {
  settingKey: string;
  settingValue?: string | null;
  description?: string | null;
  updatedAt: string;
}

export const getSystemSettings = () =>
  axios.get<SystemSettingDto[]>(`${API_BASE_URL}/SystemSettings`);

export const updateSystemSetting = (key: string, settingValue: string) =>
  axios.put(`${API_BASE_URL}/SystemSettings/${key}`, { settingValue });

export interface HolidayDto {
  holidayId: string;
  holidayDate: string;
  name: string;
  isActive: boolean;
  isRecurringAnnual: boolean;
}

export interface HolidayUpsertRequest {
  holidayDate: string;
  name: string;
  isActive: boolean;
  isRecurringAnnual: boolean;
}

export const getHolidays = (includeInactive = false) =>
  axios.get<HolidayDto[]>(`${API_BASE_URL}/Holidays`, { params: { includeInactive } });

export const createHoliday = (payload: HolidayUpsertRequest) =>
  axios.post<string>(`${API_BASE_URL}/Holidays`, payload);

export const updateHoliday = (id: string, payload: HolidayUpsertRequest) =>
  axios.put(`${API_BASE_URL}/Holidays/${id}`, payload);

export const deleteHoliday = (id: string) =>
  axios.delete(`${API_BASE_URL}/Holidays/${id}`);

export interface NotificationTemplateDto {
  templateId: string;
  code: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  updatedAt: string;
}

export interface NotificationTemplateUpdateRequest {
  subject: string;
  body: string;
  isActive: boolean;
}

export const getNotificationTemplates = () =>
  axios.get<NotificationTemplateDto[]>(`${API_BASE_URL}/NotificationTemplates`);

export const updateNotificationTemplate = (id: string, payload: NotificationTemplateUpdateRequest) =>
  axios.put(`${API_BASE_URL}/NotificationTemplates/${id}`, payload);

// ── Dashboard (Admin/SuperUser) ──────────────────────────────────────────────

export interface StatusCountDto {
  statusCode: string;
  description?: string | null;
  count: number;
}

export interface RecentActivityDto {
  timestamp: string;
  userName?: string | null;
  role?: string | null;
  actionType: string;
  entityType: string;
  entityId?: string | null;
}

export interface DashboardSummaryDto {
  totalClinics: number;
  totalDepartments: number;
  totalDoctors: number;
  totalPatients: number;
  totalActiveUsers: number;
  appointmentsToday: StatusCountDto[];
  appointmentsThisWeek: number;
  cancellationsLast30Days: number;
  noShowsLast30Days: number;
  recentActivity: RecentActivityDto[];
}

export const getDashboardSummary = () =>
  axios.get<DashboardSummaryDto>(`${API_BASE_URL}/Dashboard/Summary`);

// ── Reports (Admin/SuperUser) ────────────────────────────────────────────────

export interface ClinicStatDto {
  clinicId: string;
  clinicName: string;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completionRate: number;
}

export interface DoctorStatDto {
  doctorId: string;
  doctorName: string;
  clinicName: string;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completionRate: number;
}

export interface CancellationNoShowDto {
  appointmentId: string;
  scheduledStart: string;
  clinicName: string;
  doctorName: string;
  patientName: string;
  statusCode: string;
  reason?: string | null;
}

export const getClinicStats = (from?: string, to?: string) =>
  axios.get<ClinicStatDto[]>(`${API_BASE_URL}/Reports/ClinicStats`, { params: { from, to } });

export const getDoctorStats = (from?: string, to?: string) =>
  axios.get<DoctorStatDto[]>(`${API_BASE_URL}/Reports/DoctorStats`, { params: { from, to } });

export const getCancellationsNoShows = (from?: string, to?: string) =>
  axios.get<CancellationNoShowDto[]>(`${API_BASE_URL}/Reports/CancellationsNoShows`, { params: { from, to } });

// ── Notifications (all roles) ────────────────────────────────────────────────

export interface NotificationDto {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export const getNotifications = (unreadOnly = false, take = 100) =>
  axios.get<NotificationDto[]>(`${API_BASE_URL}/Notifications`, { params: { unreadOnly, take } });

export const getUnreadNotificationCount = () =>
  axios.get<number>(`${API_BASE_URL}/Notifications/UnreadCount`);

export const markNotificationRead = (id: string) =>
  axios.put(`${API_BASE_URL}/Notifications/${id}/Read`);

export const markAllNotificationsRead = () =>
  axios.put(`${API_BASE_URL}/Notifications/ReadAll`);

// ── Medical Records ("Ιατρικό Ιστορικό / Σημειώσεις") ────────────────────────
// Doctor-only clinical notes, scoped server-side to the doctor's own notes.

export interface MedicalRecordDto {
  recordId: string;
  patientId: string;
  appointmentId?: string | null;
  doctorId: string;
  doctorName: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalRecordCreateRequest {
  patientId: string;
  appointmentId?: string;
  notes: string;
}

export const getMedicalRecords = (patientId: string) =>
  axios.get<MedicalRecordDto[]>(`${API_BASE_URL}/MedicalRecords`, { params: { patientId } });

export const createMedicalRecord = (payload: MedicalRecordCreateRequest) =>
  axios.post<string>(`${API_BASE_URL}/MedicalRecords`, payload);

export const updateMedicalRecord = (id: string, notes: string) =>
  axios.put(`${API_BASE_URL}/MedicalRecords/${id}`, { notes });

// ── Leave Requests ("Διαθεσιμότητα / Άδειες") ─────────────────────────────────

export interface LeaveRequestDto {
  leaveRequestId: string;
  doctorId: string;
  doctorName: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  requestedAt: string;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
}

export interface LeaveRequestCreateRequest {
  startDate: string;
  endDate: string;
  reason?: string;
}

export const getLeaveRequests = (status?: string) =>
  axios.get<LeaveRequestDto[]>(`${API_BASE_URL}/LeaveRequests`, { params: { status } });

export const createLeaveRequest = (payload: LeaveRequestCreateRequest) =>
  axios.post<string>(`${API_BASE_URL}/LeaveRequests`, payload);

export const reviewLeaveRequest = (id: string, approve: boolean, reviewNote?: string) =>
  axios.put(`${API_BASE_URL}/LeaveRequests/${id}/Review`, { approve, reviewNote });

export const cancelLeaveRequest = (id: string) =>
  axios.put(`${API_BASE_URL}/LeaveRequests/${id}/Cancel`);
