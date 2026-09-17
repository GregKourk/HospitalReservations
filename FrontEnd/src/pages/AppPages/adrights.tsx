import { useMemo, useRef, useState } from 'react';
import DataGrid, {
  Column,
  DataGridRef,
  Editing,
  RequiredRule,
} from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { createEntityStore, GridToolbarDefaults } from '@/components/common/entity-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { AlertCircle } from 'lucide-react';

const emptyForm = { descr: '', ordervalue: 0 };

// Not the shared <EntityGrid> — same "+ Προσθήκη" popup pattern as AppForms/Groups,
// for a consistent add experience across the WAM admin pages. Edit/Delete still
// use the DevExtreme grid's own popup.
export default function AdRightsPage() {
  const gridRef = useRef<DataGridRef>(null);
  const store = useMemo(() => createEntityStore('AdRights', 'addRightsId'), []);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateForm<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function canSubmit() {
    return form.descr.trim().length > 0;
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
      await createEntityStore('AdRights', 'addRightsId').insert({
        descr: form.descr.trim(),
        ordervalue: form.ordervalue,
      });
      resetAndClose();
      gridRef.current?.instance().refresh();
      notify('Το δικαίωμα προστέθηκε.', 'success', 2500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Άγνωστο σφάλμα κατά την αποθήκευση.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex">
        <Button onClick={() => setAddOpen(true)}>+ Προσθήκη Δικαιώματος</Button>
      </div>

      <div className="overflow-x-auto">
      <DataGrid ref={gridRef} dataSource={store} keyExpr="addRightsId" showBorders columnAutoWidth repaintChangesOnly>
        <GridToolbarDefaults apiRoute="AdRights" />
        <Editing mode="popup" allowAdding={false} allowUpdating allowDeleting useIcons />

        <Column dataField="addRightsId" caption="ID" dataType="number" allowEditing={false} formItem={{ visible: false }} />
        <Column dataField="descr" caption="Περιγραφή" dataType="string">
          <RequiredRule message="Η περιγραφή είναι υποχρεωτική." />
        </Column>
        <Column dataField="ordervalue" caption="Order" dataType="number" />
      </DataGrid>
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => (open ? setAddOpen(true) : resetAndClose())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Προσθήκη Δικαιώματος</DialogTitle>
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
              <Label>Περιγραφή *</Label>
              <Input value={form.descr} onChange={(e) => updateForm('descr', e.target.value)} />
              {!form.descr.trim() && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
            </div>
            <div className="space-y-2">
              <Label>Order</Label>
              <Input
                type="number"
                value={form.ordervalue}
                onChange={(e) => updateForm('ordervalue', Number(e.target.value))}
              />
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
