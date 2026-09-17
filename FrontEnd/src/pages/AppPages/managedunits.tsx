import { useEffect, useMemo, useRef, useState } from 'react';
import DataGrid, {
  Column,
  DataGridRef,
  Editing,
  Lookup,
  RequiredRule,
} from 'devextreme-react/data-grid';
import TagBox from 'devextreme-react/tag-box';
import notify from 'devextreme/ui/notify';
import { createEntityStore, getLookupStore, GridToolbarDefaults, ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';
import AddMultipleManagedUnitsDialog from '@/components/common/add-multiple-managed-units-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface OrgOption {
  placementId: number;
  title: string;
}

const emptyForm = { appId: '', baseunit: '', managednotes: '' };

// Not the shared <EntityGrid> — Add lets the user pick several managed units
// for one base unit in a single submit (one ManagedUnits row created per
// selected managed unit). Edit/Delete still use the DevExtreme grid.
export default function ManagedUnitsPage() {
  const gridRef = useRef<DataGridRef>(null);
  const store = useMemo(() => createEntityStore('ManagedUnits', 'managedunitsId'), []);
  const appsStore = useMemo(() => createEntityStore('Applications', 'appId'), []);
  const orgsStore = useMemo(() => createEntityStore('Organizations', 'placementId'), []);

  const [addOpen, setAddOpen] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [managedIds, setManagedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!addOpen) return;
    appsStore.load({}).then((data: any) => setApps(data ?? []));
    orgsStore.load({}).then((data: any) => setOrgOptions(data ?? []));
  }, [addOpen, appsStore, orgsStore]);

  function updateForm<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function canSubmit() {
    return !!form.appId && !!form.baseunit && managedIds.length > 0;
  }

  function resetAndClose() {
    setForm(emptyForm);
    setManagedIds([]);
    setSubmitError(null);
    setAddOpen(false);
  }

  async function handleAdd() {
    if (!canSubmit()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const muStore = createEntityStore('ManagedUnits', 'managedunitsId');
      for (const managedId of managedIds) {
        await muStore.insert({
          appId: Number(form.appId),
          baseunit: Number(form.baseunit),
          managedunit: managedId,
          managednotes: form.managednotes.trim(),
        });
      }
      resetAndClose();
      gridRef.current?.instance().refresh();
      notify(`Προστέθηκαν ${managedIds.length} διαχειριζόμενες μονάδες.`, 'success', 2500);
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
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setMultiOpen(true)}>+ Προσθήκη Πολλαπλών Διαχειριζόμενων Μονάδων</Button>
        <Button onClick={() => setAddOpen(true)}>+ Προσθήκη Διαχειριζόμενης Μονάδας</Button>
      </div>

      <div className="overflow-x-auto">
      <DataGrid
        ref={gridRef}
        dataSource={store}
        keyExpr="managedunitsId"
        showBorders
        columnAutoWidth
        repaintChangesOnly
        onEditorPreparing={onEditorPreparing}
      >
        <GridToolbarDefaults apiRoute="ManagedUnits" />
        <Editing mode="popup" allowAdding={false} allowUpdating allowDeleting useIcons />

        <Column dataField="managedunitsId" caption="ID" dataType="number" allowEditing={false} formItem={{ visible: false }} />
        <Column dataField="appId" caption="Εφαρμογή" dataType="number" editorOptions={{ searchEnabled: true }}>
          <RequiredRule message="Η εφαρμογή είναι υποχρεωτική." />
          <Lookup dataSource={getLookupStore('Applications', 'appId')} valueExpr="appId" displayExpr="appDesc" />
        </Column>
        <Column dataField="baseunit" caption="Βασική Μονάδα" dataType="number" editorOptions={{ searchEnabled: true }}>
          <RequiredRule message="Η βασική μονάδα είναι υποχρεωτική." />
          <Lookup dataSource={getLookupStore('Organizations', 'placementId')} valueExpr="placementId" displayExpr="title" />
        </Column>
        <Column dataField="managedunit" caption="Διαχειριζόμενη Μονάδα" dataType="number" editorOptions={{ searchEnabled: true }}>
          <RequiredRule message="Η διαχειριζόμενη μονάδα είναι υποχρεωτική." />
          <Lookup dataSource={getLookupStore('Organizations', 'placementId')} valueExpr="placementId" displayExpr="title" />
        </Column>
        <Column dataField="managednotes" caption="Σημειώσεις" dataType="string" />
      </DataGrid>
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => (open ? setAddOpen(true) : resetAndClose())}>
        <DialogContent className="max-w-md" onInteractOutside={ignoreDevExtremeOverlayInteraction}>
          <DialogHeader>
            <DialogTitle>Προσθήκη Διαχειριζόμενης Μονάδας</DialogTitle>
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
                onValueChange={(v) => updateForm('appId', v)}
                options={apps.map((a) => ({ value: String(a.appId), label: a.appDesc }))}
                placeholder="Επιλέξτε εφαρμογή"
              />
              {!form.appId && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
            </div>
            <div className="space-y-2">
              <Label>Βασική Μονάδα *</Label>
              <Combobox
                value={form.baseunit}
                onValueChange={(v) => updateForm('baseunit', v)}
                options={orgOptions.map((o) => ({ value: String(o.placementId), label: o.title }))}
                placeholder="Επιλέξτε μονάδα"
              />
              {!form.baseunit && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
            </div>
            <div className="space-y-2">
              <Label>Διαχειριζόμενες Μονάδες * (πολλαπλή επιλογή)</Label>
              <TagBox
                dataSource={orgOptions}
                valueExpr="placementId"
                displayExpr="title"
                value={managedIds}
                onValueChanged={(e) => setManagedIds(e.value ?? [])}
                searchEnabled
                showSelectionControls
                applyValueMode="instantly"
                placeholder="Επιλέξτε μονάδες..."
              />
              {managedIds.length === 0 && <p className="text-xs text-muted-foreground">Υποχρεωτικό — τουλάχιστον μία.</p>}
            </div>
            <div className="space-y-2">
              <Label>Σημειώσεις</Label>
              <Textarea value={form.managednotes} onChange={(e) => updateForm('managednotes', e.target.value)} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose}>Άκυρο</Button>
            <Button type="button" onClick={handleAdd} disabled={!canSubmit() || submitting}>
              {submitting ? 'Αποθήκευση...' : `Προσθήκη (${managedIds.length || 0})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddMultipleManagedUnitsDialog
        open={multiOpen}
        onOpenChange={setMultiOpen}
        onSaved={() => gridRef.current?.instance().refresh()}
      />
    </div>
  );
}
