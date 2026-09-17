import { useEffect, useMemo, useState } from 'react';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import SelectBox from 'devextreme-react/select-box';
import TagBox from 'devextreme-react/tag-box';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { LayoutGrid, LoaderCircleIcon, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';
import { SummaryDialog } from '@/components/common/summary-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ClinicDto,
  DAY_OF_WEEK_NAMES,
  DoctorScheduleDto,
  FullDoctorDto,
  LookupItemDto,
  createDoctorSchedule,
  deleteDoctorSchedule,
  getClinics,
  getDoctorSchedules,
  getErrorMessage,
  getLookupDoctors,
  getOwnDoctor,
  updateDoctorSchedule,
} from '@/services/hospital-api';

const STAFF_ROLES = ['Admin', 'SuperUser', 'ClinicManager'];

const DAY_ITEMS = DAY_OF_WEEK_NAMES.map((text, id) => ({ id, text }));

// TimeSpan comes back as "HH:mm:ss" — <input type="time"> wants "HH:mm".
const toTimeInput = (t: string) => t.slice(0, 5);
const toTimeSpan = (t: string) => (t.length === 5 ? `${t}:00` : t);

const EMPTY_FORM = { dayOfWeek: [1] as number[], startTime: '09:00', endTime: '13:00', slotMinutes: 15, effectiveFrom: '', effectiveTo: '' };

export default function SchedulesPage() {
  const { currentUser } = useAuth();
  const isStaff = !currentUser || currentUser.roles.some((r) => STAFF_ROLES.includes(r));
  const isDoctor = !!currentUser && currentUser.roles.includes('Doctor') && !isStaff;

  const [ownDoctor, setOwnDoctor] = useState<FullDoctorDto | null>(null);

  const [clinics, setClinics] = useState<ClinicDto[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<LookupItemDto[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);

  const effectiveDoctorId = isDoctor ? ownDoctor?.doctorId ?? null : doctorId;
  const effectiveClinicId = isDoctor ? ownDoctor?.clinicId ?? null : clinicId;

  const [schedules, setSchedules] = useState<DoctorScheduleDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DoctorScheduleDto | null>(null);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [allSchedules, setAllSchedules] = useState<DoctorScheduleDto[]>([]);

  // ── who am I managing? ───────────────────────────────────────────────────
  useEffect(() => {
    if (isDoctor) {
      getOwnDoctor().then(({ data }) => setOwnDoctor(data)).catch(() => notify('Δεν βρέθηκε ο λογαριασμός γιατρού.', 'error', 4000));
    } else {
      getClinics().then(({ data }) => setClinics(data)).catch(() => notify('Αποτυχία φόρτωσης κλινικών.', 'error', 4000));
    }
  }, [isDoctor]);

  useEffect(() => {
    if (isDoctor || !clinicId) { setDoctors([]); return; }
    setDoctorId(null);
    getLookupDoctors(clinicId).then(({ data }) => setDoctors(data)).catch(() => {});
  }, [clinicId, isDoctor]);

  const load = () => {
    if (!effectiveDoctorId) { setSchedules([]); return; }
    setLoading(true);
    getDoctorSchedules(effectiveDoctorId)
      .then(({ data }) => setSchedules(data))
      .catch(() => notify('Αποτυχία φόρτωσης προγράμματος.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, [effectiveDoctorId]);

  const dayLabel = useMemo(() => (day: number) => DAY_OF_WEEK_NAMES[day] ?? String(day), []);

  async function handleCreate() {
    if (!effectiveDoctorId || !effectiveClinicId) {
      notify(isDoctor ? 'Δεν βρέθηκε ο λογαριασμός γιατρού.' : 'Επίλεξε κλινική και γιατρό.', 'warning', 3500);
      return;
    }
    if (form.dayOfWeek.length === 0) {
      notify('Επίλεξε τουλάχιστον μία ημέρα.', 'warning', 3000);
      return;
    }
    if (!form.effectiveFrom) {
      notify('Η ημερομηνία έναρξης ισχύος είναι υποχρεωτική.', 'warning', 3000);
      return;
    }
    if (form.endTime <= form.startTime) {
      notify('Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.', 'warning', 3000);
      return;
    }
    setSaving(true);
    try {
      // Same slot config, applied to every selected day in parallel — one
      // request per day since the API models a schedule as a single weekday.
      const results = await Promise.allSettled(
        form.dayOfWeek.map((day) =>
          createDoctorSchedule({
            doctorId: effectiveDoctorId,
            clinicId: effectiveClinicId,
            dayOfWeek: day,
            startTime: toTimeSpan(form.startTime),
            endTime: toTimeSpan(form.endTime),
            slotMinutes: form.slotMinutes,
            effectiveFrom: form.effectiveFrom,
            effectiveTo: form.effectiveTo || undefined,
          })
        )
      );
      const failed = results
        .map((r, i) => ({ r, day: form.dayOfWeek[i] }))
        .filter((x): x is { r: PromiseRejectedResult; day: number } => x.r.status === 'rejected');
      const successCount = results.length - failed.length;

      if (successCount > 0) {
        notify(`Προστέθηκε πρόγραμμα για ${successCount} ${successCount === 1 ? 'ημέρα' : 'ημέρες'}.`, 'success', 2500);
      }
      failed.forEach(({ r, day }) => notify(`${dayLabel(day)}: ${getErrorMessage(r.reason, 'Η δημιουργία απέτυχε.')}`, 'error', 5500));

      if (successCount > 0) {
        setForm(EMPTY_FORM);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    if (editing.endTime <= editing.startTime) {
      notify('Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.', 'warning', 3000);
      return;
    }
    setSaving(true);
    try {
      await updateDoctorSchedule(editing.scheduleId, {
        dayOfWeek: editing.dayOfWeek,
        startTime: toTimeSpan(editing.startTime),
        endTime: toTimeSpan(editing.endTime),
        slotMinutes: editing.slotMinutes,
        effectiveFrom: editing.effectiveFrom,
        effectiveTo: editing.effectiveTo || undefined,
        isActive: editing.isActive,
      });
      notify('Το πρόγραμμα ενημερώθηκε.', 'success', 2500);
      setEditing(null);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(schedule: DoctorScheduleDto) {
    const ok = await confirm(`Διαγραφή προγράμματος "${dayLabel(schedule.dayOfWeek)} ${toTimeInput(schedule.startTime)}-${toTimeInput(schedule.endTime)}";`, 'Επιβεβαίωση');
    if (!ok) return;
    try {
      await deleteDoctorSchedule(schedule.scheduleId);
      notify('Το πρόγραμμα διαγράφηκε.', 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η διαγραφή απέτυχε.'), 'error', 4500);
    }
  }

  function openSummary() {
    setSummaryOpen(true);
    setSummaryLoading(true);
    getDoctorSchedules() // no filter — every schedule, every doctor (staff only reach this button anyway)
      .then(({ data }) => setAllSchedules(data))
      .catch(() => notify('Αποτυχία φόρτωσης συγκεντρωτικής προβολής.', 'error', 4000))
      .finally(() => setSummaryLoading(false));
  }

  if (!isStaff && !isDoctor) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Αυτή η οθόνη είναι διαθέσιμη μόνο σε admin ή γιατρούς (για το δικό τους πρόγραμμα).
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Πρόγραμμα Γιατρών</h1>
          <p className="text-sm text-muted-foreground">
            Εβδομαδιαίες διαθέσιμες ώρες ανά γιατρό — αυτές καθορίζουν τι βλέπει η Ρεσεψιόν ως ελεύθερα ραντεβού.
          </p>
        </div>
        {isStaff && (
          <Button variant="outline" onClick={openSummary}>
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Συγκεντρωτική προβολή
          </Button>
        )}
      </div>

      {!isDoctor && (
        <Card>
          <CardHeader><CardTitle className="text-base">Κλινική / Γιατρός</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <Label className="mb-1.5 block">Κλινική</Label>
              <SelectBox dataSource={clinics} valueExpr="clinicId" displayExpr="name" value={clinicId} onValueChanged={(e) => setClinicId(e.value)} placeholder="Επίλεξε κλινική" searchEnabled />
            </div>
            <div>
              <Label className="mb-1.5 block">Γιατρός</Label>
              <SelectBox dataSource={doctors} valueExpr="id" displayExpr="text" value={doctorId} onValueChanged={(e) => setDoctorId(e.value)} placeholder="Επίλεξε γιατρό" disabled={!clinicId} searchEnabled />
            </div>
          </CardContent>
        </Card>
      )}

      {isDoctor && ownDoctor && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <span className="text-muted-foreground">Πρόγραμμα για:</span> <span className="font-medium">{ownDoctor.fullName}</span> — {ownDoctor.clinicName} / {ownDoctor.departmentName}
          </CardContent>
        </Card>
      )}

      {effectiveDoctorId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Νέο πρόγραμμα</CardTitle>
              <p className="text-sm text-muted-foreground">Επίλεξε πάνω από μία ημέρα για να δημιουργηθεί το ίδιο ωράριο σε όλες ταυτόχρονα.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
              <div>
                <Label className="mb-1.5 block">Ημέρες</Label>
                <TagBox
                  dataSource={DAY_ITEMS}
                  valueExpr="id"
                  displayExpr="text"
                  value={form.dayOfWeek}
                  onValueChanged={(e) => setForm((v) => ({ ...v, dayOfWeek: e.value ?? [] }))}
                  showSelectionControls
                  applyValueMode="useButtons"
                  placeholder="Επίλεξε ημέρες"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Ώρα έναρξης</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm((v) => ({ ...v, startTime: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block">Ώρα λήξης</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm((v) => ({ ...v, endTime: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block">Διάρκεια slot (λεπτά)</Label>
                <Input type="number" min={5} max={480} step={5} value={form.slotMinutes} onChange={(e) => setForm((v) => ({ ...v, slotMinutes: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="mb-1.5 block">Ισχύει από</Label>
                <Input type="date" value={form.effectiveFrom} onChange={(e) => setForm((v) => ({ ...v, effectiveFrom: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="mb-1.5 block">Ισχύει έως (προαιρετικό)</Label>
                  <Input type="date" value={form.effectiveTo} onChange={(e) => setForm((v) => ({ ...v, effectiveTo: e.target.value }))} />
                </div>
              </div>
              <div className="sm:col-span-3 lg:col-span-6">
                <Button disabled={saving} onClick={handleCreate}>
                  {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Προσθήκη'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <DataGrid dataSource={schedules} keyExpr="scheduleId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχει καταχωρημένο πρόγραμμα.">
                <FilterRow visible />
                <HeaderFilter visible />
                <Paging defaultPageSize={10} />
                <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
                <Column dataField="dayOfWeek" caption="Ημέρα" width={110} calculateCellValue={(row: DoctorScheduleDto) => dayLabel(row.dayOfWeek)} />
                <Column caption="Ώρες" width={130} calculateCellValue={(row: DoctorScheduleDto) => `${toTimeInput(row.startTime)}–${toTimeInput(row.endTime)}`} />
                <Column dataField="slotMinutes" caption="Slot (λεπτά)" width={110} />
                <Column dataField="effectiveFrom" caption="Από" width={110} calculateCellValue={(row: DoctorScheduleDto) => row.effectiveFrom.slice(0, 10)} />
                <Column dataField="effectiveTo" caption="Έως" width={110} calculateCellValue={(row: DoctorScheduleDto) => row.effectiveTo?.slice(0, 10) ?? '—'} />
                <Column
                  dataField="isActive"
                  caption="Κατάσταση"
                  width={110}
                  cellRender={({ data }: { data: DoctorScheduleDto }) => (
                    <Badge variant={data.isActive ? 'success' : 'outline'} size="sm">{data.isActive ? 'Ενεργό' : 'Ανενεργό'}</Badge>
                  )}
                />
                <Column
                  caption="Ενέργειες"
                  width={120}
                  cellRender={({ data }: { data: DoctorScheduleDto }) => (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ ...data, startTime: toTimeInput(data.startTime), endTime: toTimeInput(data.endTime), effectiveFrom: data.effectiveFrom.slice(0, 10), effectiveTo: data.effectiveTo?.slice(0, 10) ?? null })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(data)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                />
              </DataGrid>
            </CardContent>
          </Card>
        </>
      )}

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent onInteractOutside={ignoreDevExtremeOverlayInteraction}>
            <DialogHeader><DialogTitle>Επεξεργασία προγράμματος</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Ημέρα</Label>
                  <SelectBox dataSource={DAY_ITEMS} valueExpr="id" displayExpr="text" value={editing.dayOfWeek} onValueChanged={(e) => setEditing((v) => v && { ...v, dayOfWeek: e.value })} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Διάρκεια slot (λεπτά)</Label>
                  <Input type="number" min={5} max={480} step={5} value={editing.slotMinutes} onChange={(e) => setEditing((v) => v && { ...v, slotMinutes: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Ώρα έναρξης</Label>
                  <Input type="time" value={editing.startTime} onChange={(e) => setEditing((v) => v && { ...v, startTime: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Ώρα λήξης</Label>
                  <Input type="time" value={editing.endTime} onChange={(e) => setEditing((v) => v && { ...v, endTime: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Ισχύει από</Label>
                  <Input type="date" value={editing.effectiveFrom} onChange={(e) => setEditing((v) => v && { ...v, effectiveFrom: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Ισχύει έως</Label>
                  <Input type="date" value={editing.effectiveTo ?? ''} onChange={(e) => setEditing((v) => v && { ...v, effectiveTo: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing((v) => v && { ...v, isActive: e.target.checked })} />
                Ενεργό
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

      <SummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        title="Συγκεντρωτική προβολή — Πρόγραμμα Γιατρών"
        entityType="DoctorSchedulesSummary"
        fileBaseName="Πρόγραμμα Γιατρών"
        keyExpr="scheduleId"
        dataSource={allSchedules}
        loading={summaryLoading}
      >
        <Column dataField="clinicName" caption="Κλινική" />
        <Column dataField="doctorName" caption="Γιατρός" />
        <Column dataField="dayOfWeek" caption="Ημέρα" calculateCellValue={(row: DoctorScheduleDto) => dayLabel(row.dayOfWeek)} />
        <Column caption="Ώρες" calculateCellValue={(row: DoctorScheduleDto) => `${toTimeInput(row.startTime)}–${toTimeInput(row.endTime)}`} />
        <Column dataField="isActive" caption="Ενεργό" dataType="boolean" />
      </SummaryDialog>
    </div>
  );
}
