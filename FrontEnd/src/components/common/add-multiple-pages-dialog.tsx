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

const ROOT_PARENT = 'root';
const EXISTING_PREFIX = 'existing:';
const DRAFT_PREFIX = 'draft:';

interface AppOption {
  appId: number;
  appDesc: string;
}

interface ExistingPage {
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

interface DraftPage {
  tempId: string;
  parent: string; // 'root' | 'existing:<id>' | 'draft:<tempId>'
  name: string;
  navTitle: string;
  navUrl: string;
  routeElement: string;
  routeCombPath: string;
  navIcon: string;
  navFontIcon: string;
  navHasBullet: boolean;
  canEdit: boolean;
  visible: boolean;
  devVisible: boolean;
  ordervalue: number;
  onlyRoute: boolean;
  isExternalLink: boolean;
  rightLinks: RightLink[];
}

const emptyDraftForm = {
  parent: ROOT_PARENT,
  name: '',
  navTitle: '',
  navUrl: '',
  routeElement: '',
  routeCombPath: '',
  navIcon: '',
  navFontIcon: '',
  navHasBullet: true,
  canEdit: false,
  visible: true,
  devVisible: true,
  ordervalue: 0,
  onlyRoute: false,
  isExternalLink: false,
  rightLinks: [] as RightLink[],
};

let tempIdCounter = 0;
const nextTempId = () => `tmp-${++tempIdCounter}`;

function draftLabel(d: DraftPage) {
  return d.name || '(χωρίς όνομα)';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// Builds several AppForms rows (with parent/child relations to each other,
// to existing pages, or to the app root) in one go, each with its own rights.
// Mirrors the app-wizard's page-tree step, but targets an app that already
// exists instead of one being created in the same flow.
export default function AddMultiplePagesDialog({ open, onOpenChange, onSaved }: Props) {
  const appsStore = useMemo(() => createEntityStore('Applications', 'appId'), []);
  const adRightsStore = useMemo(() => createEntityStore('AdRights', 'addRightsId'), []);
  const formsStore = useMemo(() => createEntityStore('AppForms', 'appFormsId'), []);

  const [apps, setApps] = useState<AppOption[]>([]);
  const [adRightOptions, setAdRightOptions] = useState<AdRightOption[]>([]);
  const [appId, setAppId] = useState('');
  const [existingPages, setExistingPages] = useState<ExistingPage[]>([]);
  const [drafts, setDrafts] = useState<DraftPage[]>([]);
  const [form, setForm] = useState(emptyDraftForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    appsStore.load({}).then((data: any) => setApps(data ?? []));
    adRightsStore.load({}).then((data: any) => setAdRightOptions(data ?? []));
  }, [open, appsStore, adRightsStore]);

  useEffect(() => {
    if (!appId) {
      setExistingPages([]);
      return;
    }
    formsStore.load({ filter: ['appId', '=', Number(appId)] }).then((data: any) => setExistingPages(data ?? []));
  }, [appId, formsStore]);

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

  function toggleRight(rightId: number) {
    setForm((f) => {
      const isSelected = f.rightLinks.some((l) => l.rightId === rightId);
      return {
        ...f,
        rightLinks: isSelected
          ? f.rightLinks.filter((l) => l.rightId !== rightId)
          : [...f.rightLinks, { rightId, canEdit: false }],
      };
    });
  }

  function setRightCanEdit(rightId: number, canEdit: boolean) {
    setForm((f) => ({
      ...f,
      rightLinks: f.rightLinks.map((l) => (l.rightId === rightId ? { ...l, canEdit } : l)),
    }));
  }

  function canAddDraft() {
    return form.name.trim().length > 0 && form.navTitle.trim().length > 0 && form.rightLinks.length > 0;
  }

  function addDraft() {
    if (!canAddDraft()) return;
    setDrafts((d) => [
      ...d,
      {
        tempId: nextTempId(),
        parent: form.parent,
        name: form.name.trim(),
        navTitle: form.navTitle.trim(),
        navUrl: form.navUrl.trim(),
        routeElement: form.routeElement.trim(),
        routeCombPath: form.routeCombPath.trim(),
        navIcon: form.navIcon.trim(),
        navFontIcon: form.navFontIcon.trim(),
        navHasBullet: form.navHasBullet,
        canEdit: form.canEdit,
        visible: form.visible,
        devVisible: form.devVisible,
        ordervalue: form.ordervalue,
        onlyRoute: form.onlyRoute,
        isExternalLink: form.isExternalLink,
        rightLinks: form.rightLinks,
      },
    ]);
    setForm(emptyDraftForm);
  }

  function removeDraft(tempId: string) {
    const toRemove = new Set([tempId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const d of drafts) {
        if (d.parent === `${DRAFT_PREFIX}${tempId}` && !toRemove.has(d.tempId)) {
          toRemove.add(d.tempId);
          changed = true;
        }
      }
    }
    setDrafts((d) => d.filter((x) => !toRemove.has(x.tempId)));
  }

  function parentDisplay(parent: string): string {
    if (parent === ROOT_PARENT) return 'Ριζική σελίδα';
    if (parent.startsWith(EXISTING_PREFIX)) {
      const id = Number(parent.slice(EXISTING_PREFIX.length));
      return existingPages.find((p) => p.appFormsId === id)?.name ?? `#${id}`;
    }
    const tempId = parent.slice(DRAFT_PREFIX.length);
    return drafts.find((d) => d.tempId === tempId)?.name ?? '—';
  }

  async function handleSaveAll() {
    if (!appId || drafts.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const rightsStore = createEntityStore('AppFormsRights', 'id');
      const tempToReal = new Map<string, number>();
      let remaining = [...drafts];

      while (remaining.length > 0) {
        const readyNow = remaining.filter(
          (d) => !d.parent.startsWith(DRAFT_PREFIX) || tempToReal.has(d.parent.slice(DRAFT_PREFIX.length)),
        );
        if (readyNow.length === 0) break; // safety net, shouldn't happen — UI only offers already-added drafts as parents

        for (const d of readyNow) {
          const realParentId = d.parent === ROOT_PARENT
            ? 0
            : d.parent.startsWith(EXISTING_PREFIX)
              ? Number(d.parent.slice(EXISTING_PREFIX.length))
              : tempToReal.get(d.parent.slice(DRAFT_PREFIX.length))!;
          const hasChildren = drafts.some((c) => c.parent === `${DRAFT_PREFIX}${d.tempId}`);

          const created = (await formsStore.insert({
            appId: Number(appId),
            parentid: realParentId,
            name: d.name,
            navtitle: d.navTitle,
            navurl: d.navUrl,
            routeelement: d.routeElement,
            routecombpath: d.routeCombPath,
            navicon: d.navIcon,
            navfonticon: d.navFontIcon,
            navhasbullet: d.navHasBullet,
            navhaschildren: hasChildren,
            canedit: d.canEdit,
            visible: d.visible,
            devvisible: d.devVisible,
            ordervalue: d.ordervalue,
            onlyroute: d.onlyRoute,
            isexternallink: d.isExternalLink,
          })) as { appFormsId: number };
          tempToReal.set(d.tempId, created.appFormsId);

          for (const link of d.rightLinks) {
            await rightsStore.insert({
              appId: Number(appId),
              appFormsId: created.appFormsId,
              addRightsId: link.rightId,
              canedit: link.canEdit,
            });
          }
        }
        remaining = remaining.filter((d) => !tempToReal.has(d.tempId));
      }

      onSaved();
      notify(`Αποθηκεύτηκαν ${drafts.length} σελίδες.`, 'success', 2500);
      close();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Άγνωστο σφάλμα κατά την αποθήκευση.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Προσθήκη Πολλαπλών Σελίδων</DialogTitle>
          <DialogDescription>Επίλεξε εφαρμογή, χτίσε τη λίστα σελίδων και αποθήκευσέ τις όλες μαζί.</DialogDescription>
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
                <div className="space-y-2 col-span-2">
                  <Label>Γονική Σελίδα</Label>
                  <Combobox
                    value={form.parent}
                    onValueChange={(v) => updateForm('parent', v)}
                    options={[
                      { value: ROOT_PARENT, label: '— Ριζική σελίδα (χωρίς γονέα) —' },
                      ...existingPages.map((p) => ({ value: `${EXISTING_PREFIX}${p.appFormsId}`, label: `${p.name} (υπάρχουσα)` })),
                      ...drafts.map((d) => ({ value: `${DRAFT_PREFIX}${d.tempId}`, label: `${draftLabel(d)} (νέα)` })),
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Όνομα *</Label>
                  <Input value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nav Title *</Label>
                  <Input value={form.navTitle} onChange={(e) => updateForm('navTitle', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nav Url</Label>
                  <Input value={form.navUrl} onChange={(e) => updateForm('navUrl', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Route Element</Label>
                  <Input value={form.routeElement} onChange={(e) => updateForm('routeElement', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Route Comb Path</Label>
                  <Input value={form.routeCombPath} onChange={(e) => updateForm('routeCombPath', e.target.value)} />
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
                  <Input value={form.navIcon} onChange={(e) => updateForm('navIcon', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nav Font Icon</Label>
                  <Input value={form.navFontIcon} onChange={(e) => updateForm('navFontIcon', e.target.value)} />
                </div>

                <div className="col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {([
                    ['navHasBullet', 'Has Bullet'],
                    ['canEdit', 'Can Edit (σελίδας)'],
                    ['visible', 'Visible'],
                    ['devVisible', 'Dev Visible'],
                    ['onlyRoute', 'Only Route'],
                    ['isExternalLink', 'External Link'],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={`multi-${key}`}
                        checked={form[key]}
                        onCheckedChange={(c) => updateForm(key, c === true)}
                      />
                      <Label htmlFor={`multi-${key}`}>{label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label>Δικαιώματα που βλέπουν αυτή τη σελίδα * (τουλάχιστον ένα)</Label>
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                  {adRightOptions.length === 0 && <p className="text-sm text-muted-foreground">Δεν υπάρχουν ακόμα δικαιώματα.</p>}
                  {adRightOptions.map((r) => {
                    const link = form.rightLinks.find((l) => l.rightId === r.addRightsId);
                    return (
                      <div key={r.addRightsId} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`multi-right-${r.addRightsId}`}
                            checked={!!link}
                            onCheckedChange={() => toggleRight(r.addRightsId)}
                          />
                          <Label htmlFor={`multi-right-${r.addRightsId}`}>{r.descr}</Label>
                        </div>
                        {link && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`multi-right-edit-${r.addRightsId}`}
                              checked={link.canEdit}
                              onCheckedChange={(c) => setRightCanEdit(r.addRightsId, c === true)}
                            />
                            <Label htmlFor={`multi-right-edit-${r.addRightsId}`} className="text-xs text-muted-foreground">Edit</Label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button type="button" variant="outline" onClick={addDraft} disabled={!canAddDraft()}>
                + Προσθήκη στη λίστα
              </Button>
              {!canAddDraft() && (
                <p className="text-xs text-muted-foreground">
                  Υποχρεωτικά: Όνομα, Nav Title και τουλάχιστον ένα δικαίωμα.
                </p>
              )}

              <div className="border rounded-md p-3 space-y-1 min-h-16">
                <Label className="text-sm">Σελίδες προς αποθήκευση ({drafts.length})</Label>
                {drafts.length === 0 && <p className="text-sm text-muted-foreground">Δεν έχουν προστεθεί σελίδες ακόμα.</p>}
                {drafts.map((d) => (
                  <div key={d.tempId} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-sm">
                      {draftLabel(d)}{' '}
                      <span className="text-muted-foreground">
                        — γονέας: {parentDisplay(d.parent)}
                        {d.rightLinks.length > 0 && `, δικαιώματα: ${d.rightLinks.length}`}
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
