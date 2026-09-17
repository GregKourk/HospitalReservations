import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { LoaderCircleIcon } from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { ReasonPromptDialog } from '@/components/common/reason-prompt-dialog';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LeaveRequestDto,
  cancelLeaveRequest,
  createLeaveRequest,
  getErrorMessage,
  getLeaveRequests,
  reviewLeaveRequest,
} from '@/services/hospital-api';

const STATUS_LABELS: Record<string, string> = {
  Pending: 'Εκκρεμεί', Approved: 'Εγκρίθηκε', Rejected: 'Απορρίφθηκε', Cancelled: 'Ακυρώθηκε',
};
const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  Pending: 'warning', Approved: 'success', Rejected: 'destructive', Cancelled: 'outline',
};

const EMPTY_FORM = { startDate: '', endDate: '', reason: '' };
const REVIEWER_ROLES = ['Admin', 'SuperUser', 'ClinicManager'];

export default function LeaveRequestsPage() {
  const { currentUser } = useAuth();
  const isReviewer = !!currentUser?.roles.some((r) => REVIEWER_ROLES.includes(r));
  const isDoctor = !!currentUser?.roles.includes('Doctor');

  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(isReviewer ? 'Pending' : '');

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<LeaveRequestDto | null>(null);

  const load = () => {
    setLoading(true);
    getLeaveRequests(statusFilter || undefined)
      .then(({ data }) => setRequests(data))
      .catch(() => notify('Αποτυχία φόρτωσης αιτημάτων.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!form.startDate || !form.endDate) {
      notify('Συμπλήρωσε ημερομηνία έναρξης και λήξης.', 'warning', 3000);
      return;
    }
    if (form.endDate < form.startDate) {
      notify('Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη.', 'warning', 3000);
      return;
    }
    setSaving(true);
    try {
      await createLeaveRequest({ startDate: form.startDate, endDate: form.endDate, reason: form.reason || undefined });
      notify('Το αίτημα υποβλήθηκε.', 'success', 2500);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η υποβολή απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(request: LeaveRequestDto) {
    const ok = await confirm(`Ακύρωση αιτήματος αδείας ${request.startDate}–${request.endDate};`, 'Επιβεβαίωση');
    if (!ok) return;
    try {
      await cancelLeaveRequest(request.leaveRequestId);
      notify('Το αίτημα ακυρώθηκε.', 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ακύρωση απέτυχε.'), 'error', 4500);
    }
  }

  async function handleApprove(request: LeaveRequestDto) {
    try {
      await reviewLeaveRequest(request.leaveRequestId, true);
      notify('Το αίτημα εγκρίθηκε.', 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η έγκριση απέτυχε.'), 'error', 4500);
    }
  }

  async function handleReject(request: LeaveRequestDto, note: string) {
    try {
      await reviewLeaveRequest(request.leaveRequestId, false, note || undefined);
      notify('Το αίτημα απορρίφθηκε.', 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η απόρριψη απέτυχε.'), 'error', 4500);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Διαθεσιμότητα / Άδειες</h1>
        <p className="text-sm text-muted-foreground">
          {isReviewer
            ? 'Αιτήματα αδείας γιατρών — η έγκριση μπλοκάρει αυτόματα τη διαθεσιμότητα του γιατρού για το διάστημα.'
            : 'Αίτημα άδειας / μη διαθεσιμότητας — μόλις εγκριθεί, δεν θα εμφανίζεσαι διαθέσιμος/η σε αυτό το διάστημα.'}
        </p>
      </div>

      {isDoctor && (
        <Card>
          <CardHeader><CardTitle className="text-base">Νέο αίτημα</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <Label className="mb-1.5 block">Από</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((v) => ({ ...v, startDate: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block">Έως</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((v) => ({ ...v, endDate: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <div className="flex-1">
                <Label className="mb-1.5 block">Αιτία (προαιρετικό)</Label>
                <Input value={form.reason} onChange={(e) => setForm((v) => ({ ...v, reason: e.target.value }))} />
              </div>
              <Button disabled={saving} onClick={handleCreate}>
                {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Υποβολή'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{isDoctor ? 'Τα αιτήματά μου' : 'Αιτήματα'}</CardTitle>
          {isReviewer && (
            <div className="flex gap-1">
              {['Pending', 'Approved', 'Rejected', ''].map((s) => (
                <Button key={s || 'all'} size="sm" variant={statusFilter === s ? 'primary' : 'outline'} onClick={() => setStatusFilter(s)}>
                  {s ? STATUS_LABELS[s] : 'Όλα'}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <DataGrid dataSource={requests} keyExpr="leaveRequestId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχουν αιτήματα.">
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={10} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
            {isReviewer && <Column dataField="doctorName" caption="Γιατρός" />}
            <Column dataField="startDate" caption="Από" width={110} calculateCellValue={(row: LeaveRequestDto) => format(new Date(row.startDate), 'dd/MM/yyyy')} />
            <Column dataField="endDate" caption="Έως" width={110} calculateCellValue={(row: LeaveRequestDto) => format(new Date(row.endDate), 'dd/MM/yyyy')} />
            <Column dataField="reason" caption="Αιτία" calculateCellValue={(row: LeaveRequestDto) => row.reason ?? '—'} />
            <Column
              dataField="status"
              caption="Κατάσταση"
              width={130}
              cellRender={({ data }: { data: LeaveRequestDto }) => (
                <Badge variant={STATUS_VARIANT[data.status] ?? 'secondary'} size="sm">{STATUS_LABELS[data.status] ?? data.status}</Badge>
              )}
            />
            <Column dataField="reviewedByName" caption="Αξιολογήθηκε από" calculateCellValue={(row: LeaveRequestDto) => row.reviewedByName ?? '—'} />
            <Column
              caption="Ενέργειες"
              width={180}
              cellRender={({ data }: { data: LeaveRequestDto }) => (
                <div className="flex gap-1">
                  {isReviewer && data.status === 'Pending' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleApprove(data)}>Έγκριση</Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectTarget(data)}>Απόρριψη</Button>
                    </>
                  )}
                  {isDoctor && data.status === 'Pending' && (
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(data)}>Ακύρωση</Button>
                  )}
                </div>
              )}
            />
          </DataGrid>
        </CardContent>
      </Card>

      {rejectTarget && (
        <ReasonPromptDialog
          open
          title="Απόρριψη αιτήματος αδείας"
          description={`${rejectTarget.doctorName} — ${format(new Date(rejectTarget.startDate), 'dd/MM/yyyy')} έως ${format(new Date(rejectTarget.endDate), 'dd/MM/yyyy')}`}
          confirmLabel="Απόρριψη"
          onCancel={() => setRejectTarget(null)}
          onConfirm={(reasonText) => {
            handleReject(rejectTarget, reasonText);
            setRejectTarget(null);
          }}
        />
      )}
    </div>
  );
}
