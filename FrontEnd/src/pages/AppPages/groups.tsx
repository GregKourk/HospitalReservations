import { useEffect, useMemo, useRef, useState } from 'react';
import DataGrid, {
  Column,
  DataGridRef,
  Editing,
  Lookup,
  RequiredRule,
} from 'devextreme-react/data-grid';
import { confirm } from 'devextreme/ui/dialog';
import notify from 'devextreme/ui/notify';
import { createEntityStore, getLookupStore, GridToolbarDefaults } from '@/components/common/entity-grid';
import AddMultipleGroupsDialog from '@/components/common/add-multiple-groups-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface OrgOption {
  placementId: number;
  title: string;
}

interface AdRightOption {
  addRightsId: number;
  descr: string;
}

const emptyForm = {
  appId: '',
  groupName: '',
  hasWrite: false,
  unitId: '',
  hafRefId: '',
  rightId: '',
};

// Not the shared <EntityGrid> — Add needs its own dialog so a group's single
// (exactly one) linked AdRight can be picked and written to GroupRights in
// the same step. Edit/Delete still use the DevExtreme grid.
export default function GroupsPage() {
  const gridRef = useRef<DataGridRef>(null);
  const store = useMemo(() => createEntityStore('Groups', 'groupId'), []);
  const appsStore = useMemo(() => createEntityStore('Applications', 'appId'), []);
  const orgsStore = useMemo(() => createEntityStore('Organizations', 'placementId'), []);
  const adRightsStore = useMemo(() => createEntityStore('AdRights', 'addRightsId'), []);

  const [addOpen, setAddOpen] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [adRightOptions, setAdRightOptions] = useState<AdRightOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!addOpen) return;
    appsStore.load({}).then((data: any) => setApps(data ?? []));
    orgsStore.load({}).then((data: any) => setOrgOptions(data ?? []));
    adRightsStore.load({}).then((data: any) => setAdRightOptions(data ?? []));
  }, [addOpen, appsStore, orgsStore, adRightsStore]);

  function updateForm<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function canSubmit() {
    return !!form.appId && form.groupName.trim().length > 0 && !!form.unitId && !!form.rightId;
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
      const groupsStore = createEntityStore('Groups', 'groupId');
      const created = (await groupsStore.insert({
        appId: Number(form.appId),
        groupName: form.groupName.trim(),
        hasWrite: form.hasWrite,
        unitId: Number(form.unitId),
        hafRefId: form.hafRefId ? Number(form.hafRefId) : null,
      })) as { groupId: number };

      const groupRightsStore = createEntityStore('GroupRights', 'groupRightId');
      await groupRightsStore.insert({ groupId: created.groupId, addRightsId: Number(form.rightId) });

      resetAndClose();
      gridRef.current?.instance().refresh();
      notify('Το group προστέθηκε.', 'success', 2500);
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

  // Warns (but doesn't block) when removing the last remaining group of an app.
  function onRowRemoving(e: any) {
    e.cancel = checkLastGroupOfApp(e.data.appId, e.data.groupName);
  }

  async function checkLastGroupOfApp(appId: number | null, groupName: string): Promise<boolean> {
    if (appId == null) return false;
    const siblings: any[] = (await store.load({ filter: ['appId', '=', appId] })) ?? [];
    const remainingOthers = siblings.length - 1;
    if (remainingOthers > 0) return false;
    const confirmed = await confirm(
      `Το group "${groupName}" είναι το τελευταίο group αυτής της εφαρμογής. Μετά τη διαγραφή δεν θα υπάρχει κανένα. Είστε σίγουρος/η;`,
      'Τελευταίο group εφαρμογής',
    );
    return !confirmed;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setMultiOpen(true)}>+ Προσθήκη Πολλαπλών Groups</Button>
        <Button onClick={() => setAddOpen(true)}>+ Προσθήκη Group</Button>
      </div>

      <div className="overflow-x-auto">
      <DataGrid
        ref={gridRef}
        dataSource={store}
        keyExpr="groupId"
        showBorders
        columnAutoWidth
        repaintChangesOnly
        onEditorPreparing={onEditorPreparing}
        onRowRemoving={onRowRemoving}
      >
        <GridToolbarDefaults apiRoute="Groups" />
        <Editing mode="popup" allowAdding={false} allowUpdating allowDeleting useIcons />

        <Column dataField="groupId" caption="ID" dataType="number" allowEditing={false} formItem={{ visible: false }} />

        <Column dataField="appId" caption="Εφαρμογή" dataType="number" editorOptions={{ searchEnabled: true }}>
          <RequiredRule message="Η εφαρμογή είναι υποχρεωτική." />
          <Lookup dataSource={getLookupStore('Applications', 'appId')} valueExpr="appId" displayExpr="appDesc" />
        </Column>

        <Column dataField="groupName" caption="Όνομα Γκρουπ" dataType="string">
          <RequiredRule message="Το όνομα γκρουπ είναι υποχρεωτικό." />
        </Column>
        <Column dataField="hasWrite" caption="Δικαίωμα Εγγραφής" dataType="boolean" />
        <Column dataField="unitId" caption="Μονάδα" dataType="number" editorOptions={{ searchEnabled: true }}>
          <Lookup dataSource={getLookupStore('Organizations', 'placementId')} valueExpr="placementId" displayExpr="title" />
        </Column>
        <Column dataField="hafRefId" caption="Domain Ref ID" dataType="number" />
      </DataGrid>
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => (open ? setAddOpen(true) : resetAndClose())}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Προσθήκη Group</DialogTitle>
            <DialogDescription>Τα πεδία με * είναι υποχρεωτικά.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {submitError && (
              <Alert variant="destructive" appearance="light">
                <AlertIcon><AlertCircle /></AlertIcon>
                <AlertTitle>{submitError}</AlertTitle>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
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
                <Label>Όνομα Γκρουπ *</Label>
                <Input value={form.groupName} onChange={(e) => updateForm('groupName', e.target.value)} />
                {!form.groupName.trim() && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
              </div>

              <div className="space-y-2">
                <Label>Μονάδα *</Label>
                <Combobox
                  value={form.unitId}
                  onValueChange={(v) => updateForm('unitId', v)}
                  options={orgOptions.map((o) => ({ value: String(o.placementId), label: o.title }))}
                  placeholder="Επιλέξτε μονάδα"
                />
                {!form.unitId && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
              </div>

              <div className="space-y-2">
                <Label>Domain Ref ID</Label>
                <Input
                  type="number"
                  value={form.hafRefId}
                  onChange={(e) => updateForm('hafRefId', e.target.value)}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Επιπρόσθετο Δικαίωμα Γκρουπ * (ένα ανά group)</Label>
                <Combobox
                  value={form.rightId}
                  onValueChange={(v) => updateForm('rightId', v)}
                  options={adRightOptions.map((r) => ({ value: String(r.addRightsId), label: r.descr }))}
                  placeholder="Επιλέξτε δικαίωμα"
                />
                {!form.rightId && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasWrite"
                  checked={form.hasWrite}
                  onCheckedChange={(c) => updateForm('hasWrite', c === true)}
                />
                <Label htmlFor="hasWrite">Δικαίωμα Εγγραφής</Label>
              </div>
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

      <AddMultipleGroupsDialog
        open={multiOpen}
        onOpenChange={setMultiOpen}
        onSaved={() => gridRef.current?.instance().refresh()}
      />
    </div>
  );
}
