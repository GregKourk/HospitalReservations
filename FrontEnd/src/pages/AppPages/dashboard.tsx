import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import {
  Building2, CalendarCheck, CalendarClock, CalendarX, LoaderCircleIcon, Stethoscope, UserRoundX, Users, UsersRound,
} from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { ReasonPromptDialog } from '@/components/common/reason-prompt-dialog';
import { RescheduleAppointmentDialog } from '@/components/common/reschedule-appointment-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ACTION_LABELS_FALLBACK } from '@/lib/action-labels';
import {
  APPOINTMENT_STATUS,
  AppointmentDto,
  DashboardSummaryDto,
  STATUS_BADGE_VARIANT,
  StatusLookupDto,
  changeAppointmentStatus,
  getAppointmentStatuses,
  getAppointments,
  getAvailableActions,
  getDashboardSummary,
  getErrorMessage,
} from '@/services/hospital-api';

const STATUS_LABELS: Record<string, string> = {
  Scheduled: 'Προγραμματισμένα', Confirmed: 'Επιβεβαιωμένα', CheckedIn: 'Άφιξη',
  Completed: 'Ολοκληρωμένα', Cancelled: 'Ακυρωμένα', NoShow: 'Μη προσέλευση', Rescheduled: 'Μετατεθειμένα',
};

function KpiCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-4">
        <div className="rounded-full bg-primary/10 p-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-2xl font-semibold leading-tight">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const isAdmin = !!currentUser?.roles.some((r) => r === 'Admin' || r === 'SuperUser');
  const isClinicManager = !!currentUser?.roles.includes('ClinicManager') && !isAdmin;
  const isDoctorOnly = !!currentUser?.roles.includes('Doctor') && !isAdmin;

  if (isAdmin) return <AdminDashboard scope="system" />;
  if (isClinicManager) return <AdminDashboard scope="clinic" />;
  if (isDoctorOnly) {
    return <DailyDeskDashboard subtitlePrefix="Σημερινό πρόγραμμα" primaryAction={{ label: 'Το Ημερολόγιό μου', to: '/admin/calendar' }} />;
  }
  return <DailyDeskDashboard subtitlePrefix="Ημερήσια όψη" primaryAction={{ label: 'Νέα κράτηση', to: '/reception' }} />;
}

// ── Admin/SuperUser: system-wide KPIs — same shape scoped to "their own
// clinic" for a ClinicManager, since /Dashboard/Summary already does the
// scoping server-side. ───────────────────────────────────────────────────────

function AdminDashboard({ scope }: { scope: 'system' | 'clinic' }) {
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardSummary()
      .then(({ data }) => setSummary(data))
      .catch(() => notify('Αποτυχία φόρτωσης στοιχείων.', 'error', 4000))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex justify-center py-16">
        <LoaderCircleIcon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Πίνακας Ελέγχου</h1>
        <p className="text-sm text-muted-foreground">
          {scope === 'clinic' ? 'Σύνοψη κλινικής — δεδομένα σε πραγματικό χρόνο.' : 'Σύνοψη συστήματος — δεδομένα σε πραγματικό χρόνο.'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {scope === 'system' && <KpiCard icon={Building2} label="Κλινικές" value={summary.totalClinics} />}
        {scope === 'clinic' && <KpiCard icon={Building2} label="Τμήματα" value={summary.totalDepartments} />}
        <KpiCard icon={Stethoscope} label="Γιατροί" value={summary.totalDoctors} />
        <KpiCard icon={UsersRound} label="Ασθενείς" value={summary.totalPatients} />
        <KpiCard icon={Users} label={scope === 'clinic' ? 'Ενεργοί γιατροί' : 'Ενεργοί χρήστες'} value={summary.totalActiveUsers} />
        <KpiCard icon={CalendarClock} label="Ραντεβού (7 ημέρες)" value={summary.appointmentsThisWeek} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card>
          <CardHeader><CardTitle className="text-base">Ραντεβού σήμερα</CardTitle></CardHeader>
          <CardContent>
            {summary.appointmentsToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν ραντεβού σήμερα.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {summary.appointmentsToday.map((s) => (
                  <Badge key={s.statusCode} variant="secondary" size="sm">
                    {STATUS_LABELS[s.statusCode] ?? s.statusCode}: {s.count}
                  </Badge>
                ))}
              </div>
            )}
            <Link to="/admin/appointments" className="text-sm text-primary hover:underline mt-4 inline-block">
              Προβολή όλων των ραντεβού →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Τελευταίες 30 ημέρες</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <CalendarX className="h-4 w-4 text-destructive" />
              <span className="text-sm">Ακυρώσεις</span>
              <span className="ml-auto font-semibold">{summary.cancellationsLast30Days}</span>
            </div>
            <div className="flex items-center gap-3">
              <UserRoundX className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Μη προσέλευση</span>
              <span className="ml-auto font-semibold">{summary.noShowsLast30Days}</span>
            </div>
            <Link to="/admin/reports" className="text-sm text-primary hover:underline mt-2 inline-block">
              Λεπτομερείς αναφορές →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Πρόσφατη δραστηριότητα</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {summary.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Καμία πρόσφατη δραστηριότητα.</p>
            ) : (
              summary.recentActivity.slice(0, 6).map((a, i) => (
                <div key={i} className="text-xs flex items-center gap-2 border-b last:border-0 pb-1.5 last:pb-0">
                  <span className="text-muted-foreground whitespace-nowrap">{format(new Date(a.timestamp), 'dd/MM HH:mm')}</span>
                  <span className="truncate">{a.userName ?? '—'}</span>
                  <span className="text-muted-foreground truncate">{ACTION_LABELS_FALLBACK[a.actionType] ?? a.actionType} · {a.entityType}</span>
                </div>
              ))
            )}
            {scope === 'system' && (
              <Link to="/admin/audit-log" className="text-sm text-primary hover:underline mt-2 inline-block">
                Πλήρες ιστορικό →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Reception (and anyone else without Admin/SuperUser): today's desk ───────

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
}

function DailyDeskDashboard({ subtitlePrefix, primaryAction }: { subtitlePrefix: string; primaryAction: { label: string; to: string } }) {
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [statuses, setStatuses] = useState<StatusLookupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentDto | null>(null);
  const [reasonPrompt, setReasonPrompt] = useState<{ appt: AppointmentDto; statusId: number; label: string } | null>(null);

  const load = () => {
    setLoading(true);
    const { start, end } = todayRange();
    Promise.all([
      getAppointments({ from: start.toISOString(), to: end.toISOString() }),
      getAppointmentStatuses(),
    ])
      .then(([a, s]) => {
        setAppointments([...a.data].sort((x, y) => x.scheduledStart.localeCompare(y.scheduledStart)));
        setStatuses(s.data);
      })
      .catch(() => notify('Αποτυχία φόρτωσης ραντεβού.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const statusLabel = (code: string) => statuses.find((s) => s.code === code)?.description || code;

  const counts = useMemo(() => {
    const byCode: Record<string, number> = {};
    appointments.forEach((a) => { byCode[a.statusCode] = (byCode[a.statusCode] ?? 0) + 1; });
    return byCode;
  }, [appointments]);

  const patientsToday = useMemo(() => new Set(appointments.map((a) => a.patientId)).size, [appointments]);

  async function applyStatusChange(appt: AppointmentDto, statusId: number, label: string, reasonText?: string) {
    try {
      await changeAppointmentStatus(appt.appointmentId, statusId, reasonText || undefined);
      notify(`Το ραντεβού ενημερώθηκε: ${label}.`, 'success', 2500);
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
          <h1 className="text-2xl font-semibold tracking-tight">Πίνακας Ελέγχου</h1>
          <p className="text-sm text-muted-foreground">{subtitlePrefix} — {format(new Date(), 'EEEE dd/MM/yyyy', { locale: el })}.</p>
        </div>
        <Button asChild>
          <Link to={primaryAction.to}>{primaryAction.label}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={CalendarClock} label="Ραντεβού σήμερα" value={appointments.length} />
        <KpiCard icon={UsersRound} label="Ασθενείς σήμερα" value={patientsToday} />
        <KpiCard icon={CalendarCheck} label="Έχουν έρθει" value={(counts.CheckedIn ?? 0) + (counts.Completed ?? 0)} />
        <KpiCard icon={CalendarX} label="Ακυρώσεις / Μη προσέλευση" value={(counts.Cancelled ?? 0) + (counts.NoShow ?? 0)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ραντεβού σήμερα</CardTitle></CardHeader>
        <CardContent>
          <DataGrid dataSource={appointments} keyExpr="appointmentId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχουν ραντεβού σήμερα.">
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={10} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
            <Column dataField="scheduledStart" caption="Ώρα" width={90} calculateCellValue={(row: AppointmentDto) => format(new Date(row.scheduledStart), 'HH:mm')} />
            <Column dataField="doctorName" caption="Γιατρός" />
            <Column dataField="patientName" caption="Ασθενής" />
            <Column
              dataField="statusCode"
              caption="Κατάσταση"
              width={140}
              cellRender={({ data }: { data: AppointmentDto }) => (
                <Badge variant={STATUS_BADGE_VARIANT[data.statusCode] ?? 'secondary'} size="sm">{statusLabel(data.statusCode)}</Badge>
              )}
            />
            <Column
              caption="Ενέργειες"
              width={340}
              cellRender={({ data }: { data: AppointmentDto }) => {
                const actions = getAvailableActions(data.statusCode);
                return (
                  <div className="flex flex-wrap gap-1">
                    {actions.canConfirm && <Button size="sm" variant="outline" onClick={() => handleStatusChange(data, APPOINTMENT_STATUS.Confirmed, 'Επιβεβαιώθηκε')}>Επιβεβαίωση</Button>}
                    {actions.canCheckIn && <Button size="sm" variant="outline" onClick={() => handleStatusChange(data, APPOINTMENT_STATUS.CheckedIn, 'Άφιξη')}>Άφιξη</Button>}
                    {actions.canComplete && <Button size="sm" variant="outline" onClick={() => handleStatusChange(data, APPOINTMENT_STATUS.Completed, 'Ολοκληρώθηκε')}>Ολοκλήρωση</Button>}
                    {actions.canReschedule && <Button size="sm" variant="outline" onClick={() => setRescheduleTarget(data)}>Αλλαγή ώρας</Button>}
                    {actions.canNoShow && <Button size="sm" variant="outline" onClick={() => handleStatusChange(data, APPOINTMENT_STATUS.NoShow, 'Μη προσέλευση')}>Μη προσέλευση</Button>}
                    {actions.canCancel && <Button size="sm" variant="destructive" onClick={() => handleStatusChange(data, APPOINTMENT_STATUS.Cancelled, 'Ακυρώθηκε')}>Ακύρωση</Button>}
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
    </div>
  );
}
