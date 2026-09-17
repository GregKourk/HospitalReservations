import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import SelectBox from 'devextreme-react/select-box';
import DateBox from 'devextreme-react/date-box';
import notify from 'devextreme/ui/notify';
import { LayoutGrid, Search, X } from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { ReasonPromptDialog } from '@/components/common/reason-prompt-dialog';
import { RescheduleAppointmentDialog } from '@/components/common/reschedule-appointment-dialog';
import { SummaryDialog } from '@/components/common/summary-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  APPOINTMENT_STATUS,
  AppointmentDto,
  ClinicDto,
  LookupItemDto,
  PatientDto,
  STATUS_BADGE_VARIANT,
  StatusLookupDto,
  changeAppointmentStatus,
  getAppointmentStatuses,
  getAppointments,
  getAvailableActions,
  getClinics,
  getErrorMessage,
  getLookupDepartments,
  getLookupDoctors,
  searchPatients,
} from '@/services/hospital-api';

const STAFF_ROLES = ['Admin', 'SuperUser', 'ClinicManager', 'Reception'];

function toIso(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm:ss");
}

export default function AppointmentsPage() {
  const { currentUser } = useAuth();
  const isDoctorOnly = !!currentUser?.roles.includes('Doctor') &&
    !currentUser.roles.some((r) => STAFF_ROLES.includes(r));

  const [clinics, setClinics] = useState<ClinicDto[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);

  const [departments, setDepartments] = useState<LookupItemDto[]>([]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<LookupItemDto[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);

  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<PatientDto[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientDto | null>(null);

  const [statuses, setStatuses] = useState<StatusLookupDto[]>([]);
  const [statusId, setStatusId] = useState<number | null>(null);

  // No default date bound — a plain "Ραντεβού" search that silently hid
  // everything before today would bury past (e.g. already-completed)
  // appointments. Reception's daily view is the "today" screen; this one
  // isn't.
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentDto | null>(null);
  const [reasonPrompt, setReasonPrompt] = useState<{ appt: AppointmentDto; statusId: number; label: string } | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    // A ClinicManager's list is already scoped to their own clinic by the
    // backend, so it comes back with exactly one entry — auto-select it,
    // same convention as departments.tsx/doctors.tsx.
    getClinics().then(({ data }) => {
      setClinics(data);
      if (data.length === 1) setClinicId(data[0].clinicId);
    }).catch(() => notify('Αποτυχία φόρτωσης κλινικών.', 'error', 4000));
    getAppointmentStatuses().then(({ data }) => setStatuses(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setDepartmentId(null);
    setDoctorId(null);
    if (!clinicId) { setDepartments([]); return; }
    getLookupDepartments(clinicId).then(({ data }) => setDepartments(data)).catch(() => {});
  }, [clinicId]);

  useEffect(() => {
    setDoctorId(null);
    getLookupDoctors(clinicId ?? undefined, departmentId ?? undefined).then(({ data }) => setDoctors(data)).catch(() => {});
  }, [clinicId, departmentId]);

  useEffect(() => {
    if (patientQuery.trim().length < 2) { setPatientResults([]); return; }
    const handle = setTimeout(() => {
      searchPatients(patientQuery.trim()).then(({ data }) => setPatientResults(data)).catch(() => {});
    }, 300);
    return () => clearTimeout(handle);
  }, [patientQuery]);

  // Filters only take effect on "Εφαρμογή φίλτρων" (or Enter), not on every
  // keystroke/selection — accepts overrides so clearFilters() can apply a
  // reset immediately instead of racing React's async setState batching.
  const load = (overrides?: {
    clinicId?: string | null;
    doctorId?: string | null;
    patientId?: string;
    statusId?: number | null;
    fromDate?: Date | null;
    toDate?: Date | null;
  }) => {
    const p = {
      clinicId: overrides && 'clinicId' in overrides ? overrides.clinicId : clinicId,
      doctorId: overrides && 'doctorId' in overrides ? overrides.doctorId : doctorId,
      patientId: overrides && 'patientId' in overrides ? overrides.patientId : selectedPatient?.patientId,
      statusId: overrides && 'statusId' in overrides ? overrides.statusId : statusId,
      fromDate: overrides && 'fromDate' in overrides ? overrides.fromDate : fromDate,
      toDate: overrides && 'toDate' in overrides ? overrides.toDate : toDate,
    };
    setLoading(true);
    getAppointments({
      clinicId: p.clinicId ?? undefined,
      doctorId: p.doctorId ?? undefined,
      patientId: p.patientId,
      statusId: p.statusId ?? undefined,
      from: p.fromDate ? toIso(p.fromDate) : undefined,
      to: p.toDate ? toIso(p.toDate) : undefined,
    })
      .then(({ data }) => setAppointments(data))
      .catch(() => notify('Αποτυχία φόρτωσης ραντεβού.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []); // initial load only — subsequent loads are explicit

  const statusLabel = (code: string) => statuses.find((s) => s.code === code)?.description || code;

  async function applyStatusChange(appt: AppointmentDto, newStatusId: number, label: string, reasonText?: string) {
    try {
      await changeAppointmentStatus(appt.appointmentId, newStatusId, reasonText || undefined);
      notify(`Το ραντεβού ενημερώθηκε: ${label}.`, 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    }
  }

  function handleStatusChange(appt: AppointmentDto, newStatusId: number, label: string) {
    if (newStatusId === APPOINTMENT_STATUS.Cancelled || newStatusId === APPOINTMENT_STATUS.NoShow) {
      setReasonPrompt({ appt, statusId: newStatusId, label });
      return;
    }
    applyStatusChange(appt, newStatusId, label);
  }

  function clearFilters() {
    setClinicId(null);
    setDepartmentId(null);
    setDoctorId(null);
    setSelectedPatient(null);
    setPatientQuery('');
    setStatusId(null);
    setFromDate(null);
    setToDate(null);
    load({ clinicId: null, doctorId: null, patientId: undefined, statusId: null, fromDate: null, toDate: null });
  }

  // "Σημερινά / Επερχόμενα / Ιστορικό" — quick presets for the Doctor's own
  // scoped view (the backend already restricts results to their own
  // appointments regardless of clinic/doctor filters, which is why those
  // pickers are hidden for this role instead of just left non-functional).
  function applyDatePreset(preset: 'today' | 'upcoming' | 'history') {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    if (preset === 'today') {
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      setFromDate(todayStart); setToDate(todayEnd);
      load({ fromDate: todayStart, toDate: todayEnd });
    } else if (preset === 'upcoming') {
      setFromDate(todayStart); setToDate(null);
      load({ fromDate: todayStart, toDate: null });
    } else {
      const yesterdayEnd = new Date(todayStart); yesterdayEnd.setMilliseconds(-1);
      setFromDate(null); setToDate(yesterdayEnd);
      load({ fromDate: null, toDate: yesterdayEnd });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{isDoctorOnly ? 'Ραντεβού μου' : 'Ραντεβού'}</h1>
          <p className="text-sm text-muted-foreground">
            {isDoctorOnly
              ? 'Τα ραντεβού σου — σημερινά, επερχόμενα και ιστορικό.'
              : 'Όλα τα ραντεβού — αναζήτηση, επιβεβαίωση, άφιξη, ολοκλήρωση, μη προσέλευση, αλλαγή ώρας και ακύρωση.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => setSummaryOpen(true)}>
          <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Συγκεντρωτική προβολή
        </Button>
      </div>

      {isDoctorOnly && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => applyDatePreset('today')}>Σημερινά</Button>
          <Button size="sm" variant="outline" onClick={() => applyDatePreset('upcoming')}>Επερχόμενα</Button>
          <Button size="sm" variant="outline" onClick={() => applyDatePreset('history')}>Ιστορικό</Button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Φίλτρα</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${isDoctorOnly ? '' : 'lg:grid-cols-4'}`}>
            {!isDoctorOnly && (
              <>
                <div>
                  <Label className="mb-1.5 block">Κλινική</Label>
                  <SelectBox
                    dataSource={clinics}
                    valueExpr="clinicId"
                    displayExpr="name"
                    value={clinicId}
                    onValueChanged={(e) => setClinicId(e.value)}
                    placeholder="Όλες οι κλινικές"
                    showClearButton
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
                    showClearButton
                    searchEnabled
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
                    placeholder="Όλοι οι γιατροί"
                    showClearButton
                    searchEnabled
                  />
                </div>
              </>
            )}
            <div>
              <Label className="mb-1.5 block">Κατάσταση</Label>
              <SelectBox
                dataSource={statuses}
                valueExpr="id"
                displayExpr="description"
                value={statusId}
                onValueChanged={(e) => setStatusId(e.value)}
                placeholder="Όλες οι καταστάσεις"
                showClearButton
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="mb-1.5 block">Από</Label>
              <DateBox value={fromDate} onValueChanged={(e) => setFromDate(e.value ?? null)} type="date" displayFormat="dd/MM/yyyy" placeholder="Όλες οι ημερομηνίες" showClearButton />
            </div>
            <div>
              <Label className="mb-1.5 block">Έως</Label>
              <DateBox value={toDate} onValueChanged={(e) => setToDate(e.value ?? null)} type="date" displayFormat="dd/MM/yyyy" placeholder="Χωρίς όριο" showClearButton />
            </div>
            <div className="lg:col-span-2">
              <Label className="mb-1.5 block">Ασθενής</Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm h-9">
                  <span>{selectedPatient.lastName} {selectedPatient.firstName}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Αναζήτηση ασθενή..." value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
                  {patientResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md divide-y max-h-48 overflow-y-auto shadow-md">
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
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => load()}>Εφαρμογή φίλτρων</Button>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Καθαρισμός φίλτρων</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <DataGrid dataSource={appointments} keyExpr="appointmentId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν βρέθηκαν ραντεβού.">
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={20} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50, 100]} showInfo showNavigationButtons />
            <Column
              dataField="scheduledStart"
              caption="Ημ/νία & Ώρα"
              width={140}
              calculateCellValue={(row: AppointmentDto) => format(new Date(row.scheduledStart), 'dd/MM/yyyy HH:mm')}
            />
            <Column dataField="doctorName" caption="Γιατρός" />
            <Column dataField="patientName" caption="Ασθενής" />
            <Column dataField="reason" caption="Αιτία" />
            <Column
              dataField="statusCode"
              caption="Κατάσταση"
              width={140}
              cellRender={({ data }: { data: AppointmentDto }) => (
                <Badge variant={STATUS_BADGE_VARIANT[data.statusCode] ?? 'secondary'} size="sm">
                  {statusLabel(data.statusCode)}
                </Badge>
              )}
            />
            <Column
              caption="Ενέργειες"
              width={360}
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

      {rescheduleTarget && (
        <RescheduleAppointmentDialog
          appointment={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onDone={() => { setRescheduleTarget(null); load(); }}
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

      {/* Appointments are time-series, not a small master list — the summary
          exports whatever the filters above currently show rather than
          re-fetching an unbounded "everything ever". Widen the date filter
          first if a fuller export is needed. */}
      <SummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        title="Συγκεντρωτική προβολή — Ραντεβού"
        entityType="AppointmentsSummary"
        fileBaseName="Ραντεβού"
        keyExpr="appointmentId"
        dataSource={appointments}
        loading={loading}
      >
        <Column
          dataField="scheduledStart"
          caption="Ημ/νία & Ώρα"
          calculateCellValue={(row: AppointmentDto) => format(new Date(row.scheduledStart), 'dd/MM/yyyy HH:mm')}
        />
        <Column dataField="doctorName" caption="Γιατρός" />
        <Column dataField="patientName" caption="Ασθενής" />
        <Column dataField="statusCode" caption="Κατάσταση" calculateCellValue={(row: AppointmentDto) => statusLabel(row.statusCode)} />
        <Column dataField="reason" caption="Αιτία" />
      </SummaryDialog>
    </div>
  );
}
