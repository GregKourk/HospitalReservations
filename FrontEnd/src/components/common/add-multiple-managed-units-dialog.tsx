import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
import TagBox from 'devextreme-react/tag-box';
import notify from 'devextreme/ui/notify';
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
import { createEntityStore, ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';

interface AppOption {
  appId: number;
  appDesc: string;
}

interface OrgOption {
  placementId: number;
  title: string;
}

interface DraftUnit {
  tempId: string;
  baseunit: string;
  managedunit: string;
  managednotes: string;
}

let tempIdCounter = 0;
const nextTempId = () => `tmp-${++tempIdCounter}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// Same shape as AddMultipleGroupsDialog: pick the app once (locked after that),
// build a flat list of managed-unit drafts, then save them all in one go.
// Each "add to list" can push several drafts at once (one base unit -> many
// managed units, selected via TagBox), covering the "many managed units per
// base unit" case; repeating it lets you also cover several base units.
export default function AddMultipleManagedUnitsDialog({ open, onOpenChange, onSaved }: Props) {
  const appsStore = useMemo(() => createEntityStore('Applications', 'appId'), []);
  const orgsStore = useMemo(() => createEntityStore('Organizations', 'placementId'), []);

  const [apps, setApps] = useState<AppOption[]>([]);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [appId, setAppId] = useState('');
  const [drafts, setDrafts] = useState<DraftUnit[]>([]);
  const [baseunit, setBaseunit] = useState('');
  const [managedIds, setManagedIds] = useState<number[]>([]);
  const [managednotes, setManagednotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    appsStore.load({}).then((data: any) => setApps(data ?? []));
    orgsStore.load({}).then((data: any) => setOrgOptions(data ?? []));
  }, [open, appsStore, orgsStore]);

  function reset() {
    setAppId('');
    setDrafts([]);
    setBaseunit('');
    setManagedIds([]);
    setManagednotes('');
    setSubmitError(null);
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function orgTitle(placementId: string) {
    return orgOptions.find((o) => String(o.placementId) === placementId)?.title ?? placementId;
  }

  function canAddDrafts() {
    return !!baseunit && managedIds.length > 0;
  }

  function addDrafts() {
    if (!canAddDrafts()) return;
    setDrafts((d) => [
      ...d,
      ...managedIds.map((managedId) => ({
        tempId: nextTempId(),
        baseunit,
        managedunit: String(managedId),
        managednotes: managednotes.trim(),
      })),
    ]);
    setBaseunit('');
    setManagedIds([]);
    setManagednotes('');
  }

  function removeDraft(tempId: string) {
    setDrafts((d) => d.filter((x) => x.tempId !== tempId));
  }

  async function handleSaveAll() {
    if (!appId || drafts.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const muStore = createEntityStore('ManagedUnits', 'managedunitsId');
      for (const d of drafts) {
        await muStore.insert({
          appId: Number(appId),
          baseunit: Number(d.baseunit),
          managedunit: Number(d.managedunit),
          managednotes: d.managednotes,
        });
      }
      onSaved();
      notify(`Αποθηκεύτηκαν ${drafts.length} διαχειριζόμενες μονάδες.`, 'success', 2500);
      close();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Άγνωστο σφάλμα κατά την αποθήκευση.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" onInteractOutside={ignoreDevExtremeOverlayInteraction}>
        <DialogHeader>
          <DialogTitle>Προσθήκη Πολλαπλών Διαχειριζόμενων Μονάδων</DialogTitle>
          <DialogDescription>Επίλεξε εφαρμογή, χτίσε τη λίστα και αποθήκευσέ τις όλες μαζί.</DialogDescription>
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
              value={appId}
              onValueChange={(v) => {
                setAppId(v);
                setDrafts([]);
              }}
              disabled={!!appId}
              options={apps.map((a) => ({ value: String(a.appId), label: a.appDesc }))}
              placeholder="Επιλέξτε εφαρμογή"
            />
            {!appId && <p className="text-xs text-muted-foreground">Υποχρεωτικό — επιλέξτε πρώτα εφαρμογή.</p>}
            {appId && <p className="text-xs text-muted-foreground">Η επιλογή κλειδώνει μετά την πρώτη επιλογή — κλείσε και ξανάνοιξε το παράθυρο για άλλη εφαρμογή.</p>}
          </div>

          {appId && (
            <>
              <div className="grid grid-cols-2 gap-3 border-t pt-4">
                <div className="space-y-2">
                  <Label>Βασική Μονάδα *</Label>
                  <Combobox
                    value={baseunit}
                    onValueChange={setBaseunit}
                    options={orgOptions.map((o) => ({ value: String(o.placementId), label: o.title }))}
                    placeholder="Επιλέξτε μονάδα"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Σημειώσεις</Label>
                  <Textarea value={managednotes} onChange={(e) => setManagednotes(e.target.value)} />
                </div>
                <div className="space-y-2 col-span-2">
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
                </div>
              </div>

              <Button type="button" variant="outline" onClick={addDrafts} disabled={!canAddDrafts()}>
                + Προσθήκη στη λίστα ({managedIds.length || 0})
              </Button>
              {!canAddDrafts() && (
                <p className="text-xs text-muted-foreground">Υποχρεωτικά: Βασική Μονάδα και τουλάχιστον μία Διαχειριζόμενη Μονάδα.</p>
              )}

              <div className="border rounded-md p-3 space-y-1 min-h-16">
                <Label className="text-sm">Διαχειριζόμενες μονάδες προς αποθήκευση ({drafts.length})</Label>
                {drafts.length === 0 && <p className="text-sm text-muted-foreground">Δεν έχουν προστεθεί ακόμα.</p>}
                {drafts.map((d) => (
                  <div key={d.tempId} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-sm">{orgTitle(d.baseunit)} → {orgTitle(d.managedunit)}</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeDraft(d.tempId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>Άκυρο</Button>
          <Button type="button" onClick={handleSaveAll} disabled={!appId || drafts.length === 0 || submitting}>
            {submitting ? 'Αποθήκευση...' : `Αποθήκευση Όλων (${drafts.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
