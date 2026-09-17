import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { ClipboardList, History, LayoutGrid, LoaderCircleIcon, Pencil, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';
import { MedicalRecordsDialog } from '@/components/common/medical-records-dialog';
import { PatientHistoryDialog } from '@/components/common/patient-history-dialog';
import { SummaryDialog } from '@/components/common/summary-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  PatientDto,
  PatientUpsertRequest,
  createPatient,
  deletePatient,
  getErrorMessage,
  searchPatients,
  updatePatient,
} from '@/services/hospital-api';

const EMPTY_FORM: PatientUpsertRequest = { firstName: '', lastName: '', amka: '', dateOfBirth: '', phone: '', email: '' };

// Same pragmatic check used for doctor emails (src/pages/AppPages/doctors.tsx).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim());
const AMKA_PATTERN = /^\d{11}$/;
const isValidAmka = (value: string) => AMKA_PATTERN.test(value.trim());

function getFieldErrors(form: PatientUpsertRequest, touched: { email: boolean; amka: boolean }) {
  const emailInvalid = touched.email && !!form.email?.trim() && !isValidEmail(form.email);
  const amkaInvalid = touched.amka && !!form.amka?.trim() && !isValidAmka(form.amka);
  return { emailInvalid, amkaInvalid };
}

export default function PatientsPage() {
  const { currentUser } = useAuth();
  const isDoctor = !!currentUser?.roles.includes('Doctor');

  const [patients, setPatients] = useState<PatientDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const [form, setForm] = useState<PatientUpsertRequest>(EMPTY_FORM);
  const [touched, setTouched] = useState({ email: false, amka: false });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PatientDto | null>(null);
  const [editingTouched, setEditingTouched] = useState({ email: false, amka: false });

  const { emailInvalid, amkaInvalid } = getFieldErrors(form, touched);
  const editingErrors = editing
    ? getFieldErrors({ ...editing, amka: editing.amka ?? '', email: editing.email ?? '' }, editingTouched)
    : { emailInvalid: false, amkaInvalid: false };

  const load = () => {
    setLoading(true);
    searchPatients(query)
      .then(({ data }) => setPatients(data))
      .catch(() => notify('Αποτυχία φόρτωσης ασθενών.', 'error', 4000))
      .finally(() => setLoading(false));
  };

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [allPatients, setAllPatients] = useState<PatientDto[]>([]);

  const [historyPatient, setHistoryPatient] = useState<PatientDto | null>(null);
  const [medicalRecordsPatient, setMedicalRecordsPatient] = useState<PatientDto | null>(null);

  function openSummary() {
    setSummaryOpen(true);
    setSummaryLoading(true);
    searchPatients('', 1000) // unfiltered — the normal list is capped/search-scoped
      .then(({ data }) => setAllPatients(data))
      .catch(() => notify('Αποτυχία φόρτωσης συγκεντρωτικής προβολής.', 'error', 4000))
      .finally(() => setSummaryLoading(false));
  }

  useEffect(() => {
    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function handleCreate() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth) {
      notify('Όνομα, επώνυμο και ημερομηνία γέννησης είναι υποχρεωτικά.', 'warning', 3500);
      return;
    }
    if (form.amka?.trim() && !isValidAmka(form.amka)) {
      setTouched((t) => ({ ...t, amka: true }));
      notify('Το ΑΜΚΑ πρέπει να έχει 11 ψηφία.', 'warning', 3500);
      return;
    }
    if (form.email?.trim() && !isValidEmail(form.email)) {
      setTouched((t) => ({ ...t, email: true }));
      notify('Το email δεν έχει έγκυρη μορφή.', 'warning', 3500);
      return;
    }
    setSaving(true);
    try {
      await createPatient({
        firstName: form.firstName,
        lastName: form.lastName,
        amka: form.amka?.trim() || undefined,
        dateOfBirth: form.dateOfBirth,
        phone: form.phone?.trim() || undefined,
        email: form.email?.trim() || undefined,
      });
      notify('Ο ασθενής καταχωρήθηκε.', 'success', 2500);
      setForm(EMPTY_FORM);
      setTouched({ email: false, amka: false });
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η καταχώρηση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    if (editingErrors.amkaInvalid || editingErrors.emailInvalid) {
      setEditingTouched({ email: true, amka: true });
      notify('Ελέγξτε τα στοιχεία — κάποιο πεδίο δεν έχει έγκυρη μορφή.', 'warning', 3500);
      return;
    }
    setSaving(true);
    try {
      await updatePatient(editing.patientId, {
        firstName: editing.firstName,
        lastName: editing.lastName,
        amka: editing.amka?.trim() || undefined,
        dateOfBirth: editing.dateOfBirth,
        phone: editing.phone?.trim() || undefined,
        email: editing.email?.trim() || undefined,
      });
      notify('Ο ασθενής ενημερώθηκε.', 'success', 2500);
      setEditing(null);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(patient: PatientDto) {
    const ok = await confirm(`Διαγραφή ασθενή "${patient.lastName} ${patient.firstName}";`, 'Επιβεβαίωση');
    if (!ok) return;
    try {
      await deletePatient(patient.patientId);
      notify('Ο ασθενής διαγράφηκε.', 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η διαγραφή απέτυχε.'), 'error', 4500);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{isDoctor ? 'Ασθενείς μου' : 'Ασθενείς'}</h1>
          <p className="text-sm text-muted-foreground">
            {isDoctor ? 'Ασθενείς με τους οποίους έχεις ραντεβού, και το ιατρικό τους ιστορικό.' : 'Καταχώρηση και διαχείριση ασθενών.'}
          </p>
        </div>
        <Button variant="outline" onClick={openSummary}>
          <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Συγκεντρωτική προβολή
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Νέος ασθενής</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="mb-1.5 block">Όνομα</Label>
            <Input value={form.firstName} onChange={(e) => setForm((v) => ({ ...v, firstName: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block">Επώνυμο</Label>
            <Input value={form.lastName} onChange={(e) => setForm((v) => ({ ...v, lastName: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block">Ημερομηνία γέννησης</Label>
            <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm((v) => ({ ...v, dateOfBirth: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block">ΑΜΚΑ</Label>
            <Input
              value={form.amka}
              aria-invalid={amkaInvalid || undefined}
              onChange={(e) => setForm((v) => ({ ...v, amka: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, amka: true }))}
            />
            {amkaInvalid && <p className="mt-1 text-xs text-destructive">Το ΑΜΚΑ πρέπει να έχει 11 ψηφία.</p>}
          </div>
          <div>
            <Label className="mb-1.5 block">Τηλέφωνο</Label>
            <Input value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block">Email</Label>
            <Input
              type="email"
              value={form.email}
              aria-invalid={emailInvalid || undefined}
              onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            />
            {emailInvalid && <p className="mt-1 text-xs text-destructive">Μη έγκυρη μορφή email.</p>}
          </div>
          <div className="sm:col-span-3">
            <Button disabled={saving} onClick={handleCreate}>
              {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Καταχώρηση'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Αναζήτηση</CardTitle></CardHeader>
        <CardContent>
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Όνομα, επώνυμο, ΑΜΚΑ ή τηλέφωνο..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <DataGrid dataSource={patients} keyExpr="patientId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν βρέθηκαν ασθενείς.">
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={10} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
            <Column dataField="lastName" caption="Επώνυμο" />
            <Column dataField="firstName" caption="Όνομα" />
            <Column dataField="amka" caption="ΑΜΚΑ" width={120} />
            <Column
              dataField="dateOfBirth"
              caption="Ημ. γέννησης"
              width={120}
              calculateCellValue={(row: PatientDto) => format(new Date(row.dateOfBirth), 'dd/MM/yyyy')}
            />
            <Column dataField="phone" caption="Τηλέφωνο" width={130} />
            <Column dataField="email" caption="Email" />
            <Column
              caption="Ενέργειες"
              width={isDoctor ? 180 : 150}
              cellRender={({ data }: { data: PatientDto }) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" title="Ιστορικό ραντεβού" onClick={() => setHistoryPatient(data)}><History className="h-3.5 w-3.5" /></Button>
                  {isDoctor && (
                    <Button size="sm" variant="ghost" title="Ιατρικό ιστορικό" onClick={() => setMedicalRecordsPatient(data)}><ClipboardList className="h-3.5 w-3.5" /></Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(data)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(data)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            />
          </DataGrid>
        </CardContent>
      </Card>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent onInteractOutside={ignoreDevExtremeOverlayInteraction}>
            <DialogHeader><DialogTitle>Επεξεργασία ασθενή — {editing.lastName} {editing.firstName}</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Όνομα</Label>
                  <Input value={editing.firstName} onChange={(e) => setEditing((v) => v && { ...v, firstName: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Επώνυμο</Label>
                  <Input value={editing.lastName} onChange={(e) => setEditing((v) => v && { ...v, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">Ημερομηνία γέννησης</Label>
                <Input
                  type="date"
                  value={editing.dateOfBirth?.slice(0, 10)}
                  onChange={(e) => setEditing((v) => v && { ...v, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">ΑΜΚΑ</Label>
                <Input
                  value={editing.amka ?? ''}
                  aria-invalid={editingErrors.amkaInvalid || undefined}
                  onChange={(e) => setEditing((v) => v && { ...v, amka: e.target.value })}
                  onBlur={() => setEditingTouched((t) => ({ ...t, amka: true }))}
                />
                {editingErrors.amkaInvalid && <p className="mt-1 text-xs text-destructive">Το ΑΜΚΑ πρέπει να έχει 11 ψηφία.</p>}
              </div>
              <div>
                <Label className="mb-1.5 block">Τηλέφωνο</Label>
                <Input value={editing.phone ?? ''} onChange={(e) => setEditing((v) => v && { ...v, phone: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Email</Label>
                <Input
                  type="email"
                  value={editing.email ?? ''}
                  aria-invalid={editingErrors.emailInvalid || undefined}
                  onChange={(e) => setEditing((v) => v && { ...v, email: e.target.value })}
                  onBlur={() => setEditingTouched((t) => ({ ...t, email: true }))}
                />
                {editingErrors.emailInvalid && <p className="mt-1 text-xs text-destructive">Μη έγκυρη μορφή email.</p>}
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
        title="Συγκεντρωτική προβολή — Ασθενείς"
        entityType="PatientsSummary"
        fileBaseName="Ασθενείς"
        keyExpr="patientId"
        dataSource={allPatients}
        loading={summaryLoading}
      >
        <Column dataField="lastName" caption="Επώνυμο" />
        <Column dataField="firstName" caption="Όνομα" />
        <Column dataField="amka" caption="ΑΜΚΑ" />
        <Column
          dataField="dateOfBirth"
          caption="Ημ. γέννησης"
          calculateCellValue={(row: PatientDto) => format(new Date(row.dateOfBirth), 'dd/MM/yyyy')}
        />
        <Column dataField="phone" caption="Τηλέφωνο" />
        <Column dataField="email" caption="Email" />
      </SummaryDialog>

      {historyPatient && (
        <PatientHistoryDialog
          patientId={historyPatient.patientId}
          patientName={`${historyPatient.lastName} ${historyPatient.firstName}`}
          open
          onOpenChange={(open) => !open && setHistoryPatient(null)}
        />
      )}

      {medicalRecordsPatient && (
        <MedicalRecordsDialog
          patientId={medicalRecordsPatient.patientId}
          patientName={`${medicalRecordsPatient.lastName} ${medicalRecordsPatient.firstName}`}
          open
          onOpenChange={(open) => !open && setMedicalRecordsPatient(null)}
        />
      )}
    </div>
  );
}
