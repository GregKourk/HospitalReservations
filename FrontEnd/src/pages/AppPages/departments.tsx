import { useEffect, useState } from 'react';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging, SearchPanel } from 'devextreme-react/data-grid';
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
  DepartmentDto,
  createDepartment,
  deleteDepartment,
  getDepartments,
  getErrorMessage,
  updateDepartment,
} from '@/services/hospital-api';

// Specialties are one shared list for every branch (025_shared_specialties.sql),
// so only Admin/SuperUser can change it; a ClinicManager sees it read-only, with
// the doctor counts narrowed to their own branch by the API.
export default function DepartmentsPage() {
  const { currentUser } = useAuth();
  const canEdit = !!currentUser?.roles.some((r) => r === 'Admin' || r === 'SuperUser');

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DepartmentDto | null>(null);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [allDepartments, setAllDepartments] = useState<DepartmentDto[]>([]);

  function openSummary() {
    setSummaryOpen(true);
    setSummaryLoading(true);
    getDepartments()
      .then(({ data }) => setAllDepartments(data))
      .catch(() => notify('Αποτυχία φόρτωσης συγκεντρωτικής προβολής.', 'error', 4000))
      .finally(() => setSummaryLoading(false));
  }

  const load = () => {
    setLoading(true);
    getDepartments()
      .then(({ data }) => setDepartments(data))
      .catch(() => notify('Αποτυχία φόρτωσης ειδικοτήτων.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function handleCreate() {
    if (!name.trim()) {
      notify('Το όνομα ειδικότητας είναι υποχρεωτικό.', 'warning', 3000);
      return;
    }
    setSaving(true);
    try {
      await createDepartment({ name: name.trim() });
      notify('Η ειδικότητα δημιουργήθηκε.', 'success', 2500);
      setName('');
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
      await updateDepartment(editing.departmentId, { name: editing.name.trim() });
      notify('Η ειδικότητα ενημερώθηκε.', 'success', 2500);
      setEditing(null);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(dep: DepartmentDto) {
    const ok = await confirm(`Διαγραφή ειδικότητας "${dep.name}";`, 'Επιβεβαίωση');
    if (!ok) return;
    try {
      await deleteDepartment(dep.departmentId);
      notify('Η ειδικότητα διαγράφηκε.', 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η διαγραφή απέτυχε.'), 'error', 4500);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ειδικότητες</h1>
          <p className="text-sm text-muted-foreground">Κοινή λίστα ειδικοτήτων για όλα τα υποκαταστήματα. Ένα υποκατάστημα προσφέρει μια ειδικότητα όταν έχει ενεργό γιατρό σε αυτή.</p>
        </div>
        <Button variant="outline" onClick={openSummary}>
          <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Συγκεντρωτική προβολή
        </Button>
      </div>

      {canEdit && (
        <Card>
          <CardHeader><CardTitle className="text-base">Νέα ειδικότητα</CardTitle></CardHeader>
          <CardContent className="flex gap-2 items-end max-w-md">
            <div className="flex-1">
              <Label className="mb-1.5 block">Όνομα</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button disabled={saving} onClick={handleCreate}>
              {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Δημιουργία'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <DataGrid dataSource={departments} keyExpr="departmentId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχουν ειδικότητες.">
            <SearchPanel visible width={240} placeholder="Αναζήτηση..." />
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={10} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
            <Column dataField="name" caption="Όνομα" />
            <Column dataField="doctorCount" caption={canEdit ? "Γιατροί" : "Γιατροί (στο υποκατάστημά σου)"} dataType="number" width={canEdit ? 100 : 220} />
            {canEdit && <Column
              caption="Ενέργειες"
              width={120}
              cellRender={({ data }: { data: DepartmentDto }) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(data)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(data)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            />}
          </DataGrid>
        </CardContent>
      </Card>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent onInteractOutside={ignoreDevExtremeOverlayInteraction}>
            <DialogHeader><DialogTitle>Επεξεργασία ειδικότητας</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Όνομα</Label>
                <Input value={editing.name} onChange={(e) => setEditing((v) => v && { ...v, name: e.target.value })} />
              </div>
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
        title="Συγκεντρωτική προβολή — Ειδικότητες"
        entityType="DepartmentsSummary"
        fileBaseName="Ειδικότητες"
        keyExpr="departmentId"
        dataSource={allDepartments}
        loading={summaryLoading}
      >
        <Column dataField="name" caption="Ειδικότητα" />
        <Column dataField="doctorCount" caption="Γιατροί" dataType="number" />
      </SummaryDialog>
    </div>
  );
}
