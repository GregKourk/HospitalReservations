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
  FullDoctorDto,
  LookupItemDto,
  createDoctor,
  deleteDoctor,
  getClinics,
  getErrorMessage,
  getFullDoctors,
  getLookupDepartments,
  updateDoctor,
} from '@/services/hospital-api';

const EMPTY_FORM = { email: '', fullName: '', amka: '', specialty: '', licenseNumber: '' };

// Same pragmatic check the browser's own type="email" validation uses —
// good enough to catch typos ("gmail,com", missing "@") without rejecting
// valid-but-unusual real-world addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim());

// Same check used for patient AMKA (src/pages/AppPages/patients.tsx). Optional here.
const AMKA_PATTERN = /^\d{11}$/;
const isValidAmka = (value: string) => AMKA_PATTERN.test(value.trim());

export default function DoctorsPage() {
  const [clinics, setClinics] = useState<ClinicDto[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);

  const [departments, setDepartments] = useState<LookupItemDto[]>([]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<FullDoctorDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [emailTouched, setEmailTouched] = useState(false);
  const [amkaTouched, setAmkaTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<FullDoctorDto | null>(null);
  const [editingAmkaTouched, setEditingAmkaTouched] = useState(false);

  const emailInvalid = emailTouched && form.email.trim().length > 0 && !isValidEmail(form.email);
  const amkaInvalid = amkaTouched && form.amka.trim().length > 0 && !isValidAmka(form.amka);
  const editingAmkaInvalid = editingAmkaTouched && !!editing?.amka?.trim() && !isValidAmka(editing.amka);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [allDoctors, setAllDoctors] = useState<FullDoctorDto[]>([]);

  function openSummary() {
    setSummaryOpen(true);
    setSummaryLoading(true);
    getFullDoctors() // no clinicId/departmentId — every doctor, everywhere
      .then(({ data }) => setAllDoctors(data))
      .catch(() => notify('Αποτυχία φόρτωσης συγκεντρωτικής προβολής.', 'error', 4000))
      .finally(() => setSummaryLoading(false));
  }

  useEffect(() => {
    getClinics().then(({ data }) => {
      setClinics(data);
      if (data.length === 1) setClinicId(data[0].clinicId);
    }).catch(() => notify('Αποτυχία φόρτωσης κλινικών.', 'error', 4000));
  }, []);

  useEffect(() => {
    setDepartmentId(null);
    if (!clinicId) { setDepartments([]); return; }
    getLookupDepartments(clinicId).then(({ data }) => setDepartments(data)).catch(() => {});
  }, [clinicId]);

  const load = () => {
    if (!clinicId) { setDoctors([]); return; }
    setLoading(true);
    getFullDoctors(clinicId, departmentId ?? undefined)
      .then(({ data }) => setDoctors(data))
      .catch(() => notify('Αποτυχία φόρτωσης γιατρών.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, [clinicId, departmentId]);

  async function handleCreate() {
    if (!clinicId || !departmentId) {
      notify('Επίλεξε κλινική και τμήμα.', 'warning', 3000);
      return;
    }
    if (!form.email.trim() || !form.fullName.trim() || !form.licenseNumber.trim()) {
      notify('Email, ονοματεπώνυμο και αριθμός άδειας είναι υποχρεωτικά.', 'warning', 3500);
      return;
    }
    if (!isValidEmail(form.email)) {
      setEmailTouched(true);
      notify('Το email δεν έχει έγκυρη μορφή.', 'warning', 3500);
      return;
    }
    if (form.amka.trim() && !isValidAmka(form.amka)) {
      setAmkaTouched(true);
      notify('Το ΑΜΚΑ πρέπει να έχει 11 ψηφία.', 'warning', 3500);
      return;
    }
    setSaving(true);
    try {
      await createDoctor({
        email: form.email,
        fullName: form.fullName,
        clinicId,
        departmentId,
        amka: form.amka.trim() || undefined,
        specialty: form.specialty,
        licenseNumber: form.licenseNumber,
      });
      notify('Ο γιατρός δημιουργήθηκε.', 'success', 2500);
      setForm(EMPTY_FORM);
      setEmailTouched(false);
      setAmkaTouched(false);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η δημιουργία απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    if (editingAmkaInvalid) {
      setEditingAmkaTouched(true);
      notify('Το ΑΜΚΑ πρέπει να έχει 11 ψηφία.', 'warning', 3500);
      return;
    }
    setSaving(true);
    try {
      await updateDoctor(editing.doctorId, {
        clinicId: editing.clinicId,
        departmentId: editing.departmentId,
        amka: editing.amka?.trim() || undefined,
        specialty: editing.specialty,
        licenseNumber: editing.licenseNumber,
      });
      notify('Ο γιατρός ενημερώθηκε.', 'success', 2500);
      setEditing(null);
      setEditingAmkaTouched(false);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(doctor: FullDoctorDto) {
    const ok = await confirm(`Διαγραφή γιατρού "${doctor.fullName}";`, 'Επιβεβαίωση');
    if (!ok) return;
    try {
      await deleteDoctor(doctor.doctorId);
      notify('Ο γιατρός διαγράφηκε.', 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η διαγραφή απέτυχε.'), 'error', 4500);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Γιατροί</h1>
          <p className="text-sm text-muted-foreground">
            Η δημιουργία γιατρού φτιάχνει (ή ξαναχρησιμοποιεί) τον λογαριασμό χρήστη με βάση το email και του αναθέτει τον ρόλο Doctor.
          </p>
        </div>
        <Button variant="outline" onClick={openSummary}>
          <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Συγκεντρωτική προβολή
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Κλινική / Τμήμα</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <div>
            <Label className="mb-1.5 block">Κλινική</Label>
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
          <div>
            <Label className="mb-1.5 block">Τμήμα</Label>
            <SelectBox
              dataSource={departments}
              valueExpr="id"
              displayExpr="text"
              value={departmentId}
              onValueChanged={(e) => setDepartmentId(e.value)}
              placeholder="Επίλεξε τμήμα"
              disabled={!clinicId}
              searchEnabled
            />
          </div>
        </CardContent>
      </Card>

      {clinicId && departmentId && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Νέος γιατρός</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div>
                <Label className="mb-1.5 block">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  aria-invalid={emailInvalid || undefined}
                  onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                  onBlur={() => setEmailTouched(true)}
                />
                {emailInvalid && <p className="mt-1 text-xs text-destructive">Μη έγκυρη μορφή email.</p>}
              </div>
              <div>
                <Label className="mb-1.5 block">Ονοματεπώνυμο</Label>
                <Input value={form.fullName} onChange={(e) => setForm((v) => ({ ...v, fullName: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block">ΑΜΚΑ (προαιρετικό)</Label>
                <Input
                  value={form.amka}
                  aria-invalid={amkaInvalid || undefined}
                  onChange={(e) => setForm((v) => ({ ...v, amka: e.target.value }))}
                  onBlur={() => setAmkaTouched(true)}
                  maxLength={11}
                />
                {amkaInvalid && <p className="mt-1 text-xs text-destructive">Το ΑΜΚΑ πρέπει να έχει 11 ψηφία.</p>}
              </div>
              <div>
                <Label className="mb-1.5 block">Ειδικότητα</Label>
                <Input value={form.specialty} onChange={(e) => setForm((v) => ({ ...v, specialty: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="mb-1.5 block">Αριθμός άδειας</Label>
                  <Input value={form.licenseNumber} onChange={(e) => setForm((v) => ({ ...v, licenseNumber: e.target.value }))} />
                </div>
                <Button disabled={saving} onClick={handleCreate}>
                  {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Δημιουργία'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <DataGrid dataSource={doctors} keyExpr="doctorId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχουν γιατροί σε αυτό το τμήμα.">
                <SearchPanel visible width={240} placeholder="Αναζήτηση..." />
                <FilterRow visible />
                <HeaderFilter visible />
                <Paging defaultPageSize={10} />
                <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
                <Column dataField="fullName" caption="Ονοματεπώνυμο" />
                <Column dataField="email" caption="Email" />
                <Column dataField="amka" caption="ΑΜΚΑ" width={110} calculateCellValue={(row: FullDoctorDto) => row.amka ?? '—'} />
                <Column dataField="specialty" caption="Ειδικότητα" />
                <Column dataField="licenseNumber" caption="Αρ. άδειας" width={140} />
                <Column
                  caption="Ενέργειες"
                  width={120}
                  cellRender={({ data }: { data: FullDoctorDto }) => (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(data); setEditingAmkaTouched(false); }}><Pencil className="h-3.5 w-3.5" /></Button>
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
            <DialogHeader><DialogTitle>Επεξεργασία γιατρού — {editing.fullName}</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Κλινική</Label>
                <SelectBox
                  dataSource={clinics}
                  valueExpr="clinicId"
                  displayExpr="name"
                  value={editing.clinicId}
                  onValueChanged={(e) => setEditing((v) => v && { ...v, clinicId: e.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Τμήμα</Label>
                <SelectBox
                  dataSource={departments}
                  valueExpr="id"
                  displayExpr="text"
                  value={editing.departmentId}
                  onValueChanged={(e) => setEditing((v) => v && { ...v, departmentId: e.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">ΑΜΚΑ (προαιρετικό)</Label>
                <Input
                  value={editing.amka ?? ''}
                  aria-invalid={editingAmkaInvalid || undefined}
                  onChange={(e) => setEditing((v) => v && { ...v, amka: e.target.value })}
                  onBlur={() => setEditingAmkaTouched(true)}
                  maxLength={11}
                />
                {editingAmkaInvalid && <p className="mt-1 text-xs text-destructive">Το ΑΜΚΑ πρέπει να έχει 11 ψηφία.</p>}
              </div>
              <div>
                <Label className="mb-1.5 block">Ειδικότητα</Label>
                <Input value={editing.specialty} onChange={(e) => setEditing((v) => v && { ...v, specialty: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Αριθμός άδειας</Label>
                <Input value={editing.licenseNumber} onChange={(e) => setEditing((v) => v && { ...v, licenseNumber: e.target.value })} />
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
        title="Συγκεντρωτική προβολή — Γιατροί"
        entityType="DoctorsSummary"
        fileBaseName="Γιατροί"
        keyExpr="doctorId"
        dataSource={allDoctors}
        loading={summaryLoading}
      >
        <Column dataField="clinicName" caption="Κλινική" />
        <Column dataField="departmentName" caption="Τμήμα" />
        <Column dataField="fullName" caption="Ονοματεπώνυμο" />
        <Column dataField="email" caption="Email" />
        <Column dataField="amka" caption="ΑΜΚΑ" />
        <Column dataField="specialty" caption="Ειδικότητα" />
        <Column dataField="licenseNumber" caption="Αρ. άδειας" />
      </SummaryDialog>
    </div>
  );
}
