import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { LoaderCircleIcon, Pencil, Repeat, Trash2 } from 'lucide-react';
import { ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  HolidayDto,
  NotificationTemplateDto,
  SystemSettingDto,
  createHoliday,
  deleteHoliday,
  getErrorMessage,
  getHolidays,
  getNotificationTemplates,
  getSystemSettings,
  updateHoliday,
  updateNotificationTemplate,
  updateSystemSetting,
} from '@/services/hospital-api';

const EMPTY_HOLIDAY = { holidayDate: '', name: '', isRecurringAnnual: false };

export default function SystemSettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ρυθμίσεις Συστήματος</h1>
        <p className="text-sm text-muted-foreground">Ωράρια λειτουργίας, αργίες, πολιτικές ακύρωσης/αλλαγής ώρας και κείμενα ειδοποιήσεων.</p>
      </div>

      <HoursAndPoliciesCard />
      <HolidaysCard />
      <NotificationTemplatesCard />
    </div>
  );
}

// ── Ωράρια & Πολιτικές ───────────────────────────────────────────────────────

function HoursAndPoliciesCard() {
  const [settings, setSettings] = useState<Record<string, SystemSettingDto>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getSystemSettings()
      .then(({ data }) => {
        const byKey: Record<string, SystemSettingDto> = {};
        const vals: Record<string, string> = {};
        data.forEach((s) => { byKey[s.settingKey] = s; vals[s.settingKey] = s.settingValue ?? ''; });
        setSettings(byKey);
        setValues(vals);
      })
      .catch(() => notify('Αποτυχία φόρτωσης ρυθμίσεων.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function handleSave() {
    const keys = Object.keys(values).filter((k) => values[k] !== (settings[k]?.settingValue ?? ''));
    if (keys.length === 0) {
      notify('Δεν υπάρχουν αλλαγές.', 'info', 2000);
      return;
    }
    setSaving(true);
    const results = await Promise.allSettled(keys.map((k) => updateSystemSetting(k, values[k])));
    const failed = results
      .map((r, i) => ({ r, key: keys[i] }))
      .filter((x): x is { r: PromiseRejectedResult; key: string } => x.r.status === 'rejected');

    if (failed.length < keys.length) notify('Οι ρυθμίσεις ενημερώθηκαν.', 'success', 2500);
    failed.forEach(({ r, key }) => notify(`${settings[key]?.description ?? key}: ${getErrorMessage(r.reason, 'Η ενημέρωση απέτυχε.')}`, 'error', 5000));

    setSaving(false);
    load();
  }

  if (loading) {
    return (
      <Card><CardContent className="py-8 flex justify-center"><LoaderCircleIcon className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Ωράρια & Πολιτικές</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="mb-1.5 block">Ώρα έναρξης ωραρίου</Label>
            <Input type="time" value={values.BusinessHoursStart ?? ''} onChange={(e) => setValues((v) => ({ ...v, BusinessHoursStart: e.target.value }))} />
            <p className="mt-1 text-xs text-muted-foreground">{settings.BusinessHoursStart?.description}</p>
          </div>
          <div>
            <Label className="mb-1.5 block">Ώρα λήξης ωραρίου</Label>
            <Input type="time" value={values.BusinessHoursEnd ?? ''} onChange={(e) => setValues((v) => ({ ...v, BusinessHoursEnd: e.target.value }))} />
            <p className="mt-1 text-xs text-muted-foreground">{settings.BusinessHoursEnd?.description}</p>
          </div>
          <div>
            <Label className="mb-1.5 block">Ελάχιστες ώρες για ακύρωση</Label>
            <Input type="number" min={0} value={values.CancellationMinHours ?? ''} onChange={(e) => setValues((v) => ({ ...v, CancellationMinHours: e.target.value }))} />
            <p className="mt-1 text-xs text-muted-foreground">{settings.CancellationMinHours?.description}</p>
          </div>
          <div>
            <Label className="mb-1.5 block">Ελάχιστες ώρες για αλλαγή ώρας</Label>
            <Input type="number" min={0} value={values.RescheduleMinHours ?? ''} onChange={(e) => setValues((v) => ({ ...v, RescheduleMinHours: e.target.value }))} />
            <p className="mt-1 text-xs text-muted-foreground">{settings.RescheduleMinHours?.description}</p>
          </div>
          <div>
            <Label className="mb-1.5 block">Ώρες πριν το ραντεβού για υπενθύμιση</Label>
            <Input type="number" min={0} value={values.ReminderLeadHours ?? ''} onChange={(e) => setValues((v) => ({ ...v, ReminderLeadHours: e.target.value }))} />
            <p className="mt-1 text-xs text-muted-foreground">{settings.ReminderLeadHours?.description}</p>
          </div>
        </div>
        <Button disabled={saving} onClick={handleSave}>
          {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Αποθήκευση'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Αργίες ──────────────────────────────────────────────────────────────────

function HolidaysCard() {
  const [holidays, setHolidays] = useState<HolidayDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_HOLIDAY);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<HolidayDto | null>(null);

  const load = () => {
    setLoading(true);
    getHolidays(true)
      .then(({ data }) => setHolidays(data))
      .catch(() => notify('Αποτυχία φόρτωσης αργιών.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function handleCreate() {
    if (!form.holidayDate || !form.name.trim()) {
      notify('Συμπλήρωσε ημερομηνία και όνομα αργίας.', 'warning', 3000);
      return;
    }
    setSaving(true);
    try {
      await createHoliday({ holidayDate: form.holidayDate, name: form.name.trim(), isActive: true, isRecurringAnnual: form.isRecurringAnnual });
      notify('Η αργία προστέθηκε.', 'success', 2500);
      setForm(EMPTY_HOLIDAY);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η δημιουργία απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateHoliday(editing.holidayId, { holidayDate: editing.holidayDate, name: editing.name, isActive: editing.isActive, isRecurringAnnual: editing.isRecurringAnnual });
      notify('Η αργία ενημερώθηκε.', 'success', 2500);
      setEditing(null);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(holiday: HolidayDto) {
    const ok = await confirm(`Διαγραφή αργίας "${holiday.name}";`, 'Επιβεβαίωση');
    if (!ok) return;
    try {
      await deleteHoliday(holiday.holidayId);
      notify('Η αργία διαγράφηκε.', 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η διαγραφή απέτυχε.'), 'error', 4500);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Αργίες</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground -mt-2">
          Καμία διαθεσιμότητα γιατρού δεν εμφανίζεται σε ημερομηνία αργίας, ανεξάρτητα από το πρόγραμμά του, και δεν
          επιτρέπεται καταχώρηση ή μετάθεση ραντεβού σε αυτή. Η ετήσια επανάληψη ταιριάζει το ίδιο μήνα/ημέρα κάθε
          χρόνο (π.χ. Πρωτοχρονιά), χωρίς να χρειάζεται νέα καταχώρηση κάθε έτος.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="mb-1.5 block">Ημερομηνία</Label>
            <Input type="date" value={form.holidayDate} onChange={(e) => setForm((v) => ({ ...v, holidayDate: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block">Όνομα</Label>
            <Input placeholder="π.χ. Πρωτοχρονιά" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          </div>
          <Button
            type="button"
            variant={form.isRecurringAnnual ? 'primary' : 'outline'}
            onClick={() => setForm((v) => ({ ...v, isRecurringAnnual: !v.isRecurringAnnual }))}
          >
            <Repeat className="h-3.5 w-3.5 mr-1.5" /> Ετήσια επανάληψη
          </Button>
          <Button disabled={saving} onClick={handleCreate}>
            {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Προσθήκη'}
          </Button>
        </div>

        <DataGrid dataSource={holidays} keyExpr="holidayId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχουν καταχωρημένες αργίες.">
          <FilterRow visible />
          <HeaderFilter visible />
          <Paging defaultPageSize={10} />
          <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
          <Column dataField="holidayDate" caption="Ημερομηνία" width={130} calculateCellValue={(row: HolidayDto) => format(new Date(row.holidayDate), 'dd/MM/yyyy')} />
          <Column dataField="name" caption="Όνομα" />
          <Column
            dataField="isRecurringAnnual"
            caption="Επανάληψη"
            width={130}
            cellRender={({ data }: { data: HolidayDto }) => (
              data.isRecurringAnnual
                ? <Badge variant="info" size="sm"><Repeat className="h-3 w-3 mr-1" /> Ετήσια</Badge>
                : <span className="text-muted-foreground text-sm">Μία φορά</span>
            )}
          />
          <Column
            dataField="isActive"
            caption="Κατάσταση"
            width={110}
            cellRender={({ data }: { data: HolidayDto }) => (
              <Badge variant={data.isActive ? 'success' : 'outline'} size="sm">{data.isActive ? 'Ενεργή' : 'Ανενεργή'}</Badge>
            )}
          />
          <Column
            caption="Ενέργειες"
            width={110}
            cellRender={({ data }: { data: HolidayDto }) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(data)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(data)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          />
        </DataGrid>
      </CardContent>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent onInteractOutside={ignoreDevExtremeOverlayInteraction}>
            <DialogHeader><DialogTitle>Επεξεργασία αργίας</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Ημερομηνία</Label>
                <Input type="date" value={editing.holidayDate.slice(0, 10)} onChange={(e) => setEditing((v) => v && { ...v, holidayDate: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Όνομα</Label>
                <Input value={editing.name} onChange={(e) => setEditing((v) => v && { ...v, name: e.target.value })} />
              </div>
              <Button
                type="button"
                variant={editing.isRecurringAnnual ? 'primary' : 'outline'}
                onClick={() => setEditing((v) => v && { ...v, isRecurringAnnual: !v.isRecurringAnnual })}
              >
                <Repeat className="h-3.5 w-3.5 mr-1.5" /> Ετήσια επανάληψη
              </Button>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing((v) => v && { ...v, isActive: e.target.checked })} />
                Ενεργή
              </label>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Άκυρο</Button>
              <Button disabled={saving} onClick={handleUpdate}>
                {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Αποθήκευση'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

// ── Templates Ειδοποιήσεων ───────────────────────────────────────────────────

const PLACEHOLDER_HINT = '{PatientName}, {DoctorName}, {AppointmentDateTime}, {Reason}';

function NotificationTemplatesCard() {
  const [templates, setTemplates] = useState<NotificationTemplateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplateDto | null>(null);

  const load = () => {
    setLoading(true);
    getNotificationTemplates()
      .then(({ data }) => setTemplates(data))
      .catch(() => notify('Αποτυχία φόρτωσης templates.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function handleSave() {
    if (!editing) return;
    if (!editing.subject.trim() || !editing.body.trim()) {
      notify('Θέμα και κείμενο είναι υποχρεωτικά.', 'warning', 3000);
      return;
    }
    setSaving(true);
    try {
      await updateNotificationTemplate(editing.templateId, { subject: editing.subject, body: editing.body, isActive: editing.isActive });
      notify('Το template ενημερώθηκε.', 'success', 2500);
      setEditing(null);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Templates Ειδοποιήσεων</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground -mt-2">
          Κείμενα ειδοποιήσεων για τα βασικά γεγονότα ραντεβού. Διαθέσιμα πεδία: {PLACEHOLDER_HINT}
        </p>
        <DataGrid dataSource={templates} keyExpr="templateId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχουν templates.">
          <FilterRow visible />
          <HeaderFilter visible />
          <Paging defaultPageSize={10} />
          <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
          <Column dataField="name" caption="Γεγονός" width={200} />
          <Column dataField="subject" caption="Θέμα" />
          <Column
            dataField="isActive"
            caption="Κατάσταση"
            width={110}
            cellRender={({ data }: { data: NotificationTemplateDto }) => (
              <Badge variant={data.isActive ? 'success' : 'outline'} size="sm">{data.isActive ? 'Ενεργό' : 'Ανενεργό'}</Badge>
            )}
          />
          <Column
            caption="Ενέργειες"
            width={90}
            cellRender={({ data }: { data: NotificationTemplateDto }) => (
              <Button size="sm" variant="ghost" onClick={() => setEditing(data)}><Pencil className="h-3.5 w-3.5" /></Button>
            )}
          />
        </DataGrid>
      </CardContent>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="sm:max-w-xl" onInteractOutside={ignoreDevExtremeOverlayInteraction}>
            <DialogHeader><DialogTitle>{editing.name}</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Θέμα</Label>
                <Input value={editing.subject} onChange={(e) => setEditing((v) => v && { ...v, subject: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Κείμενο</Label>
                <Textarea rows={5} value={editing.body} onChange={(e) => setEditing((v) => v && { ...v, body: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">Διαθέσιμα πεδία: {PLACEHOLDER_HINT}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing((v) => v && { ...v, isActive: e.target.checked })} />
                Ενεργό
              </label>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Άκυρο</Button>
              <Button disabled={saving} onClick={handleSave}>
                {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Αποθήκευση'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
