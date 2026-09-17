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
import AddMultiplePagesDialog from '@/components/common/add-multiple-pages-dialog';
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

const ROOT_PARENT = '__root__';

interface AppOption {
  appId: number;
  appDesc: string;
}

interface ParentOption {
  appFormsId: number;
  name: string;
}

interface AdRightOption {
  addRightsId: number;
  descr: string;
}

interface RightLink {
  rightId: number;
  canEdit: boolean;
}

const emptyForm = {
  appId: '',
  parentid: ROOT_PARENT,
  name: '',
  navtitle: '',
  navurl: '',
  routeelement: '',
  routecombpath: '',
  navicon: '',
  navfonticon: '',
  navhasbullet: true,
  navhaschildren: false,
  canedit: false,
  visible: true,
  devvisible: true,
  ordervalue: 0,
  onlyroute: false,
  isexternallink: false,
};

// Not the shared <EntityGrid> — Add needs a custom form (multiple rights, each
// with its own edit flag, plus a parent-page picker that depends on the chosen
// app), which doesn't fit the grid's auto-generated popup. Edit/Delete still
// use the DevExtreme grid — they don't need any of that.
export default function AppFormsPage() {
  const gridRef = useRef<DataGridRef>(null);
  const store = useMemo(() => createEntityStore('AppForms', 'appFormsId'), []);
  const appsStore = useMemo(() => createEntityStore('Applications', 'appId'), []);
  const adRightsStore = useMemo(() => createEntityStore('AdRights', 'addRightsId'), []);

  const [addOpen, setAddOpen] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [adRightOptions, setAdRightOptions] = useState<AdRightOption[]>([]);
  const [parentOptions, setParentOptions] = useState<ParentOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [rightLinks, setRightLinks] = useState<RightLink[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!addOpen) return;
    // CustomStore.load() resolves with the plain data array itself, not a
    // { data, totalCount } wrapper (that shape only applies to the raw HTTP
    // response from the DataSourceLoader endpoint, e.g. when calling axios directly).
    appsStore.load({}).then((data: any) => setApps(data ?? []));
    adRightsStore.load({}).then((data: any) => setAdRightOptions(data ?? []));
  }, [addOpen, appsStore, adRightsStore]);

  useEffect(() => {
    if (!form.appId) {
      setParentOptions([]);
      return;
    }
    store.load({ filter: ['appId', '=', Number(form.appId)] }).then((data: any) => setParentOptions(data ?? []));
  }, [form.appId, store]);

  function updateForm<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function selectApp(value: string) {
    setForm((f) => ({ ...f, appId: value, parentid: ROOT_PARENT }));
  }

  function toggleRight(rightId: number) {
    setRightLinks((links) => {
      const isSelected = links.some((l) => l.rightId === rightId);
      return isSelected
        ? links.filter((l) => l.rightId !== rightId)
        : [...links, { rightId, canEdit: false }];
    });
  }

  function setRightCanEdit(rightId: number, canEdit: boolean) {
    setRightLinks((links) => links.map((l) => (l.rightId === rightId ? { ...l, canEdit } : l)));
  }

  function canSubmit() {
    return !!form.appId && form.name.trim().length > 0 && form.navtitle.trim().length > 0 && rightLinks.length > 0;
  }

  function resetAndClose() {
    setForm(emptyForm);
    setRightLinks([]);
    setSubmitError(null);
    setAddOpen(false);
  }

  async function handleAdd() {
    if (!canSubmit()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const formsStore = createEntityStore('AppForms', 'appFormsId');
      const created = (await formsStore.insert({
        appId: Number(form.appId),
        parentid: form.parentid === ROOT_PARENT ? 0 : Number(form.parentid),
        name: form.name.trim(),
        navtitle: form.navtitle.trim(),
        navurl: form.navurl.trim(),
        routeelement: form.routeelement.trim(),
        routecombpath: form.routecombpath.trim(),
        navicon: form.navicon.trim(),
        navfonticon: form.navfonticon.trim(),
        navhasbullet: form.navhasbullet,
        navhaschildren: form.navhaschildren,
        canedit: form.canedit,
        visible: form.visible,
        devvisible: form.devvisible,
        ordervalue: form.ordervalue,
        onlyroute: form.onlyroute,
        isexternallink: form.isexternallink,
      })) as { appFormsId: number };

      const rightsStore = createEntityStore('AppFormsRights', 'id');
      for (const link of rightLinks) {
        await rightsStore.insert({
          appId: Number(form.appId),
          appFormsId: created.appFormsId,
          addRightsId: link.rightId,
          canedit: link.canEdit,
        });
      }

      resetAndClose();
      gridRef.current?.instance().refresh();
      notify('Η σελίδα προστέθηκε.', 'success', 2500);
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

  // Warns (but doesn't block) when removing the last remaining page of an app —
  // the hard block for pages that still have child pages happens server-side.
  function onRowRemoving(e: any) {
    e.cancel = checkLastPageOfApp(e.data.appId, e.data.name);
  }

  async function checkLastPageOfApp(appId: number | null, name: string): Promise<boolean> {
    if (appId == null) return false;
    const siblings: any[] = (await store.load({ filter: ['appId', '=', appId] })) ?? [];
    const remainingOthers = siblings.length - 1;
    if (remainingOthers > 0) return false;
    const confirmed = await confirm(
      `Η σελίδα "${name}" είναι η τελευταία σελίδα αυτής της εφαρμογής. Μετά τη διαγραφή δεν θα υπάρχει καμία σελίδα. Είστε σίγουρος/η;`,
      'Τελευταία σελίδα εφαρμογής',
    );
    return !confirmed;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setMultiOpen(true)}>+ Προσθήκη Πολλαπλών Σελίδων</Button>
        <Button onClick={() => setAddOpen(true)}>+ Προσθήκη Σελίδας</Button>
      </div>

      <div className="overflow-x-auto">
      <DataGrid
        ref={gridRef}
        dataSource={store}
        keyExpr="appFormsId"
        showBorders
        columnAutoWidth
        repaintChangesOnly
        onEditorPreparing={onEditorPreparing}
        onRowRemoving={onRowRemoving}
      >
        <GridToolbarDefaults apiRoute="AppForms" />
        <Editing mode="popup" allowAdding={false} allowUpdating allowDeleting useIcons />

        <Column dataField="appFormsId" caption="ID" dataType="number" allowEditing={false} formItem={{ visible: false }} />

        <Column
          dataField="appId"
          caption="Εφαρμογή"
          dataType="number"
          setCellValue={(newData: any, value: any) => {
            newData.appId = value;
            newData.parentid = null;
          }}
          editorOptions={{ searchEnabled: true }}
        >
          <RequiredRule message="Η εφαρμογή είναι υποχρεωτική." />
          <Lookup dataSource={getLookupStore('Applications', 'appId')} valueExpr="appId" displayExpr="appDesc" />
        </Column>

        <Column dataField="parentid" caption="Γονική Σελίδα" dataType="number" editorOptions={{ searchEnabled: true }}>
          <Lookup
            dataSource={(options) => {
              const appId = options?.data?.appId;
              if (!appId) return { store: [] };
              return { store: getLookupStore('AppForms', 'appFormsId'), filter: ['appId', '=', appId] };
            }}
            valueExpr="appFormsId"
            displayExpr="name"
          />
        </Column>

        <Column dataField="name" caption="Όνομα" dataType="string">
          <RequiredRule message="Το όνομα είναι υποχρεωτικό." />
        </Column>
        <Column dataField="navtitle" caption="Nav Title" dataType="string">
          <RequiredRule message="Το Nav Title είναι υποχρεωτικό." />
        </Column>
        <Column dataField="navurl" caption="Nav Url" dataType="string" />
        <Column dataField="routeelement" caption="Route Element" dataType="string" />
        <Column dataField="routecombpath" caption="Route Comb Path" dataType="string" />
        <Column dataField="navicon" caption="Nav Icon" dataType="string" />
        <Column dataField="navfonticon" caption="Nav Font Icon" dataType="string" />
        <Column dataField="navhasbullet" caption="Has Bullet" dataType="boolean" />
        <Column dataField="navhaschildren" caption="Has Children" dataType="boolean" />
        <Column dataField="canedit" caption="Can Edit" dataType="boolean" />
        <Column dataField="visible" caption="Visible" dataType="boolean" />
        <Column dataField="devvisible" caption="Dev Visible" dataType="boolean" />
        <Column dataField="ordervalue" caption="Order" dataType="number" />
        <Column dataField="onlyroute" caption="Only Route" dataType="boolean" />
        <Column dataField="isexternallink" caption="External Link" dataType="boolean" />
      </DataGrid>
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => (open ? setAddOpen(true) : resetAndClose())}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Προσθήκη Σελίδας</DialogTitle>
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
                  onValueChange={selectApp}
                  options={apps.map((a) => ({ value: String(a.appId), label: a.appDesc }))}
                  placeholder="Επιλέξτε εφαρμογή"
                />
                {!form.appId && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
              </div>

              <div className="space-y-2">
                <Label>Γονική Σελίδα</Label>
                <Combobox
                  value={form.parentid}
                  onValueChange={(v) => updateForm('parentid', v)}
                  disabled={!form.appId}
                  options={[
                    { value: ROOT_PARENT, label: '— Ριζική σελίδα (χωρίς γονέα) —' },
                    ...parentOptions.map((p) => ({ value: String(p.appFormsId), label: p.name })),
                  ]}
                  placeholder={form.appId ? 'Επιλέξτε γονική σελίδα' : 'Επιλέξτε πρώτα εφαρμογή'}
                />
              </div>

              <div className="space-y-2">
                <Label>Όνομα *</Label>
                <Input value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
                {!form.name.trim() && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
              </div>
              <div className="space-y-2">
                <Label>Nav Title *</Label>
                <Input value={form.navtitle} onChange={(e) => updateForm('navtitle', e.target.value)} />
                {!form.navtitle.trim() && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο.</p>}
              </div>
              <div className="space-y-2">
                <Label>Nav Url</Label>
                <Input value={form.navurl} onChange={(e) => updateForm('navurl', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Route Element</Label>
                <Input value={form.routeelement} onChange={(e) => updateForm('routeelement', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Route Comb Path</Label>
                <Input value={form.routecombpath} onChange={(e) => updateForm('routecombpath', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Order</Label>
                <Input
                  type="number"
                  value={form.ordervalue}
                  onChange={(e) => updateForm('ordervalue', Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Nav Icon</Label>
                <Input value={form.navicon} onChange={(e) => updateForm('navicon', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nav Font Icon</Label>
                <Input value={form.navfonticon} onChange={(e) => updateForm('navfonticon', e.target.value)} />
              </div>

              <div className="col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {([
                  ['navhasbullet', 'Has Bullet'],
                  ['navhaschildren', 'Has Children'],
                  ['canedit', 'Can Edit (σελίδας)'],
                  ['visible', 'Visible'],
                  ['devvisible', 'Dev Visible'],
                  ['onlyroute', 'Only Route'],
                  ['isexternallink', 'External Link'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={key}
                      checked={form[key]}
                      onCheckedChange={(c) => updateForm(key, c === true)}
                    />
                    <Label htmlFor={key}>{label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>Δικαιώματα που βλέπουν αυτή τη σελίδα * (τουλάχιστον ένα)</Label>
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                {adRightOptions.length === 0 && <p className="text-sm text-muted-foreground">Δεν υπάρχουν ακόμα δικαιώματα.</p>}
                {adRightOptions.map((r) => {
                  const link = rightLinks.find((l) => l.rightId === r.addRightsId);
                  return (
                    <div key={r.addRightsId} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`right-${r.addRightsId}`}
                          checked={!!link}
                          onCheckedChange={() => toggleRight(r.addRightsId)}
                        />
                        <Label htmlFor={`right-${r.addRightsId}`}>{r.descr}</Label>
                      </div>
                      {link && (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`right-edit-${r.addRightsId}`}
                            checked={link.canEdit}
                            onCheckedChange={(c) => setRightCanEdit(r.addRightsId, c === true)}
                          />
                          <Label htmlFor={`right-edit-${r.addRightsId}`} className="text-xs text-muted-foreground">Edit</Label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {rightLinks.length === 0 && <p className="text-xs text-muted-foreground">Υποχρεωτικό: τουλάχιστον ένα δικαίωμα.</p>}
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

      <AddMultiplePagesDialog
        open={multiOpen}
        onOpenChange={setMultiOpen}
        onSaved={() => gridRef.current?.instance().refresh()}
      />
    </div>
  );
}
