import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import SelectBox from 'devextreme-react/select-box';
import DateBox from 'devextreme-react/date-box';
import notify from 'devextreme/ui/notify';
import { History, LoaderCircleIcon, Search, UserPlus, X } from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { PatientHistoryDialog } from '@/components/common/patient-history-dialog';
import { ReasonPromptDialog } from '@/components/common/reason-prompt-dialog';
import { RescheduleAppointmentDialog } from '@/components/common/reschedule-appointment-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  APPOINTMENT_STATUS,
  AppointmentDto,
  ClinicDto,
  DoctorAvailabilitySlotDto,
  LookupItemDto,
  PatientDto,
  STATUS_BADGE_VARIANT,
  StatusLookupDto,
  changeAppointmentStatus,
  createAppointment,
  createPatient,
  getAppointments,
  getAppointmentStatuses,
  getAvailableActions,
  getClinics,
  getDoctorAvailability,
  getErrorMessage,
  getLookupDepartments,
  getLookupDoctors,
  searchPatients,
} from '@/services/hospital-api';

const STAFF_ROLES = ['Admin', 'SuperUser', 'ClinicManager', 'Reception'];

// Same pragmatic check used for patient/doctor emails elsewhere (src/pages/AppPages/patients.tsx).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim());

function toIsoDate(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

export default function ReceptionPage() {
  const { currentUser } = useAuth();
  // While currentUser is still loading (right after a refresh) don't flash
  // the "no access" panel — only gate once we actually know the roles.
  const isStaff = !currentUser || currentUser.roles.some((r) => STAFF_ROLES.includes(r));

  const [clinics, setClinics] = useState<ClinicDto[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);

  const [departments, setDepartments] = useState<LookupItemDto[]>([]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<LookupItemDto[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);

  const [date, setDate] = useState<Date>(new Date());
  const [statuses, setStatuses] = useState<StatusLookupDto[]>([]);

  const [slots, setSlots] = useState<DoctorAvailabilitySlotDto[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<DoctorAvailabilitySlotDto | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<PatientDto[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientDto | null>(null);
  const [historyPatient, setHistoryPatient] = useState<PatientDto | null>(null);
  const [newPatientMode, setNewPatientMode] = useState(false);
  const [newPatient, setNewPatient] = useState({ firstName: '', lastName: '', amka: '', dateOfBirth: '', phone: '', email: '' });
  const [newPatientEmailTouched, setNewPatientEmailTouched] = useState(false);
  const newPatientEmailInvalid = newPatientEmailTouched && !!newPatient.email.trim() && !isValidEmail(newPatient.email);

  const [reason, setReason] = useState('');
  const [booking, setBooking] = useState(false);

  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);

  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentDto | null>(null);
  const [reasonPrompt, setReasonPrompt] = useState<{ appt: AppointmentDto; statusId: number; label: string } | null>(null);

  // ── initial lookups ──────────────────────────────────────────────────────
  useEffect(() => {
    getClinics()
      .then(({ data }) => {
        setClinics(data);
        if (data.length === 1) setClinicId(data[0].clinicId);
      })
      .catch(() => notify('Αποτυχία φόρτωσης κλινικών.', 'error', 4000));
    getAppointmentStatuses().then(({ data }) => setStatuses(data)).catch(() => {});
  }, []);

  // ── department/doctor cascade ────────────────────────────────────────────
  useEffect(() => {
    setDepartmentId(null);
    if (!clinicId) { setDepartments([]); return; }
    getLookupDepartments(clinicId).then(({ data }) => setDepartments(data)).catch(() => {});
  }, [clinicId]);

  useEffect(() => {
    setDoctorId(null);
    if (!clinicId) { setDoctors([]); return; }
    getLookupDoctors(clinicId, departmentId ?? undefined).then(({ data }) => setDoctors(data)).catch(() => {});
  }, [clinicId, departmentId]);

  // ── availability for the booking panel ───────────────────────────────────
  useEffect(() => {
    setSelectedSlot(null);
    if (!doctorId) { setSlots([]); return; }
    setSlotsLoading(true);
    getDoctorAvailability(doctorId, toIsoDate(date))
      .then(({ data }) => setSlots(data))
      .catch(() => notify('Αποτυχία φόρτωσης διαθεσιμότητας.', 'error', 4000))
      .finally(() => setSlotsLoading(false));
  }, [doctorId, date]);

  // ── the selected doctor's list for the selected day ──────────────────────
  const loadAppointments = () => {
    if (!doctorId) { setAppointments([]); return; }
    setAppointmentsLoading(true);
    const iso = toIsoDate(date);
    getAppointments({ doctorId, from: `${iso}T00:00:00`, to: `${iso}T23:59:59` })
      .then(({ data }) => setAppointments(data))
      .catch(() => notify('Αποτυχία φόρτωσης ραντεβού.', 'error', 4000))
      .finally(() => setAppointmentsLoading(false));
  };
  useEffect(loadAppointments, [doctorId, date]);

  // ── patient search (debounced) ───────────────────────────────────────────
  useEffect(() => {
    if (newPatientMode) return;
    const term = patientQuery.trim();
    if (term.length < 2) { setPatientResults([]); return; }
    const handle = setTimeout(() => {
      searchPatients(term).then(({ data }) => setPatientResults(data)).catch(() => {});
    }, 300);
    return () => clearTimeout(handle);
  }, [patientQuery, newPatientMode]);

  const statusLabel = (code: string) => statuses.find((s) => s.code === code)?.description || code;

  async function handleBook() {
    if (!clinicId || !departmentId || !doctorId || !selectedSlot) {
      notify('Επίλεξε κλινική, τμήμα, γιατρό και ώρα.', 'warning', 3500);
      return;
    }

    setBooking(true);
    try {
      let patient = selectedPatient;

      if (newPatientMode) {
        if (!newPatient.firstName.trim() || !newPatient.lastName.trim() || !newPatient.dateOfBirth) {
          notify('Συμπλήρωσε όνομα, επώνυμο και ημερομηνία γέννησης.', 'warning', 3500);
          return;
        }
        if (newPatient.email.trim() && !isValidEmail(newPatient.email)) {
          setNewPatientEmailTouched(true);
          notify('Το email δεν έχει έγκυρη μορφή.', 'warning', 3500);
          return;
        }
        const { data } = await createPatient({
          firstName: newPatient.firstName,
          lastName: newPatient.lastName,
          amka: newPatient.amka || undefined,
          dateOfBirth: newPatient.dateOfBirth,
          phone: newPatient.phone || undefined,
          email: newPatient.email || undefined,
        });
        patient = data;
      }

      if (!patient) {
        notify('Επίλεξε ασθενή ή δημιούργησε νέο.', 'warning', 3500);
        return;
      }

      await createAppointment({
        clinicId,
        departmentId,
        doctorId,
        patientId: patient.patientId,
        scheduledStart: selectedSlot.start,
        scheduledEnd: selectedSlot.end,
        reason: reason || undefined,
      });

      notify('Το ραντεβού καταχωρήθηκε.', 'success', 3000);
      setSelectedSlot(null);
      setSelectedPatient(null);
      setNewPatientMode(false);
      setNewPatient({ firstName: '', lastName: '', amka: '', dateOfBirth: '', phone: '', email: '' });
      setNewPatientEmailTouched(false);
      setPatientQuery('');
      setReason('');
      getDoctorAvailability(doctorId, toIsoDate(date)).then(({ data }) => setSlots(data));
      loadAppointments();
    } catch (err) {
      notify(getErrorMessage(err, 'Η καταχώρηση απέτυχε.'), 'error', 4500);
    } finally {
      setBooking(false);
    }
  }

  async function applyStatusChange(appt: AppointmentDto, statusId: number, label: string, reasonText?: string) {
    try {
      await changeAppointmentStatus(appt.appointmentId, statusId, reasonText || undefined);
      notify(`Το ραντεβού ενημερώθηκε: ${label}.`, 'success', 2500);
      loadAppointments();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    }
  }

  function handleStatusChange(appt: AppointmentDto, statusId: number, label: string) {
    // Cancel/no-show always ask why — it's the one thing worth capturing for
    // later (patient called to cancel? clinic closed? just didn't show?).
    if (statusId === APPOINTMENT_STATUS.Cancelled || statusId === APPOINTMENT_STATUS.NoShow) {
      setReasonPrompt({ appt, statusId, label });
      return;
    }
    applyStatusChange(appt, statusId, label);
  }

  if (!isStaff) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Αυτή η οθόνη είναι διαθέσιμη μόνο σε reception / admin.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ρεσεψιόν — Κρατήσεις</h1>
        <p className="text-sm text-muted-foreground">Αναζήτηση ασθενή, διαθεσιμότητα γιατρού και διαχείριση ραντεβού.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Επιλογή γιατρού</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <Label className="mb-1.5 block">Κλινική</Label>
            <SelectBox
              dataSource={clinics}
              valueExpr="clinicId"
              displayExpr="name"
              value={clinicId}
              onValueChanged={(e) => setClinicId(e.value)}
              placeholder="Επίλεξε κλινική"
              searchEnabled
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Τμήμα</Label>
            <SelectBox
              dataSource={departments}
              valueExpr="id"
              displayExpr="text"
              value={departmentId}
              onValueChanged={(e) => setDepartmentId(e.value)}
              placeholder="Όλα τα τμήματα"
              disabled={!clinicId}
              searchEnabled
              showClearButton
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Γιατρός</Label>
            <SelectBox
              dataSource={doctors}
              valueExpr="id"
              displayExpr="text"
              value={doctorId}
              onValueChanged={(e) => setDoctorId(e.value)}
              placeholder="Επίλεξε γιατρό"
              disabled={!clinicId}
              searchEnabled
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Ημερομηνία</Label>
            <DateBox
              value={date}
              onValueChanged={(e) => e.value && setDate(e.value as Date)}
              type="date"
              displayFormat="dd/MM/yyyy"
              min={new Date()}
            />
          </div>
        </CardContent>
      </Card>

      {doctorId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── Booking panel ────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Νέα κράτηση</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Ασθενής</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setNewPatientMode((v) => !v); setSelectedPatient(null); setNewPatientEmailTouched(false); }}
                  >
                    {newPatientMode ? (
                      <><X className="h-3.5 w-3.5 mr-1" /> Άκυρο</>
                    ) : (
                      <><UserPlus className="h-3.5 w-3.5 mr-1" /> Νέος ασθενής</>
                    )}
                  </Button>
                </div>

                {!newPatientMode ? (
                  selectedPatient ? (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span>
                        {selectedPatient.lastName} {selectedPatient.firstName}
                        {selectedPatient.amka ? ` — ΑΜΚΑ ${selectedPatient.amka}` : ''}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" title="Ιστορικό ραντεβού" onClick={() => setHistoryPatient(selectedPatient)}>
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        placeholder="Όνομα, επώνυμο, ΑΜΚΑ ή τηλέφωνο..."
                        value={patientQuery}
                        onChange={(e) => setPatientQuery(e.target.value)}
                      />
                      {patientResults.length > 0 && (
                        <div className="mt-1 rounded-md border divide-y max-h-48 overflow-y-auto">
                          {patientResults.map((p) => (
                            <button
                              type="button"
                              key={p.patientId}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                              onClick={() => { setSelectedPatient(p); setPatientResults([]); setPatientQuery(''); }}
                            >
                              {p.lastName} {p.firstName}{p.amka ? ` — ΑΜΚΑ ${p.amka}` : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Όνομα" value={newPatient.firstName} onChange={(e) => setNewPatient((v) => ({ ...v, firstName: e.target.value }))} />
                    <Input placeholder="Επώνυμο" value={newPatient.lastName} onChange={(e) => setNewPatient((v) => ({ ...v, lastName: e.target.value }))} />
                    <Input type="date" value={newPatient.dateOfBirth} onChange={(e) => setNewPatient((v) => ({ ...v, dateOfBirth: e.target.value }))} />
                    <Input placeholder="ΑΜΚΑ (προαιρετικό)" value={newPatient.amka} onChange={(e) => setNewPatient((v) => ({ ...v, amka: e.target.value }))} />
                    <Input placeholder="Τηλέφωνο" value={newPatient.phone} onChange={(e) => setNewPatient((v) => ({ ...v, phone: e.target.value }))} />
                    <div>
                      <Input
                        type="email"
                        placeholder="Email"
                        value={newPatient.email}
                        aria-invalid={newPatientEmailInvalid || undefined}
                        onChange={(e) => setNewPatient((v) => ({ ...v, email: e.target.value }))}
                        onBlur={() => setNewPatientEmailTouched(true)}
                      />
                      {newPatientEmailInvalid && <p className="mt-1 text-xs text-destructive">Μη έγκυρη μορφή email.</p>}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-1.5 block">Διαθέσιμες ώρες — {format(date, 'dd/MM/yyyy')}</Label>
                {slotsLoading ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <LoaderCircleIcon className="h-4 w-4 animate-spin" /> Φόρτωση...
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Δεν υπάρχει διαθεσιμότητα αυτή την ημέρα.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {slots.map((s) => (
                      <Button
                        key={s.start}
                        type="button"
                        size="sm"
                        variant={selectedSlot?.start === s.start ? 'primary' : 'outline'}
                        onClick={() => setSelectedSlot(s)}
                      >
                        {format(new Date(s.start), 'HH:mm')}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-1.5 block">Αιτία (προαιρετικό)</Label>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>

              <Button className="w-full" disabled={booking || !selectedSlot} onClick={handleBook}>
                {booking ? (
                  <span className="flex items-center gap-2"><LoaderCircleIcon className="h-4 w-4 animate-spin" /> Καταχώρηση...</span>
                ) : (
                  'Κράτηση ραντεβού'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* ── Today's list ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Ραντεβού — {format(date, 'dd/MM/yyyy')}</CardTitle></CardHeader>
            <CardContent>
              <DataGrid
                dataSource={appointments}
                keyExpr="appointmentId"
                showBorders
                columnAutoWidth
                loadPanel={{ enabled: appointmentsLoading }}
                noDataText="Δεν υπάρχουν ραντεβού."
              >
                <FilterRow visible />
                <HeaderFilter visible />
                <Paging defaultPageSize={10} />
                <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
                <Column
                  dataField="scheduledStart"
                  caption="Ώρα"
                  width={80}
                  calculateCellValue={(row: AppointmentDto) => format(new Date(row.scheduledStart), 'HH:mm')}
                />
                <Column dataField="patientName" caption="Ασθενής" />
                <Column
                  dataField="statusCode"
                  caption="Κατάσταση"
                  width={130}
                  cellRender={({ data }: { data: AppointmentDto }) => (
                    <Badge variant={STATUS_BADGE_VARIANT[data.statusCode] ?? 'secondary'} size="sm">
                      {statusLabel(data.statusCode)}
                    </Badge>
                  )}
                />
                <Column
                  caption="Ενέργειες"
                  width={340}
                  cellRender={({ data }: { data: AppointmentDto }) => {
                    const actions = getAvailableActions(data.statusCode);
                    return (
                      <div className="flex flex-wrap gap-1">
                        {actions.canConfirm && (
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(data, APPOINTMENT_STATUS.Confirmed, 'Επιβεβαιώθηκε')}>
                            Επιβεβαίωση
                          </Button>
                        )}
                        {actions.canCheckIn && (
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(data, APPOINTMENT_STATUS.CheckedIn, 'Άφιξη')}>
                            Άφιξη
                          </Button>
                        )}
                        {actions.canComplete && (
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(data, APPOINTMENT_STATUS.Completed, 'Ολοκληρώθηκε')}>
                            Ολοκλήρωση
                          </Button>
                        )}
                        {actions.canReschedule && (
                          <Button size="sm" variant="outline" onClick={() => setRescheduleTarget(data)}>
                            Αλλαγή ώρας
                          </Button>
                        )}
                        {actions.canNoShow && (
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(data, APPOINTMENT_STATUS.NoShow, 'Μη προσέλευση')}>
                            Μη προσέλευση
                          </Button>
                        )}
                        {actions.canCancel && (
                          <Button size="sm" variant="destructive" onClick={() => handleStatusChange(data, APPOINTMENT_STATUS.Cancelled, 'Ακυρώθηκε')}>
                            Ακύρωση
                          </Button>
                        )}
                      </div>
                    );
                  }}
                />
              </DataGrid>
            </CardContent>
          </Card>
        </div>
      )}

      {rescheduleTarget && (
        <RescheduleAppointmentDialog
          appointment={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onDone={() => { setRescheduleTarget(null); loadAppointments(); }}
        />
      )}

      {reasonPrompt && (
        <ReasonPromptDialog
          open
          title={reasonPrompt.statusId === APPOINTMENT_STATUS.Cancelled ? 'Ακύρωση ραντεβού' : 'Καταγραφή μη προσέλευσης'}
          description={`${reasonPrompt.appt.patientName} — ${format(new Date(reasonPrompt.appt.scheduledStart), 'dd/MM/yyyy HH:mm')}`}
          confirmLabel={reasonPrompt.statusId === APPOINTMENT_STATUS.Cancelled ? 'Ακύρωση' : 'Καταγραφή'}
          onCancel={() => setReasonPrompt(null)}
          onConfirm={(reasonText) => {
            applyStatusChange(reasonPrompt.appt, reasonPrompt.statusId, reasonPrompt.label, reasonText);
            setReasonPrompt(null);
          }}
        />
      )}

      {historyPatient && (
        <PatientHistoryDialog
          patientId={historyPatient.patientId}
          patientName={`${historyPatient.lastName} ${historyPatient.firstName}`}
          open
          onOpenChange={(open) => !open && setHistoryPatient(null)}
        />
      )}
    </div>
  );
}
