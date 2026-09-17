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

interface GroupOption {
  groupId: number;
  groupName: string;
}

interface AdRightOption {
  addRightsId: number;
  descr: string;
}

const emptyForm = { groupId: '', addRightsId: '' };

// Not the shared <EntityGrid> — same "+ Προσθήκη" popup pattern as AppForms/Groups.
export default function GroupRightsPage() {
  const gridRef = useRef<DataGridRef>(null);
  const store = useMemo(() => createEntityStore('GroupRights', 'groupRightId'), []);
  const groupsStore = useMemo(() => createEntityStore('Groups', 'groupId'), []);
  const adRightsStore = useMemo(() => createEntityStore('AdRights', 'addRightsId'), []);

  const [addOpen, setAddOpen] = useState(false);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [adRightOptions, setAdRightOptions] = useState<AdRightOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!addOpen) return;
    groupsStore.load({}).then((data: any) => setGroups(data ?? []));
    adRightsStore.load({}).then((data: any) => setAdRightOptions(data ?? []));
  }, [addOpen, groupsStore, adRightsStore]);

  function updateForm<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function canSubmit() {
    return !!form.groupId && !!form.addRightsId;
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
      const groupRightsStore = createEntityStore('GroupRights', 'groupRightId');
      await groupRightsStore.insert({
        groupId: Number(form.groupId),
        addRightsId: Number(form.addRightsId),
      });
      resetAndClose();
      gridRef.current?.instance().refresh();
      notify('Το δικαίωμα γκρουπ προστέθηκε.', 'success', 2500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Άγνωστο σφάλμα κατά την αποθήκευση.');
    } finally {
      setSubmitting(false);
    }
  }

  function onEditorPreparing(e: any) {
    if (e.parentType === 'dataRow' && e.dataField === 'groupId' && e.row && !e.row.isNewRow) {
      e.editorOptions = { ...e.editorOptions, disabled: true };
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex">
        <Button onClick={() => setAddOpen(true)}>+ Προσθήκη Δικαιώματος Γκρουπ</Button>
      </div>

      <div className="overflow-x-auto">
      <DataGrid
        ref={gridRef}
        dataSource={store}
        keyExpr="groupRightId"
        showBorders
        columnAutoWidth
        repaintChangesOnly
        onEditorPreparing={onEditorPreparing}
      >
        <GridToolbarDefaults apiRoute="GroupRights" />
        <Editing mode="popup" allowAdding={false} allowUpdating allowDeleting useIcons />

        <Column dataField="groupRightId" caption="ID" dataType="number" allowEditing={false} formItem={{ visible: false }} />
        <Column dataField="groupId" caption="Γκρουπ" dataType="number" editorOptions={{ searchEnabled: true }}>
          <RequiredRule message="Το γκρουπ είναι υποχρεωτικό." />
          <Lookup dataSource={getLookupStore('Groups', 'groupId')} valueExpr="groupId" displayExpr="groupName" />
        </Column>
        <Column dataField="addRightsId" caption="Επιπρόσθετο Δικαίωμα" dataType="number" editorOptions={{ searchEnabled: true }}>
          <RequiredRule message="Το δικαίωμα είναι υποχρεωτικό." />
          <Lookup dataSource={getLookupStore('AdRights', 'addRightsId')} valueExpr="addRightsId" displayExpr="descr" />
        </Column>
      </DataGrid>
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => (open ? setAddOpen(true) : resetAndClose())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Προσθήκη Δικαιώματος Γκρουπ</DialogTitle>
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
              <Label>Γκρουπ *</Label>
              <Combobox
                value={form.groupId}
                onValueChange={(v) => updateForm('groupId', v)}
                options={groups.map((g) => ({ value: String(g.groupId), label: g.groupName }))}
                placeholder="Επιλέξτε γκρουπ"
              />
              {!form.groupId && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
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
