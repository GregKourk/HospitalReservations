import { useEffect, useState } from 'react';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging, SearchPanel } from 'devextreme-react/data-grid';
import SelectBox from 'devextreme-react/select-box';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { LayoutGrid, LoaderCircleIcon, Pencil, Trash2 } from 'lucide-react';
import { ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';
import { SummaryDialog } from '@/components/common/summary-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ClinicDto,
  DepartmentDto,
  createDepartment,
  deleteDepartment,
  getClinics,
  getDepartments,
  getErrorMessage,
  updateDepartment,
} from '@/services/hospital-api';

export default function DepartmentsPage() {
  const [clinics, setClinics] = useState<ClinicDto[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);

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
    getDepartments() // no clinicId — every department, across every clinic
      .then(({ data }) => setAllDepartments(data))
      .catch(() => notify('Αποτυχία φόρτωσης συγκεντρωτικής προβολής.', 'error', 4000))
      .finally(() => setSummaryLoading(false));
  }

  useEffect(() => {
    getClinics().then(({ data }) => {
      setClinics(data);
      if (data.length === 1) setClinicId(data[0].clinicId);
    }).catch(() => notify('Αποτυχία φόρτωσης κλινικών.', 'error', 4000));
  }, []);

  const load = () => {
    if (!clinicId) { setDepartments([]); return; }
    setLoading(true);
    getDepartments(clinicId)
      .then(({ data }) => setDepartments(data))
      .catch(() => notify('Αποτυχία φόρτωσης τμημάτων.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, [clinicId]);

  async function handleCreate() {
    if (!clinicId) {
      notify('Επίλεξε πρώτα κλινική.', 'warning', 3000);
      return;
    }
    if (!name.trim()) {
      notify('Το όνομα τμήματος είναι υποχρεωτικό.', 'warning', 3000);
      return;
    }
    setSaving(true);
    try {
      await createDepartment({ clinicId, name });
      notify('Το τμήμα δημιουργήθηκε.', 'success', 2500);
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
      await updateDepartment(editing.departmentId, { clinicId: editing.clinicId, name: editing.name });
      notify('Το τμήμα ενημερώθηκε.', 'success', 2500);
      setEditing(null);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(dep: DepartmentDto) {
    const ok = await confirm(`Διαγραφή τμήματος "${dep.name}";`, 'Επιβεβαίωση');
    if (!ok) return;
    try {
      await deleteDepartment(dep.departmentId);
      notify('Το τμήμα διαγράφηκε.', 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η διαγραφή απέτυχε.'), 'error', 4500);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Τμήματα</h1>
          <p className="text-sm text-muted-foreground">Τα τμήματα ανήκουν σε μία κλινική — επίλεξε κλινική για να δεις ή να προσθέσεις τμήματα.</p>
        </div>
        <Button variant="outline" onClick={openSummary}>
          <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Συγκεντρωτική προβολή
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Κλινική</CardTitle></CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <SelectBox
              dataSource={clinics}
              valueExpr="clinicId"
              displayExpr="name"
              value={clinicId}
              onValueChanged={(e) => setClinicId(e.value)}
              placeholder="Επίλεξε κλινική"
              searchEnabled
            />
          </div>
        </CardContent>
      </Card>

      {clinicId && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Νέο τμήμα</CardTitle></CardHeader>
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

          <Card>
            <CardContent className="pt-6">
              <DataGrid dataSource={departments} keyExpr="departmentId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχουν τμήματα σε αυτή την κλινική.">
                <SearchPanel visible width={240} placeholder="Αναζήτηση..." />
                <FilterRow visible />
                <HeaderFilter visible />
                <Paging defaultPageSize={10} />
                <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
                <Column dataField="name" caption="Όνομα" />
                <Column dataField="isActive" caption="Ενεργό" dataType="boolean" width={90} />
                <Column
                  caption="Ενέργειες"
                  width={120}
                  cellRender={({ data }: { data: DepartmentDto }) => (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(data)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(data)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
            <DialogHeader><DialogTitle>Επεξεργασία τμήματος</DialogTitle></DialogHeader>
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
        title="Συγκεντρωτική προβολή — Τμήματα"
        entityType="DepartmentsSummary"
        fileBaseName="Τμήματα"
        keyExpr="departmentId"
        dataSource={allDepartments}
        loading={summaryLoading}
      >
        <Column dataField="clinicName" caption="Κλινική" />
        <Column dataField="name" caption="Τμήμα" />
        <Column dataField="isActive" caption="Ενεργό" dataType="boolean" />
      </SummaryDialog>
    </div>
  );
}
