import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import Scheduler, { Resource } from 'devextreme-react/scheduler';
import SelectBox from 'devextreme-react/select-box';
import notify from 'devextreme/ui/notify';
import { LoaderCircleIcon, RefreshCw } from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { ReasonPromptDialog } from '@/components/common/reason-prompt-dialog';
import { RescheduleAppointmentDialog } from '@/components/common/reschedule-appointment-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  APPOINTMENT_STATUS,
  AppointmentDto,
  ClinicDto,
  LookupItemDto,
  STATUS_BADGE_VARIANT,
  StatusLookupDto,
  changeAppointmentStatus,
  getAppointmentStatuses,
  getAppointments,
  getAvailableActions,
  FullDoctorDto,
  getClinics,
  getErrorMessage,
  getLookupDoctors,
  getOwnDoctor,
} from '@/services/hospital-api';

const WINDOW_DAYS_BACK = 14;
const WINDOW_DAYS_FORWARD = 45;

function windowRange() {
  const from = new Date();
  from.setDate(from.getDate() - WINDOW_DAYS_BACK);
  const to = new Date();
  to.setDate(to.getDate() + WINDOW_DAYS_FORWARD);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function CalendarPage() {
  const { currentUser } = useAuth();
  const isDoctorOnly = !!currentUser?.roles.includes('Doctor') &&
    !currentUser.roles.some((r) => ['Admin', 'SuperUser', 'ClinicManager', 'Reception'].includes(r));

  const [ownDoctor, setOwnDoctor] = useState<FullDoctorDto | null>(null);

  const [clinics, setClinics] = useState<ClinicDto[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<LookupItemDto[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);

  // A Doctor gets their own calendar auto-loaded, no picker — same
  // self-service pattern as schedules.tsx.
  const effectiveClinicId = isDoctorOnly ? ownDoctor?.clinicId ?? null : clinicId;
  const effectiveDoctorId = isDoctorOnly ? ownDoctor?.doctorId ?? null : doctorId;

  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [statuses, setStatuses] = useState<StatusLookupDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedAppt, setSelectedAppt] = useState<AppointmentDto | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentDto | null>(null);
  const [reasonPrompt, setReasonPrompt] = useState<{ appt: AppointmentDto; statusId: number; label: string } | null>(null);

  useEffect(() => {
    if (isDoctorOnly) {
      getOwnDoctor().then(({ data }) => setOwnDoctor(data)).catch(() => notify('Δεν βρέθηκε ο λογαριασμός γιατρού.', 'error', 4000));
    } else {
      getClinics().then(({ data }) => {
        setClinics(data);
        if (data.length === 1) setClinicId(data[0].clinicId);
      }).catch(() => notify('Αποτυχία φόρτωσης κλινικών.', 'error', 4000));
    }
    getAppointmentStatuses().then(({ data }) => setStatuses(data)).catch(() => {});
  }, [isDoctorOnly]);

  useEffect(() => {
    if (isDoctorOnly) return;
    setDoctorId(null);
    if (!clinicId) { setDoctors([]); return; }
    getLookupDoctors(clinicId).then(({ data }) => setDoctors(data)).catch(() => {});
  }, [clinicId, isDoctorOnly]);

  const load = () => {
    if (!effectiveClinicId) { setAppointments([]); return; }
    setLoading(true);
    const { from, to } = windowRange();
    getAppointments({ clinicId: effectiveClinicId, doctorId: effectiveDoctorId ?? undefined, from, to })
      .then(({ data }) => setAppointments(data))
      .catch(() => notify('Αποτυχία φόρτωσης ραντεβού.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, [effectiveClinicId, effectiveDoctorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel = (code: string) => statuses.find((s) => s.code === code)?.description || code;

  const events = useMemo(
    () => appointments.map((a) => ({ ...a, text: `${a.patientName} — ${statusLabel(a.statusCode)}` })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, statuses]
  );

  const doctorResources = useMemo(() => doctors.map((d) => ({ id: d.id, text: d.text })), [doctors]);

  async function applyStatusChange(appt: AppointmentDto, statusId: number, label: string, reasonText?: string) {
    try {
      await changeAppointmentStatus(appt.appointmentId, statusId, reasonText || undefined);
      notify(`Το ραντεβού ενημερώθηκε: ${label}.`, 'success', 2500);
      setSelectedAppt(null);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    }
  }

  function handleStatusChange(appt: AppointmentDto, statusId: number, label: string) {
    if (statusId === APPOINTMENT_STATUS.Cancelled || statusId === APPOINTMENT_STATUS.NoShow) {
      setReasonPrompt({ appt, statusId, label });
      return;
    }
    applyStatusChange(appt, statusId, label);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{isDoctorOnly ? 'Το Ημερολόγιό μου' : 'Ημερολόγιο'}</h1>
          <p className="text-sm text-muted-foreground">
            {isDoctorOnly ? 'Το πρόγραμμά σου — κλικ σε ραντεβού για ενέργειες.' : 'Οπτική προβολή ραντεβού ανά κλινική/γιατρό — κλικ σε ραντεβού για ενέργειες.'}
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <LoaderCircleIcon className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />} Ανανέωση
        </Button>
      </div>

      {isDoctorOnly ? (
        ownDoctor && (
          <Card>
            <CardContent className="pt-6 text-sm">
              <span className="text-muted-foreground">Πρόγραμμα για:</span> <span className="font-medium">{ownDoctor.fullName}</span> — {ownDoctor.clinicName} / {ownDoctor.departmentName}
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Κλινική / Γιατρός</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <Label className="mb-1.5 block">Κλινική</Label>
              <SelectBox dataSource={clinics} valueExpr="clinicId" displayExpr="name" value={clinicId} onValueChanged={(e) => setClinicId(e.value)} placeholder="Επίλεξε κλινική" searchEnabled />
            </div>
            <div>
              <Label className="mb-1.5 block">Γιατρός</Label>
              <SelectBox
                dataSource={doctors}
                valueExpr="id"
                displayExpr="text"
                value={doctorId}
                onValueChanged={(e) => setDoctorId(e.value)}
                placeholder="Όλοι οι γιατροί (ομαδοποίηση)"
                disabled={!clinicId}
                searchEnabled
                showClearButton
              />
            </div>
          </CardContent>
        </Card>
      )}

      {effectiveClinicId && (
        <Card>
          <CardContent className="pt-6">
            <Scheduler
              dataSource={events}
              startDateExpr="scheduledStart"
              endDateExpr="scheduledEnd"
              textExpr="text"
              views={['day', 'week']}
              defaultCurrentView="week"
              height={650}
              firstDayOfWeek={1}
              startDayHour={7}
              endDayHour={21}
              showCurrentTimeIndicator
              editing={{ allowAdding: false, allowDeleting: false, allowDragging: false, allowResizing: false, allowUpdating: false }}
              onAppointmentClick={(e) => {
                e.cancel = true;
                const apptId = (e.appointmentData as AppointmentDto).appointmentId;
                const appt = appointments.find((a) => a.appointmentId === apptId);
                if (appt) setSelectedAppt(appt);
              }}
              onAppointmentDblClick={(e) => { e.cancel = true; }}
              groups={effectiveDoctorId ? undefined : ['doctorId']}
              loadPanel={{ enabled: loading }}
              noDataText="Δεν υπάρχουν ραντεβού σε αυτό το διάστημα."
            >
              {!effectiveDoctorId && <Resource fieldExpr="doctorId" dataSource={doctorResources} label="Γιατρός" />}
            </Scheduler>
          </CardContent>
        </Card>
      )}

      {selectedAppt && (
        <Dialog open onOpenChange={(open) => !open && setSelectedAppt(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{selectedAppt.patientName}</DialogTitle></DialogHeader>
            <DialogBody className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {format(new Date(selectedAppt.scheduledStart), 'dd/MM/yyyy HH:mm')}–{format(new Date(selectedAppt.scheduledEnd), 'HH:mm')} — {selectedAppt.doctorName}
              </div>
              <Badge variant={STATUS_BADGE_VARIANT[selectedAppt.statusCode] ?? 'secondary'} size="sm">{statusLabel(selectedAppt.statusCode)}</Badge>
              {selectedAppt.reason && <p className="text-sm">{selectedAppt.reason}</p>}

              {(() => {
                const actions = getAvailableActions(selectedAppt.statusCode);
                return (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {actions.canConfirm && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedAppt, APPOINTMENT_STATUS.Confirmed, 'Επιβεβαιώθηκε')}>Επιβεβαίωση</Button>
                    )}
                    {actions.canCheckIn && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedAppt, APPOINTMENT_STATUS.CheckedIn, 'Άφιξη')}>Άφιξη</Button>
                    )}
                    {actions.canComplete && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedAppt, APPOINTMENT_STATUS.Completed, 'Ολοκληρώθηκε')}>Ολοκλήρωση</Button>
                    )}
                    {actions.canReschedule && (
                      <Button size="sm" variant="outline" onClick={() => { setRescheduleTarget(selectedAppt); setSelectedAppt(null); }}>Αλλαγή ώρας</Button>
                    )}
                    {actions.canNoShow && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedAppt, APPOINTMENT_STATUS.NoShow, 'Μη προσέλευση')}>Μη προσέλευση</Button>
                    )}
                    {actions.canCancel && (
                      <Button size="sm" variant="destructive" onClick={() => handleStatusChange(selectedAppt, APPOINTMENT_STATUS.Cancelled, 'Ακυρώθηκε')}>Ακύρωση</Button>
                    )}
                  </div>
                );
              })()}
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

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
    </div>
  );
}
