import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper';
import { AlertCircle, Trash2, X } from 'lucide-react';
import TagBox from 'devextreme-react/tag-box';
import { createEntityStore } from '@/components/common/entity-grid';
import { getAuth } from '@/auth/lib/helpers';
import { useAuth } from '@/auth/context/auth-context';
import { PageItem } from '@/auth/lib/models';

const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL_LOCAL
  : import.meta.env.VITE_API_URL;

const ROOT_PARENT = '__root__';

// Mirrors every WAM_APP_FORMS column (minus AppFormsId/AppId/Navhaschildren,
// which are server-assigned or derived from the tree at submit time).
interface PageDraft {
  tempId: string;
  parentTempId: string | null;
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
  /** WAM_AD_RIGHTS this page/form is linked to — each with its own Canedit (WAM_APP_FORMS_RIGHT.Canedit). */
  rightLinks: RightLink[];
}

interface RightLink {
  rightId: number;
  canEdit: boolean;
}

const emptyPageForm = {
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
  parent: ROOT_PARENT,
  rightLinks: [] as RightLink[],
};

interface GroupDraft {
  tempId: string;
  groupName: string;
  unitId: string; // sentinel-based Select value ('' = unset)
  rightId: string; // WAM_AD_RIGHTS id this group is linked to (exactly one, required)
}

interface ManagedUnitDraft {
  tempId: string;
  baseunit: string;
  managedunit: string;
  managednotes: string;
}

interface OrgOption {
  placementId: number;
  title: string;
}

interface AdRightOption {
  addRightsId: number;
  descr: string;
}

let tempIdCounter = 0;
const nextTempId = () => `tmp-${++tempIdCounter}`;

const STEPS = [
  { step: 1, title: 'Εφαρμογή' },
  { step: 2, title: 'Σελίδες' },
  { step: 3, title: 'Groups' },
  { step: 4, title: 'Managed Units' },
  { step: 5, title: 'Επιβεβαίωση' },
];

// Builds the indented page list for both the step-2 tree view and the final review.
function buildPageRows(pages: PageDraft[]): Array<{ page: PageDraft; depth: number }> {
  const byParent = new Map<string | null, PageDraft[]>();
  for (const p of pages) {
    const list = byParent.get(p.parentTempId) ?? [];
    list.push(p);
    byParent.set(p.parentTempId, list);
  }
  const rows: Array<{ page: PageDraft; depth: number }> = [];
  const walk = (parentTempId: string | null, depth: number) => {
    for (const p of byParent.get(parentTempId) ?? []) {
      rows.push({ page: p, depth });
      walk(p.tempId, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

function authHeader() {
  const auth = getAuth();
  return auth?.token ? { Authorization: `Bearer ${auth.token}` } : {};
}

// Routes are built from navUrl (see app-routing-setup.tsx), not from the
// entity name — look up the real navUrl for "Applications" instead of
// hardcoding a path that may not match what's seeded in WAM_APP_FORMS.
function findApplicationsPath(pages: PageItem[] | undefined): string {
  const FALLBACK = '/pages/Applications';
  if (!pages?.length) return FALLBACK;
  const walk = (items: PageItem[]): string | null => {
    for (const p of items) {
      if (p.routeElement === 'Applications' && p.navUrl) return p.navUrl;
      if (p.pages?.length) {
        const found = walk(p.pages);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(pages) ?? FALLBACK;
}

interface WizardLocationState {
  /** Set when arriving from the Applications grid's "add" prompt — the
   * Application row already exists, so Step 1 is locked and handleSubmit
   * must not create a duplicate. */
  existingAppId?: number;
  existingAppName?: string;
}

export default function AppWizardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pagesAllowed } = useAuth();
  const applicationsPath = useMemo(() => findApplicationsPath(pagesAllowed), [pagesAllowed]);
  const locationState = location.state as WizardLocationState | null;
  const existingAppId = locationState?.existingAppId ?? null;
  const [step, setStep] = useState(1);

  const [appName, setAppName] = useState(locationState?.existingAppName ?? '');

  const [pages, setPages] = useState<PageDraft[]>([]);
  const [pageForm, setPageForm] = useState(emptyPageForm);
  const [newRightDescr, setNewRightDescr] = useState('');

  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupUnitId, setGroupUnitId] = useState('');
  const [groupRightId, setGroupRightId] = useState('');

  const [managedUnits, setManagedUnits] = useState<ManagedUnitDraft[]>([]);
  const [muBase, setMuBase] = useState('');
  const [muManagedIds, setMuManagedIds] = useState<number[]>([]);
  const [muNotes, setMuNotes] = useState('');

  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [adRightOptions, setAdRightOptions] = useState<AdRightOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/Organizations`, { headers: authHeader() })
      .then((res) => setOrgOptions(res.data?.data ?? []))
      .catch(() => setOrgOptions([]));
    axios
      .get(`${API_BASE_URL}/AdRights`, { headers: authHeader() })
      .then((res) => setAdRightOptions(res.data?.data ?? []))
      .catch(() => setAdRightOptions([]));
  }, []);

  const pageRows = useMemo(() => buildPageRows(pages), [pages]);

  function updatePageForm<K extends keyof typeof emptyPageForm>(key: K, value: (typeof emptyPageForm)[K]) {
    setPageForm((f) => ({ ...f, [key]: value }));
  }

  function toggleRight(rightId: number) {
    setPageForm((f) => {
      const isSelected = f.rightLinks.some((rl) => rl.rightId === rightId);
      return {
        ...f,
        rightLinks: isSelected
          ? f.rightLinks.filter((rl) => rl.rightId !== rightId)
          : [...f.rightLinks, { rightId, canEdit: false }],
      };
    });
  }

  function setRightCanEdit(rightId: number, canEdit: boolean) {
    setPageForm((f) => ({
      ...f,
      rightLinks: f.rightLinks.map((rl) => (rl.rightId === rightId ? { ...rl, canEdit } : rl)),
    }));
  }

  async function addNewRight() {
    if (!newRightDescr.trim()) return;
    const store = createEntityStore('AdRights', 'addRightsId');
    const created = (await store.insert({ descr: newRightDescr.trim() })) as AdRightOption;
    setAdRightOptions((opts) => [...opts, created]);
    setNewRightDescr('');
  }

  function canAddPage() {
    return pageForm.name.trim().length > 0 && pageForm.navTitle.trim().length > 0 && pageForm.rightLinks.length > 0;
  }

  function addPage() {
    if (!canAddPage()) return;
    setPages((p) => [
      ...p,
      {
        tempId: nextTempId(),
        parentTempId: pageForm.parent === ROOT_PARENT ? null : pageForm.parent,
        name: pageForm.name.trim(),
        navTitle: pageForm.navTitle.trim(),
        navUrl: pageForm.navUrl.trim(),
        routeElement: pageForm.routeElement.trim(),
        routeCombPath: pageForm.routeCombPath.trim(),
        navIcon: pageForm.navIcon.trim(),
        navFontIcon: pageForm.navFontIcon.trim(),
        navHasBullet: pageForm.navHasBullet,
        canEdit: pageForm.canEdit,
        visible: pageForm.visible,
        devVisible: pageForm.devVisible,
        ordervalue: pageForm.ordervalue,
        onlyRoute: pageForm.onlyRoute,
        isExternalLink: pageForm.isExternalLink,
        rightLinks: pageForm.rightLinks,
      },
    ]);
    setPageForm(emptyPageForm);
  }

  function removePage(tempId: string) {
    const toRemove = new Set([tempId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of pages) {
        if (p.parentTempId && toRemove.has(p.parentTempId) && !toRemove.has(p.tempId)) {
          toRemove.add(p.tempId);
          changed = true;
        }
      }
    }
    setPages((p) => p.filter((x) => !toRemove.has(x.tempId)));
  }

  function addGroup() {
    if (!groupName.trim() || !groupRightId || !groupUnitId) return;
    setGroups((g) => [
      ...g,
      { tempId: nextTempId(), groupName: groupName.trim(), unitId: groupUnitId, rightId: groupRightId },
    ]);
    setGroupName('');
    setGroupUnitId('');
    setGroupRightId('');
  }

  function removeGroup(tempId: string) {
    setGroups((g) => g.filter((x) => x.tempId !== tempId));
  }

  function addManagedUnit() {
    if (!muBase || muManagedIds.length === 0) return;
    setManagedUnits((m) => [
      ...m,
      ...muManagedIds.map((managedId) => ({
        tempId: nextTempId(),
        baseunit: muBase,
        managedunit: String(managedId),
        managednotes: muNotes.trim(),
      })),
    ]);
    setMuBase('');
    setMuManagedIds([]);
    setMuNotes('');
  }

  function removeManagedUnit(tempId: string) {
    setManagedUnits((m) => m.filter((x) => x.tempId !== tempId));
  }

  function orgTitle(placementId?: number | null) {
    if (!placementId) return '';
    return orgOptions.find((o) => o.placementId === placementId)?.title ?? `#${placementId}`;
  }

  function rightDescrById(rightId: string) {
    return adRightOptions.find((r) => String(r.addRightsId) === rightId)?.descr ?? rightId;
  }

  function rightDescr(rightId: number) {
    return adRightOptions.find((r) => r.addRightsId === rightId)?.descr ?? `#${rightId}`;
  }

  function rightLinkLabel(link: RightLink) {
    return `${rightDescr(link.rightId)}${link.canEdit ? ' (edit)' : ''}`;
  }

  // Gate: 2 needs a name, 3 needs at least one page, 4 needs at least one group.
  function canGoToStep(targetStep: number) {
    if (targetStep >= 2 && !appName.trim()) return false;
    if (targetStep >= 3 && pages.length === 0) return false;
    if (targetStep >= 4 && groups.length === 0) return false;
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      let newAppId = existingAppId;
      if (!newAppId) {
        const appsStore = createEntityStore('Applications', 'appId');
        const createdApp = (await appsStore.insert({ appDesc: appName.trim() })) as { appId: number };
        newAppId = createdApp.appId;
      }

      const formsStore = createEntityStore('AppForms', 'appFormsId');
      const rightsStore = createEntityStore('AppFormsRights', 'id');
      const tempToReal = new Map<string, number>();
      let currentLevel = pages.filter((p) => p.parentTempId === null);
      while (currentLevel.length > 0) {
        for (const p of currentLevel) {
          const realParentId = p.parentTempId ? tempToReal.get(p.parentTempId)! : 0;
          const hasChildren = pages.some((c) => c.parentTempId === p.tempId);
          const created = (await formsStore.insert({
            appId: newAppId,
            parentid: realParentId,
            name: p.name,
            navtitle: p.navTitle,
            navurl: p.navUrl,
            routeelement: p.routeElement,
            routecombpath: p.routeCombPath,
            navicon: p.navIcon,
            navfonticon: p.navFontIcon,
            navhasbullet: p.navHasBullet,
            navhaschildren: hasChildren,
            canedit: p.canEdit,
            visible: p.visible,
            devvisible: p.devVisible,
            ordervalue: p.ordervalue,
            onlyroute: p.onlyRoute,
            isexternallink: p.isExternalLink,
          })) as { appFormsId: number };
          tempToReal.set(p.tempId, created.appFormsId);

          for (const link of p.rightLinks) {
            await rightsStore.insert({
              appId: newAppId,
              appFormsId: created.appFormsId,
              addRightsId: link.rightId,
              canedit: link.canEdit,
            });
          }
        }
        currentLevel = pages.filter(
          (p) => p.parentTempId !== null && tempToReal.has(p.parentTempId) && !tempToReal.has(p.tempId),
        );
      }

      const groupsStore = createEntityStore('Groups', 'groupId');
      const groupRightsStore = createEntityStore('GroupRights', 'groupRightId');
      for (const g of groups) {
        const createdGroup = (await groupsStore.insert({
          appId: newAppId,
          groupName: g.groupName,
          unitId: g.unitId ? Number(g.unitId) : null,
        })) as { groupId: number };
        await groupRightsStore.insert({ groupId: createdGroup.groupId, addRightsId: Number(g.rightId) });
      }

      const muStore = createEntityStore('ManagedUnits', 'managedunitsId');
      for (const mu of managedUnits) {
        await muStore.insert({
          appId: newAppId,
          baseunit: Number(mu.baseunit),
          managedunit: Number(mu.managedunit),
          managednotes: mu.managednotes,
        });
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Άγνωστο σφάλμα κατά την αποθήκευση.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Alert appearance="light">
          <AlertTitle>Η εφαρμογή "{appName}" δημιουργήθηκε επιτυχώς.</AlertTitle>
        </Alert>
        <Button onClick={() => navigate(applicationsPath)}>Μετάβαση στις Εφαρμογές</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Νέα Εφαρμογή — Wizard</h1>
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(applicationsPath)} title="Κλείσιμο">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Stepper value={step} onValueChange={setStep}>
          <StepperNav>
            {STEPS.map((s, idx) => (
              <StepperItem key={s.step} step={s.step} completed={step > s.step} disabled={!canGoToStep(s.step)}>
                <StepperTrigger>
                  <StepperIndicator>{s.step}</StepperIndicator>
                  <StepperTitle className="hidden sm:block">{s.title}</StepperTitle>
                </StepperTrigger>
                {idx < STEPS.length - 1 && <StepperSeparator />}
              </StepperItem>
            ))}
          </StepperNav>

          <StepperPanel className="mt-6">
            {/* Step 1 — App name */}
            <StepperContent value={1}>
              <Card>
                <CardHeader><CardTitle>Όνομα Εφαρμογής</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="appName">Περιγραφή Εφαρμογής *</Label>
                    <Input
                      id="appName"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="π.χ. Νέα Εφαρμογή"
                      disabled={!!existingAppId}
                    />
                    {existingAppId && (
                      <p className="text-xs text-muted-foreground">Η εφαρμογή έχει ήδη δημιουργηθεί — συνεχίστε στα επόμενα βήματα.</p>
                    )}
                    {!existingAppId && !appName.trim() && <p className="text-xs text-muted-foreground">Υποχρεωτικό πεδίο για να προχωρήσετε.</p>}
                  </div>
                </CardContent>
              </Card>
            </StepperContent>

            {/* Step 2 — Pages tree, every WAM_APP_FORMS field + linked rights */}
            <StepperContent value={2}>
              <Card>
                <CardHeader><CardTitle>Σελίδες Εφαρμογής</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Όνομα Σελίδας *</Label>
                      <Input value={pageForm.name} onChange={(e) => updatePageForm('name', e.target.value)} placeholder="π.χ. Στατιστικά" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nav Title *</Label>
                      <Input value={pageForm.navTitle} onChange={(e) => updatePageForm('navTitle', e.target.value)} placeholder="π.χ. Στατιστικά" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nav Url</Label>
                      <Input value={pageForm.navUrl} onChange={(e) => updatePageForm('navUrl', e.target.value)} placeholder="/pages/statistics" />
                    </div>
                    <div className="space-y-2">
                      <Label>Route Element</Label>
                      <Input value={pageForm.routeElement} onChange={(e) => updatePageForm('routeElement', e.target.value)} placeholder="Statistics" />
                    </div>
                    <div className="space-y-2">
                      <Label>Route Comb Path</Label>
                      <Input value={pageForm.routeCombPath} onChange={(e) => updatePageForm('routeCombPath', e.target.value)} placeholder="/pages/Statistics" />
                    </div>
                    <div className="space-y-2">
                      <Label>Order</Label>
                      <Input
                        type="number"
                        value={pageForm.ordervalue}
                        onChange={(e) => updatePageForm('ordervalue', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nav Icon</Label>
                      <Input value={pageForm.navIcon} onChange={(e) => updatePageForm('navIcon', e.target.value)} placeholder="/media/icons/duotone/general/gen001.svg" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nav Font Icon</Label>
                      <Input value={pageForm.navFontIcon} onChange={(e) => updatePageForm('navFontIcon', e.target.value)} placeholder="bi-archive" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Γονική Σελίδα</Label>
                      <Combobox
                        value={pageForm.parent}
                        onValueChange={(v) => updatePageForm('parent', v)}
                        options={[
                          { value: ROOT_PARENT, label: '— Ριζική σελίδα (χωρίς γονέα) —' },
                          ...pages.map((p) => ({ value: p.tempId, label: p.name })),
                        ]}
                      />
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
                            id={key}
                            checked={pageForm[key]}
                            onCheckedChange={(c) => updatePageForm(key, c === true)}
                          />
                          <Label htmlFor={key}>{label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Linked rights (WAM_AD_RIGHTS -> WAM_APP_FORMS_RIGHT), each with its own Canedit */}
                  <div className="space-y-2 border-t pt-4">
                    <Label>Δικαιώματα που βλέπουν αυτή τη σελίδα * (τουλάχιστον ένα)</Label>
                    <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                      {adRightOptions.length === 0 && <p className="text-sm text-muted-foreground">Δεν υπάρχουν ακόμα δικαιώματα.</p>}
                      {adRightOptions.map((r) => {
                        const link = pageForm.rightLinks.find((rl) => rl.rightId === r.addRightsId);
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
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-2">
                        <Label>Νέο δικαίωμα</Label>
                        <Input value={newRightDescr} onChange={(e) => setNewRightDescr(e.target.value)} placeholder="π.χ. Supervisor" />
                      </div>
                      <Button type="button" variant="outline" onClick={addNewRight} disabled={!newRightDescr.trim()}>
                        + Δικαίωμα
                      </Button>
                    </div>
                  </div>

                  <Button type="button" onClick={addPage} disabled={!canAddPage()}>Προσθήκη Σελίδας</Button>
                  {!canAddPage() && (
                    <p className="text-xs text-muted-foreground">
                      Υποχρεωτικά: Όνομα Σελίδας, Nav Title και τουλάχιστον ένα δικαίωμα.
                    </p>
                  )}

                  <div className="border rounded-md p-3 space-y-1 min-h-16">
                    {pageRows.length === 0 && <p className="text-sm text-muted-foreground">Δεν έχουν προστεθεί σελίδες ακόμα.</p>}
                    {pageRows.map(({ page, depth }) => (
                      <div key={page.tempId} className="flex items-center justify-between gap-2 py-1" style={{ paddingLeft: depth * 20 }}>
                        <span className="text-sm">
                          {depth > 0 && '└ '}{page.name} <span className="text-muted-foreground">({page.navUrl || '—'})</span>
                          {page.rightLinks.length > 0 && (
                            <span className="text-muted-foreground"> — {page.rightLinks.map(rightLinkLabel).join(', ')}</span>
                          )}
                        </span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removePage(page.tempId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </StepperContent>

            {/* Step 3 — Groups */}
            <StepperContent value={3}>
              <Card>
                <CardHeader><CardTitle>Groups</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Όνομα Group</Label>
                      <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="π.χ. Διαχειριστές" />
                    </div>
                    <div className="space-y-2">
                      <Label>Μονάδα *</Label>
                      <Combobox
                        value={groupUnitId}
                        onValueChange={setGroupUnitId}
                        options={orgOptions.map((o) => ({ value: String(o.placementId), label: o.title }))}
                        placeholder="Επιλέξτε μονάδα"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Δικαίωμα (WAM_AD_RIGHTS) *</Label>
                      <Combobox
                        value={groupRightId}
                        onValueChange={setGroupRightId}
                        options={adRightOptions.map((r) => ({ value: String(r.addRightsId), label: r.descr }))}
                        placeholder="Επιλέξτε δικαίωμα"
                      />
                    </div>
                  </div>
                  <Button type="button" onClick={addGroup} disabled={!groupName.trim() || !groupRightId || !groupUnitId}>Προσθήκη Group</Button>

                  <div className="border rounded-md p-3 space-y-1 min-h-16">
                    {groups.length === 0 && <p className="text-sm text-muted-foreground">Δεν έχουν προστεθεί groups ακόμα.</p>}
                    {groups.map((g) => (
                      <div key={g.tempId} className="flex items-center justify-between gap-2 py-1">
                        <span className="text-sm">
                          {g.groupName} {g.unitId && `— ${orgTitle(Number(g.unitId))}`} — {rightDescrById(g.rightId)}
                        </span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeGroup(g.tempId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </StepperContent>

            {/* Step 4 — Managed units */}
            <StepperContent value={4}>
              <Card>
                <CardHeader><CardTitle>Managed Units</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Βασική Μονάδα</Label>
                      <Combobox
                        value={muBase}
                        onValueChange={setMuBase}
                        options={orgOptions.map((o) => ({ value: String(o.placementId), label: o.title }))}
                        placeholder="Επιλέξτε μονάδα"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Διαχειριζόμενες Μονάδες (πολλαπλή επιλογή)</Label>
                      <TagBox
                        dataSource={orgOptions}
                        valueExpr="placementId"
                        displayExpr="title"
                        value={muManagedIds}
                        onValueChanged={(e) => setMuManagedIds(e.value ?? [])}
                        searchEnabled
                        showSelectionControls
                        applyValueMode="instantly"
                        placeholder="Επιλέξτε μονάδες..."
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Σημειώσεις</Label>
                      <Textarea value={muNotes} onChange={(e) => setMuNotes(e.target.value)} />
                    </div>
                  </div>
                  <Button type="button" onClick={addManagedUnit} disabled={!muBase || muManagedIds.length === 0}>
                    Προσθήκη ({muManagedIds.length || 0})
                  </Button>

                  <div className="border rounded-md p-3 space-y-1 min-h-16">
                    {managedUnits.length === 0 && <p className="text-sm text-muted-foreground">Δεν έχουν προστεθεί ακόμα.</p>}
                    {managedUnits.map((mu) => (
                      <div key={mu.tempId} className="flex items-center justify-between gap-2 py-1">
                        <span className="text-sm">{orgTitle(Number(mu.baseunit))} → {orgTitle(Number(mu.managedunit))}</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeManagedUnit(mu.tempId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </StepperContent>

            {/* Step 5 — Review & submit */}
            <StepperContent value={5}>
              <Card>
                <CardHeader><CardTitle>Επιβεβαίωση</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {submitError && (
                    <Alert variant="destructive" appearance="light">
                      <AlertIcon><AlertCircle /></AlertIcon>
                      <AlertTitle>{submitError}</AlertTitle>
                    </Alert>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Έλεγξε τη σύνοψη στα δεξιά. Πατώντας "Ολοκλήρωση" θα δημιουργηθούν η εφαρμογή,
                    οι {pages.length} σελίδες (με τα δικαιώματά τους), τα {groups.length} groups και οι {managedUnits.length} managed units.
                  </p>
                  <Button onClick={handleSubmit} disabled={submitting || !canGoToStep(5)}>
                    {submitting ? 'Αποθήκευση...' : 'Ολοκλήρωση'}
                  </Button>
                </CardContent>
              </Card>
            </StepperContent>
          </StepperPanel>
        </Stepper>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
            Πίσω
          </Button>
          {step < 5 && (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(5, s + 1))}
              disabled={!canGoToStep(step + 1)}
            >
              Επόμενο
            </Button>
          )}
        </div>
        {step === 2 && pages.length === 0 && (
          <p className="text-xs text-muted-foreground text-right">Χρειάζεται τουλάχιστον μία σελίδα για να προχωρήσετε.</p>
        )}
        {step === 3 && groups.length === 0 && (
          <p className="text-xs text-muted-foreground text-right">Χρειάζεται τουλάχιστον ένα group για να προχωρήσετε.</p>
        )}
      </div>

      {/* Live summary — visible on every step */}
      <div className="lg:col-span-1">
        <Card className="sticky top-6">
          <CardHeader><CardTitle>Σύνοψη</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Εφαρμογή</p>
              <p className="text-muted-foreground">{appName || '—'}</p>
            </div>
            <div>
              <p className="font-medium">Σελίδες ({pages.length})</p>
              {pageRows.length === 0 && <p className="text-muted-foreground">—</p>}
              {pageRows.map(({ page, depth }) => (
                <p key={page.tempId} className="text-muted-foreground" style={{ paddingLeft: depth * 12 }}>
                  {depth > 0 && '└ '}{page.name}
                  {page.rightLinks.length > 0 && ` (${page.rightLinks.map(rightLinkLabel).join(', ')})`}
                </p>
              ))}
            </div>
            <div>
              <p className="font-medium">Groups ({groups.length})</p>
              {groups.length === 0 && <p className="text-muted-foreground">—</p>}
              {groups.map((g) => (
                <p key={g.tempId} className="text-muted-foreground">{g.groupName} — {rightDescrById(g.rightId)}</p>
              ))}
            </div>
            <div>
              <p className="font-medium">Managed Units ({managedUnits.length})</p>
              {managedUnits.length === 0 && <p className="text-muted-foreground">—</p>}
              {managedUnits.map((mu) => (
                <p key={mu.tempId} className="text-muted-foreground">
                  {orgTitle(Number(mu.baseunit))} → {orgTitle(Number(mu.managedunit))}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
