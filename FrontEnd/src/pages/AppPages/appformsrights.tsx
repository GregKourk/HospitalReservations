import { useEffect, useMemo, useRef, useState } from 'react';
import DataGrid, {
  Column,
  DataGridRef,
  Editing,
  Lookup,
  RequiredRule,
} from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { createEntityStore, getLookupStore, GridToolbarDefaults } from '@/components/common/entity-grid';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { AlertCircle } from 'lucide-react';

interface AppOption {
  appId: number;
  appDesc: string;
}

interface PageOption {
  appFormsId: number;
  name: string;
}

interface AdRightOption {
  addRightsId: number;
  descr: string;
}

const emptyForm = { appId: '', appFormsId: '', addRightsId: '', canedit: false };

// Not the shared <EntityGrid> — same "+ Προσθήκη" popup pattern as AppForms,
// with the page picker filtered by the chosen app (same cascading behavior).
export default function AppFormsRightsPage() {
  const gridRef = useRef<DataGridRef>(null);
  const store = useMemo(() => createEntityStore('AppFormsRights', 'id'), []);
  const appsStore = useMemo(() => createEntityStore('Applications', 'appId'), []);
  const formsStore = useMemo(() => createEntityStore('AppForms', 'appFormsId'), []);
  const adRightsStore = useMemo(() => createEntityStore('AdRights', 'addRightsId'), []);

  const [addOpen, setAddOpen] = useState(false);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [pageOptions, setPageOptions] = useState<PageOption[]>([]);
  const [adRightOptions, setAdRightOptions] = useState<AdRightOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!addOpen) return;
    appsStore.load({}).then((data: any) => setApps(data ?? []));
    adRightsStore.load({}).then((data: any) => setAdRightOptions(data ?? []));
  }, [addOpen, appsStore, adRightsStore]);

  useEffect(() => {
    if (!form.appId) {
      setPageOptions([]);
      return;
    }
    formsStore.load({ filter: ['appId', '=', Number(form.appId)] }).then((data: any) => setPageOptions(data ?? []));
  }, [form.appId, formsStore]);

  function updateForm<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function selectApp(value: string) {
    setForm((f) => ({ ...f, appId: value, appFormsId: '' }));
  }

  function canSubmit() {
    return !!form.appId && !!form.appFormsId && !!form.addRightsId;
  }

  function resetAndClose() {
    setForm(emptyForm);
    setSubmitError(null);
    setAddOpen(false);
  }

  async function handleAdd() {
    if (!canSubmit()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const rightsStore = createEntityStore('AppFormsRights', 'id');
      await rightsStore.insert({
        appId: Number(form.appId),
        appFormsId: Number(form.appFormsId),
        addRightsId: Number(form.addRightsId),
        canedit: form.canedit,
      });
      resetAndClose();
      gridRef.current?.instance().refresh();
      notify('Το δικαίωμα σελίδας προστέθηκε.', 'success', 2500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Άγνωστο σφάλμα κατά την αποθήκευση.');
    } finally {
      setSubmitting(false);
    }
  }

  function onEditorPreparing(e: any) {
    if (e.parentType === 'dataRow' && e.dataField === 'appId' && e.row && !e.row.isNewRow) {
      e.editorOptions = { ...e.editorOptions, disabled: true };
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex">
        <Button onClick={() => setAddOpen(true)}>+ Προσθήκη Δικαιώματος Σελίδας</Button>
      </div>

      <div className="overflow-x-auto">
      <DataGrid
        ref={gridRef}
        dataSource={store}
        keyExpr="id"
        showBorders
        columnAutoWidth
        repaintChangesOnly
        onEditorPreparing={onEditorPreparing}
      >
        <GridToolbarDefaults apiRoute="AppFormsRights" />
        <Editing mode="popup" allowAdding={false} allowUpdating allowDeleting useIcons />

        <Column dataField="id" caption="ID" dataType="number" allowEditing={false} formItem={{ visible: false }} />
        <Column dataField="appId" caption="Εφαρμογή" dataType="number" editorOptions={{ searchEnabled: true }}>
          <RequiredRule message="Η εφαρμογή είναι υποχρεωτική." />
          <Lookup dataSource={getLookupStore('Applications', 'appId')} valueExpr="appId" displayExpr="appDesc" />
        </Column>
        <Column dataField="appFormsId" caption="Σελίδα" dataType="number" editorOptions={{ searchEnabled: true }}>
          <RequiredRule message="Η σελίδα είναι υποχρεωτική." />
          <Lookup dataSource={getLookupStore('AppForms', 'appFormsId')} valueExpr="appFormsId" displayExpr="name" />
        </Column>
        <Column dataField="addRightsId" caption="Επιπρόσθετο Δικαίωμα" dataType="number" editorOptions={{ searchEnabled: true }}>
          <RequiredRule message="Το δικαίωμα είναι υποχρεωτικό." />
          <Lookup dataSource={getLookupStore('AdRights', 'addRightsId')} valueExpr="addRightsId" displayExpr="descr" />
        </Column>
        <Column dataField="canedit" caption="Can Edit" dataType="boolean" />
      </DataGrid>
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => (open ? setAddOpen(true) : resetAndClose())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Προσθήκη Δικαιώματος Σελίδας</DialogTitle>
            <DialogDescription>Τα πεδία με * είναι υποχρεωτικά.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {submitError && (
              <Alert variant="destructive" appearance="light">
                <AlertIcon><AlertCircle /></AlertIcon>
                <AlertTitle>{submitError}</AlertTitle>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>Εφαρμογή *</Label>
              <Combobox
                value={form.appId}
                onValueChange={selectApp}
                options={apps.map((a) => ({ value: String(a.appId), label: a.appDesc }))}
                placeholder="Επιλέξτε εφαρμογή"
              />
              {!form.appId && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
            </div>
            <div className="space-y-2">
              <Label>Σελίδα *</Label>
              <Combobox
                value={form.appFormsId}
                onValueChange={(v) => updateForm('appFormsId', v)}
                disabled={!form.appId}
                options={pageOptions.map((p) => ({ value: String(p.appFormsId), label: p.name }))}
                placeholder={form.appId ? 'Επιλέξτε σελίδα' : 'Επιλέξτε πρώτα εφαρμογή'}
              />
              {form.appId && !form.appFormsId && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
            </div>
            <div className="space-y-2">
              <Label>Επιπρόσθετο Δικαίωμα *</Label>
              <Combobox
                value={form.addRightsId}
                onValueChange={(v) => updateForm('addRightsId', v)}
                options={adRightOptions.map((r) => ({ value: String(r.addRightsId), label: r.descr }))}
                placeholder="Επιλέξτε δικαίωμα"
              />
              {!form.addRightsId && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="canedit" checked={form.canedit} onCheckedChange={(c) => updateForm('canedit', c === true)} />
              <Label htmlFor="canedit">Can Edit</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose}>Άκυρο</Button>
            <Button type="button" onClick={handleAdd} disabled={!canSubmit() || submitting}>
              {submitting ? 'Αποθήκευση...' : 'Προσθήκη'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
