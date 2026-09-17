import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import DateBox from 'devextreme-react/date-box';
import TagBox from 'devextreme-react/tag-box';
import notify from 'devextreme/ui/notify';
import { Eye, LayoutGrid, LoaderCircleIcon, ShieldAlert } from 'lucide-react';
import { SummaryDialog } from '@/components/common/summary-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AuditLogDto, getAuditLogs } from '@/services/hospital-api';
import { ACTION_TYPES, ACTION_VARIANT, actionLabel } from '@/lib/action-labels';

type ViewMode = 'all' | 'failed' | 'security';

const TABS: { key: ViewMode; label: string }[] = [
  { key: 'all', label: 'Όλα' },
  { key: 'failed', label: 'Αποτυχημένες Συνδέσεις' },
  { key: 'security', label: 'Γεγονότα Ασφαλείας' },
];

export default function AuditLogPage() {
  const [view, setView] = useState<ViewMode>('all');

  const [fromDate, setFromDate] = useState<Date | null>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [toDate, setToDate] = useState<Date | null>(null);
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [actionTypes, setActionTypes] = useState<string[]>([]);

  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<AuditLogDto | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const load = (overrides?: { view?: ViewMode }) => {
    const effectiveView = overrides?.view ?? view;
    setLoading(true);
    getAuditLogs({
      from: fromDate ? fromDate.toISOString() : undefined,
      to: toDate ? toDate.toISOString() : undefined,
      entityType: entityType.trim() || undefined,
      search: search.trim() || undefined,
      securityOnly: effectiveView === 'security',
      actionTypes: effectiveView === 'failed' ? 'LoginFailed' : effectiveView === 'all' && actionTypes.length ? actionTypes.join(',') : undefined,
      take: 500,
    })
      .then(({ data }) => setLogs(data))
      .catch(() => notify('Αποτυχία φόρτωσης καταγραφών.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []); // initial load only — subsequent loads are explicit

  function changeView(v: ViewMode) {
    setView(v);
    load({ view: v });
  }

  function clearFilters() {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    setFromDate(from);
    setToDate(null);
    setEntityType('');
    setSearch('');
    setActionTypes([]);
    setLoading(true);
    getAuditLogs({ from: from.toISOString(), securityOnly: view === 'security', actionTypes: view === 'failed' ? 'LoginFailed' : undefined, take: 500 })
      .then(({ data }) => setLogs(data))
      .catch(() => notify('Αποτυχία φόρτωσης καταγραφών.', 'error', 4000))
      .finally(() => setLoading(false));
  }

  function formatSnapshot(json?: string | null) {
    if (!json) return '—';
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit & Ασφάλεια</h1>
          <p className="text-sm text-muted-foreground">
            Πλήρες ιστορικό ενεργειών στο σύστημα — ποιος, τι, πότε, από πού.
          </p>
        </div>
        <Button variant="outline" onClick={() => setSummaryOpen(true)}>
          <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Συγκεντρωτική προβολή
        </Button>
      </div>

      <div className="flex gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => changeView(t.key)}
          >
            {t.key === 'security' && <ShieldAlert className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />}
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Φίλτρα</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="mb-1.5 block">Από</Label>
              <DateBox value={fromDate} onValueChanged={(e) => setFromDate(e.value ?? null)} type="date" displayFormat="dd/MM/yyyy" showClearButton />
            </div>
            <div>
              <Label className="mb-1.5 block">Έως</Label>
              <DateBox value={toDate} onValueChanged={(e) => setToDate(e.value ?? null)} type="date" displayFormat="dd/MM/yyyy" placeholder="Χωρίς όριο" showClearButton />
            </div>
            <div>
              <Label className="mb-1.5 block">Τύπος οντότητας</Label>
              <Input placeholder="π.χ. Patient, Doctor, User..." value={entityType} onChange={(e) => setEntityType(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Αναζήτηση</Label>
              <Input placeholder="Χρήστης, ρόλος ή entity id..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {view === 'all' && (
            <div className="max-w-md">
              <Label className="mb-1.5 block">Τύποι ενεργειών</Label>
              <TagBox
                dataSource={ACTION_TYPES.map((t) => ({ id: t, text: actionLabel(t) }))}
                valueExpr="id"
                displayExpr="text"
                value={actionTypes}
                onValueChanged={(e) => setActionTypes(e.value ?? [])}
                showSelectionControls
                applyValueMode="useButtons"
                placeholder="Όλες οι ενέργειες"
                searchEnabled
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={() => load()}>Εφαρμογή φίλτρων</Button>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Καθαρισμός φίλτρων</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <DataGrid dataSource={logs} keyExpr="auditLogId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν βρέθηκαν καταγραφές.">
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={20} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50, 100]} showInfo showNavigationButtons />
            <Column
              dataField="timestamp"
              caption="Ημ/νία & Ώρα"
              width={150}
              sortOrder="desc"
              calculateCellValue={(row: AuditLogDto) => format(new Date(row.timestamp), 'dd/MM/yyyy HH:mm:ss')}
            />
            <Column dataField="userName" caption="Χρήστης" calculateCellValue={(row: AuditLogDto) => row.userName ?? '—'} />
            <Column dataField="role" caption="Ρόλος" width={130} calculateCellValue={(row: AuditLogDto) => row.role ?? '—'} />
            <Column
              dataField="actionType"
              caption="Ενέργεια"
              width={170}
              cellRender={({ data }: { data: AuditLogDto }) => (
                <Badge variant={ACTION_VARIANT[data.actionType] ?? 'secondary'} size="sm">{actionLabel(data.actionType)}</Badge>
              )}
            />
            <Column dataField="entityType" caption="Οντότητα" width={150} />
            <Column dataField="entityId" caption="Entity ID" width={140} calculateCellValue={(row: AuditLogDto) => row.entityId ?? '—'} />
            <Column dataField="sourceIp" caption="IP" width={120} calculateCellValue={(row: AuditLogDto) => row.sourceIp ?? '—'} />
            <Column
              caption="Λεπτομέρειες"
              width={100}
              cellRender={({ data }: { data: AuditLogDto }) => (
                <Button size="sm" variant="ghost" onClick={() => setViewing(data)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
            />
          </DataGrid>
        </CardContent>
      </Card>

      {viewing && (
        <Dialog open onOpenChange={(open) => !open && setViewing(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {actionLabel(viewing.actionType)} — {viewing.entityType}
                {viewing.entityId ? ` (${viewing.entityId})` : ''}
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {format(new Date(viewing.timestamp), 'dd/MM/yyyy HH:mm:ss')} — {viewing.userName ?? '—'} ({viewing.role ?? '—'})
                {viewing.sourceIp ? ` — IP ${viewing.sourceIp}` : ''}
              </div>
              {viewing.userAgent && <div className="text-xs text-muted-foreground break-all">{viewing.userAgent}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Πριν</Label>
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">{formatSnapshot(viewing.beforeSnapshot)}</pre>
                </div>
                <div>
                  <Label className="mb-1.5 block">Μετά</Label>
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">{formatSnapshot(viewing.afterSnapshot)}</pre>
                </div>
              </div>
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      <SummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        title="Συγκεντρωτική προβολή — Audit Log"
        entityType="AuditLogSummary"
        fileBaseName="Καταγραφές Ασφαλείας"
        keyExpr="auditLogId"
        dataSource={logs}
        loading={loading}
      >
        <Column
          dataField="timestamp"
          caption="Ημ/νία & Ώρα"
          calculateCellValue={(row: AuditLogDto) => format(new Date(row.timestamp), 'dd/MM/yyyy HH:mm:ss')}
        />
        <Column dataField="userName" caption="Χρήστης" calculateCellValue={(row: AuditLogDto) => row.userName ?? '—'} />
        <Column dataField="role" caption="Ρόλος" calculateCellValue={(row: AuditLogDto) => row.role ?? '—'} />
        <Column dataField="actionType" caption="Ενέργεια" calculateCellValue={(row: AuditLogDto) => actionLabel(row.actionType)} />
        <Column dataField="entityType" caption="Οντότητα" />
        <Column dataField="entityId" caption="Entity ID" calculateCellValue={(row: AuditLogDto) => row.entityId ?? '—'} />
        <Column dataField="sourceIp" caption="IP" calculateCellValue={(row: AuditLogDto) => row.sourceIp ?? '—'} />
      </SummaryDialog>
    </div>
  );
}
