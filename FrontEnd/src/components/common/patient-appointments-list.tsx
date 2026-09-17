import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { CalendarPlus } from 'lucide-react';
import { ReasonPromptDialog } from '@/components/common/reason-prompt-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  APPOINTMENT_STATUS,
  AppointmentDto,
  STATUS_BADGE_VARIANT,
  changeAppointmentStatus,
  getAppointments,
  getErrorMessage,
} from '@/services/hospital-api';

const STATUS_LABELS: Record<string, string> = {
  Scheduled: 'Προγραμματισμένο', Confirmed: 'Επιβεβαιωμένο', CheckedIn: 'Άφιξη',
  Completed: 'Ολοκληρωμένο', Cancelled: 'Ακυρωμένο', NoShow: 'Μη προσέλευση', Rescheduled: 'Μετατεθειμένο',
};

interface Props {
  mode: 'upcoming' | 'history';
}

// Backing component for both "Επερχόμενα" and "Ιστορικό" — the backend
// already scopes /Appointments to the caller's own record for a Patient, so
// the only difference between the two screens is which half of the list
// (by scheduledStart vs now) they show and whether cancellation is offered.
export function PatientAppointmentsList({ mode }: Props) {
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<AppointmentDto | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = () => {
    setLoading(true);
    const now = new Date().toISOString();
    const params = mode === 'upcoming' ? { from: now } : { to: now };
    getAppointments(params)
      .then(({ data }) => {
        const sorted = [...data].sort((a, b) =>
          mode === 'upcoming'
            ? a.scheduledStart.localeCompare(b.scheduledStart)
            : b.scheduledStart.localeCompare(a.scheduledStart)
        );
        setAppointments(sorted);
      })
      .catch(() => notify('Αποτυχία φόρτωσης ραντεβού.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, [mode]);

  async function confirmCancel(reason: string) {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await changeAppointmentStatus(cancelTarget.appointmentId, APPOINTMENT_STATUS.Cancelled, reason || undefined);
      notify('Το ραντεβού ακυρώθηκε.', 'success', 2500);
      setCancelTarget(null);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ακύρωση απέτυχε.'), 'error', 4500);
    } finally {
      setCancelling(false);
    }
  }

  const canCancel = (a: AppointmentDto) => ['Scheduled', 'Confirmed', 'Rescheduled'].includes(a.statusCode);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{mode === 'upcoming' ? 'Επερχόμενα Ραντεβού' : 'Ιστορικό Ραντεβού'}</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'upcoming' ? 'Τα προγραμματισμένα ραντεβού σου.' : 'Τα προηγούμενα ραντεβού σου.'}
          </p>
        </div>
        {mode === 'upcoming' && (
          <Button asChild>
            <Link to="/patient/book-appointment"><CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Νέο Ραντεβού</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataGrid
            dataSource={appointments}
            keyExpr="appointmentId"
            showBorders
            columnAutoWidth
            loadPanel={{ enabled: loading }}
            noDataText={mode === 'upcoming' ? 'Δεν έχεις προγραμματισμένα ραντεβού.' : 'Δεν υπάρχει ιστορικό ραντεβού.'}
          >
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={10} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
            <Column
              dataField="scheduledStart"
              caption="Ημερομηνία / Ώρα"
              width={170}
              calculateCellValue={(row: AppointmentDto) => format(new Date(row.scheduledStart), 'dd/MM/yyyy HH:mm')}
            />
            <Column dataField="doctorName" caption="Γιατρός" />
            <Column
              dataField="statusCode"
              caption="Κατάσταση"
              width={140}
              cellRender={({ data }: { data: AppointmentDto }) => (
                <Badge variant={STATUS_BADGE_VARIANT[data.statusCode] ?? 'secondary'} size="sm">
                  {STATUS_LABELS[data.statusCode] ?? data.statusCode}
                </Badge>
              )}
            />
            <Column dataField="reason" caption="Αιτία" calculateCellValue={(row: AppointmentDto) => row.reason ?? '—'} />
            {mode === 'upcoming' && (
              <Column
                caption="Ενέργειες"
                width={120}
                cellRender={({ data }: { data: AppointmentDto }) =>
                  canCancel(data) ? (
                    <Button size="sm" variant="destructive" onClick={() => setCancelTarget(data)}>Ακύρωση</Button>
                  ) : null
                }
              />
            )}
          </DataGrid>
        </CardContent>
      </Card>

      {cancelTarget && (
        <ReasonPromptDialog
          open
          title="Ακύρωση ραντεβού"
          description={`${cancelTarget.doctorName} — ${format(new Date(cancelTarget.scheduledStart), 'dd/MM/yyyy HH:mm')}`}
          confirmLabel={cancelling ? 'Ακύρωση...' : 'Ακύρωση ραντεβού'}
          onCancel={() => setCancelTarget(null)}
          onConfirm={(reasonText) => confirmCancel(reasonText)}
        />
      )}
    </div>
  );
}
