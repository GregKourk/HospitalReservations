import { useEffect, useState } from 'react';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging, SearchPanel } from 'devextreme-react/data-grid';
import SelectBox from 'devextreme-react/select-box';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { LayoutGrid, LoaderCircleIcon, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';
import { SummaryDialog } from '@/components/common/summary-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ClinicDto,
  ClinicUpsertRequest,
  createClinic,
  deleteClinic,
  getClinics,
  getErrorMessage,
  getUsers,
  updateClinic,
  UserDto,
} from '@/services/hospital-api';

const EMPTY_FORM: ClinicUpsertRequest = { name: '', address: '', phone: '', managerUserId: null };

export default function ClinicsPage() {
  const { currentUser } = useAuth();
  // A ClinicManager may only ever see/edit their own branches (one or more) —
  // the backend already scopes GetAll to them and forbids Create/Delete and
  // reassigning the manager outright.
  const canCreateOrDelete = !currentUser || currentUser.roles.some((r) => r === 'Admin' || r === 'SuperUser');

  const [clinics, setClinics] = useState<ClinicDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ClinicUpsertRequest>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ClinicDto | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  // Candidates for Υπεύθυνος: users holding the ClinicManager role. The same
  // person may be picked for several branches.
  const [managers, setManagers] = useState<UserDto[]>([]);

  useEffect(() => {
    if (!canCreateOrDelete) return;
    getUsers()
      .then(({ data }) => setManagers(data.filter((u) => u.isActive && u.roles.includes('ClinicManager'))))
      .catch(() => notify('Αποτυχία φόρτωσης υπευθύνων.', 'error', 4000));
  }, [canCreateOrDelete]);

  const load = () => {
    setLoading(true);
    getClinics(true)
      .then(({ data }) => setClinics(data))
      .catch(() => notify('Αποτυχία φόρτωσης υποκαταστημάτων.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function handleCreate() {
    if (!form.name.trim()) {
      notify('Το όνομα υποκαταστήματος είναι υποχρεωτικό.', 'warning', 3000);
      return;
    }
    setSaving(true);
    try {
      await createClinic({ name: form.name, address: form.address || undefined, phone: form.phone || undefined, managerUserId: form.managerUserId ?? null });
      notify('Το υποκατάστημα δημιουργήθηκε.', 'success', 2500);
      setForm(EMPTY_FORM);
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
      await updateClinic(editing.clinicId, {
        name: editing.name,
        address: editing.address || undefined,
        phone: editing.phone || undefined,
        // Always sent — omitting it would clear the manager (ignored for a ClinicManager).
        managerUserId: editing.managerUserId ?? null,
      });
      notify('Το υποκατάστημα ενημερώθηκε.', 'success', 2500);
      setEditing(null);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(clinic: ClinicDto) {
    const ok = await confirm(`Διαγραφή υποκαταστήματος "${clinic.name}";`, 'Επιβεβαίωση');
    if (!ok) return;
    try {
      await deleteClinic(clinic.clinicId);
      notify('Το υποκατάστημα διαγράφηκε.', 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η διαγραφή απέτυχε.'), 'error', 4500);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Υποκαταστήματα</h1>
          <p className="text-sm text-muted-foreground">Δημιουργία και διαχείριση υποκαταστημάτων.</p>
        </div>
        <Button variant="outline" onClick={() => setSummaryOpen(true)}>
          <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Συγκεντρωτική προβολή
        </Button>
      </div>

      {canCreateOrDelete && (
        <Card>
          <CardHeader><CardTitle className="text-base">Νέο υποκατάστημα</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block">Όνομα</Label>
              <Input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block">Διεύθυνση</Label>
              <Input value={form.address} onChange={(e) => setForm((v) => ({ ...v, address: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="mb-1.5 block">Τηλέφωνο</Label>
                <Input value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} />
              </div>
              <Button disabled={saving} onClick={handleCreate}>
                {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Δημιουργία'}
              </Button>
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block">Υπεύθυνος (προαιρετικό)</Label>
              <ManagerSelect managers={managers} value={form.managerUserId ?? null} onChange={(v) => setForm((f) => ({ ...f, managerUserId: v }))} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <DataGrid dataSource={clinics} keyExpr="clinicId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχουν υποκαταστήματα.">
            <SearchPanel visible width={240} placeholder="Αναζήτηση..." />
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={10} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
            <Column dataField="name" caption="Όνομα" />
            <Column dataField="address" caption="Διεύθυνση" />
            <Column dataField="phone" caption="Τηλέφωνο" width={140} />
            <Column dataField="managerName" caption="Υπεύθυνος" calculateCellValue={(row: ClinicDto) => row.managerName ?? '—'} />
            <Column dataField="isActive" caption="Ενεργή" dataType="boolean" width={90} />
            <Column
              caption="Ενέργειες"
              width={120}
              cellRender={({ data }: { data: ClinicDto }) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(data)}><Pencil className="h-3.5 w-3.5" /></Button>
                  {canCreateOrDelete && (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(data)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              )}
            />
          </DataGrid>
        </CardContent>
      </Card>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent onInteractOutside={ignoreDevExtremeOverlayInteraction}>
            <DialogHeader><DialogTitle>Επεξεργασία υποκαταστήματος</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Όνομα</Label>
                <Input value={editing.name} onChange={(e) => setEditing((v) => v && { ...v, name: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Διεύθυνση</Label>
                <Input value={editing.address ?? ''} onChange={(e) => setEditing((v) => v && { ...v, address: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Τηλέφωνο</Label>
                <Input value={editing.phone ?? ''} onChange={(e) => setEditing((v) => v && { ...v, phone: e.target.value })} />
              </div>
              {canCreateOrDelete && (
                <div>
                  <Label className="mb-1.5 block">Υπεύθυνος</Label>
                  <ManagerSelect managers={managers} value={editing.managerUserId ?? null} onChange={(v) => setEditing((e) => e && { ...e, managerUserId: v })} />
                </div>
              )}
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
        title="Συγκεντρωτική προβολή — Υποκαταστήματα"
        entityType="ClinicsSummary"
        fileBaseName="Υποκαταστήματα"
        keyExpr="clinicId"
        dataSource={clinics}
        loading={loading}
      >
        <Column dataField="name" caption="Όνομα" />
        <Column dataField="address" caption="Διεύθυνση" />
        <Column dataField="phone" caption="Τηλέφωνο" />
        <Column dataField="managerName" caption="Υπεύθυνος" />
        <Column dataField="isActive" caption="Ενεργή" dataType="boolean" />
      </SummaryDialog>
    </div>
  );
}

function ManagerSelect({ managers, value, onChange }: { managers: UserDto[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <SelectBox
      dataSource={managers}
      valueExpr="userId"
      displayExpr="fullName"
      value={value}
      onValueChanged={(e) => onChange(e.value ?? null)}
      placeholder="Χωρίς υπεύθυνο"
      showClearButton
      searchEnabled
      noDataText="Δεν υπάρχουν χρήστες με ρόλο Υπεύθυνος Υποκαταστήματος."
    />
  );
}
