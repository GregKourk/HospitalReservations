import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
import notify from 'devextreme/ui/notify';
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
import { createEntityStore } from '@/components/common/entity-grid';

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

interface DraftGroup {
  tempId: string;
  groupName: string;
  hasWrite: boolean;
  unitId: string;
  hafRefId: string;
  rightId: string;
}

const emptyDraftForm = {
  groupName: '',
  hasWrite: false,
  unitId: '',
  hafRefId: '',
  rightId: '',
};

let tempIdCounter = 0;
const nextTempId = () => `tmp-${++tempIdCounter}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// Same shape as AddMultiplePagesDialog: pick the app once (locked after that),
// build a flat list of group drafts (each with exactly one AdRight), then save
// them all in one go. Groups have no parent/child relation, so no tree logic.
export default function AddMultipleGroupsDialog({ open, onOpenChange, onSaved }: Props) {
  const appsStore = useMemo(() => createEntityStore('Applications', 'appId'), []);
  const orgsStore = useMemo(() => createEntityStore('Organizations', 'placementId'), []);
  const adRightsStore = useMemo(() => createEntityStore('AdRights', 'addRightsId'), []);

  const [apps, setApps] = useState<AppOption[]>([]);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [adRightOptions, setAdRightOptions] = useState<AdRightOption[]>([]);
  const [appId, setAppId] = useState('');
  const [drafts, setDrafts] = useState<DraftGroup[]>([]);
  const [form, setForm] = useState(emptyDraftForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    appsStore.load({}).then((data: any) => setApps(data ?? []));
    orgsStore.load({}).then((data: any) => setOrgOptions(data ?? []));
    adRightsStore.load({}).then((data: any) => setAdRightOptions(data ?? []));
  }, [open, appsStore, orgsStore, adRightsStore]);

  function reset() {
    setAppId('');
    setDrafts([]);
    setForm(emptyDraftForm);
    setSubmitError(null);
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function updateForm<K extends keyof typeof emptyDraftForm>(key: K, value: (typeof emptyDraftForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function orgTitle(placementId: string) {
    return orgOptions.find((o) => String(o.placementId) === placementId)?.title ?? placementId;
  }

  function rightDescr(rightId: string) {
    return adRightOptions.find((r) => String(r.addRightsId) === rightId)?.descr ?? rightId;
  }

  function canAddDraft() {
    return form.groupName.trim().length > 0 && !!form.unitId && !!form.rightId;
  }

  function addDraft() {
    if (!canAddDraft()) return;
    setDrafts((d) => [...d, { tempId: nextTempId(), ...form, groupName: form.groupName.trim() }]);
    setForm(emptyDraftForm);
  }

  function removeDraft(tempId: string) {
    setDrafts((d) => d.filter((x) => x.tempId !== tempId));
  }

  async function handleSaveAll() {
    if (!appId || drafts.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const groupsStore = createEntityStore('Groups', 'groupId');
      const groupRightsStore = createEntityStore('GroupRights', 'groupRightId');
      for (const d of drafts) {
        const created = (await groupsStore.insert({
          appId: Number(appId),
          groupName: d.groupName,
          hasWrite: d.hasWrite,
          unitId: Number(d.unitId),
          hafRefId: d.hafRefId ? Number(d.hafRefId) : null,
        })) as { groupId: number };
        await groupRightsStore.insert({ groupId: created.groupId, addRightsId: Number(d.rightId) });
      }

      onSaved();
      notify(`Αποθηκεύτηκαν ${drafts.length} groups.`, 'success', 2500);
      close();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Άγνωστο σφάλμα κατά την αποθήκευση.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Προσθήκη Πολλαπλών Groups</DialogTitle>
          <DialogDescription>Επίλεξε εφαρμογή, χτίσε τη λίστα groups και αποθήκευσέ τα όλα μαζί.</DialogDescription>
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
                setForm(emptyDraftForm);
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
                  <Label>Όνομα Γκρουπ *</Label>
                  <Input value={form.groupName} onChange={(e) => updateForm('groupName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Μονάδα *</Label>
                  <Combobox
                    value={form.unitId}
                    onValueChange={(v) => updateForm('unitId', v)}
                    options={orgOptions.map((o) => ({ value: String(o.placementId), label: o.title }))}
                    placeholder="Επιλέξτε μονάδα"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Domain Ref ID</Label>
                  <Input type="number" value={form.hafRefId} onChange={(e) => updateForm('hafRefId', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Επιπρόσθετο Δικαίωμα * (ένα ανά group)</Label>
                  <Combobox
                    value={form.rightId}
                    onValueChange={(v) => updateForm('rightId', v)}
                    options={adRightOptions.map((r) => ({ value: String(r.addRightsId), label: r.descr }))}
                    placeholder="Επιλέξτε δικαίωμα"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="multi-hasWrite"
                    checked={form.hasWrite}
                    onCheckedChange={(c) => updateForm('hasWrite', c === true)}
                  />
                  <Label htmlFor="multi-hasWrite">Δικαίωμα Εγγραφής</Label>
                </div>
              </div>

              <Button type="button" variant="outline" onClick={addDraft} disabled={!canAddDraft()}>
                + Προσθήκη στη λίστα
              </Button>
              {!canAddDraft() && (
                <p className="text-xs text-muted-foreground">Υποχρεωτικά: Όνομα Γκρουπ, Μονάδα και Δικαίωμα.</p>
              )}

              <div className="border rounded-md p-3 space-y-1 min-h-16">
                <Label className="text-sm">Groups προς αποθήκευση ({drafts.length})</Label>
                {drafts.length === 0 && <p className="text-sm text-muted-foreground">Δεν έχουν προστεθεί groups ακόμα.</p>}
                {drafts.map((d) => (
                  <div key={d.tempId} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-sm">
                      {d.groupName}{' '}
                      <span className="text-muted-foreground">
                        — μονάδα: {orgTitle(d.unitId)}, δικαίωμα: {rightDescr(d.rightId)}
                      </span>
                    </span>
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
