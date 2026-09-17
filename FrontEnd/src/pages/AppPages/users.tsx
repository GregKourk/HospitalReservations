import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import TagBox from 'devextreme-react/tag-box';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { LoaderCircleIcon, Pencil, Search, ShieldOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  RoleLookupDto,
  UserDto,
  createUser,
  getErrorMessage,
  getRoles,
  getUsers,
  updateUserRoles,
  updateUserStatus,
} from '@/services/hospital-api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim());

const EMPTY_FORM = { email: '', fullName: '', roleIds: [] as number[] };

export default function UsersPage() {
  const { currentUser } = useAuth();
  const isSuperUser = !!currentUser?.roles.includes('SuperUser');

  const [roles, setRoles] = useState<RoleLookupDto[]>([]);
  // An Admin (not SuperUser) can't grant/revoke SuperUser — enforced
  // server-side too, this just keeps the picker from offering a choice
  // that would come back as a 403.
  const assignableRoles = useMemo(
    () => (isSuperUser ? roles : roles.filter((r) => r.name !== 'SuperUser')),
    [roles, isSuperUser]
  );

  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [emailTouched, setEmailTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const emailInvalid = emailTouched && form.email.trim().length > 0 && !isValidEmail(form.email);

  const [editing, setEditing] = useState<{ user: UserDto; roleIds: number[] } | null>(null);

  useEffect(() => {
    getRoles().then(({ data }) => setRoles(data)).catch(() => notify('Αποτυχία φόρτωσης ρόλων.', 'error', 4000));
  }, []);

  const load = () => {
    setLoading(true);
    getUsers(search.trim() || undefined, includeInactive)
      .then(({ data }) => setUsers(data))
      .catch(() => notify('Αποτυχία φόρτωσης χρηστών.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, includeInactive]);

  async function handleCreate() {
    if (!form.email.trim() || !form.fullName.trim()) {
      notify('Email και ονοματεπώνυμο είναι υποχρεωτικά.', 'warning', 3500);
      return;
    }
    if (!isValidEmail(form.email)) {
      setEmailTouched(true);
      notify('Το email δεν έχει έγκυρη μορφή.', 'warning', 3500);
      return;
    }
    if (form.roleIds.length === 0) {
      notify('Επίλεξε τουλάχιστον έναν ρόλο.', 'warning', 3500);
      return;
    }
    setSaving(true);
    try {
      await createUser({ email: form.email.trim(), fullName: form.fullName.trim(), roleIds: form.roleIds });
      notify('Ο χρήστης δημιουργήθηκε.', 'success', 2500);
      setForm(EMPTY_FORM);
      setEmailTouched(false);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η δημιουργία απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRoles() {
    if (!editing) return;
    if (editing.roleIds.length === 0) {
      notify('Ο χρήστης πρέπει να έχει τουλάχιστον έναν ρόλο.', 'warning', 3500);
      return;
    }
    setSaving(true);
    try {
      await updateUserRoles(editing.user.userId, editing.roleIds);
      notify('Οι ρόλοι ενημερώθηκαν.', 'success', 2500);
      setEditing(null);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση ρόλων απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user: UserDto) {
    const willActivate = !user.isActive;
    const ok = await confirm(
      willActivate
        ? `Ενεργοποίηση λογαριασμού "${user.fullName}";`
        : `Απενεργοποίηση λογαριασμού "${user.fullName}"; Δεν θα μπορεί να συνδεθεί.`,
      'Επιβεβαίωση'
    );
    if (!ok) return;
    try {
      await updateUserStatus(user.userId, willActivate);
      notify(willActivate ? 'Ο λογαριασμός ενεργοποιήθηκε.' : 'Ο λογαριασμός απενεργοποιήθηκε.', 'success', 2500);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενέργεια απέτυχε.'), 'error', 4500);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ρόλοι & Χρήστες</h1>
        <p className="text-sm text-muted-foreground">
          Δημιουργία λογαριασμών προσωπικού και ανάθεση ρόλων. Η πραγματική σύνδεση γίνεται πάντα μέσω Gov.gr —
          εδώ προετοιμάζεις τον λογαριασμό (email + ρόλος) πριν ή μετά την πρώτη σύνδεση του χρήστη.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Νέος χρήστης</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <Label className="mb-1.5 block">Email</Label>
            <Input
              type="email"
              value={form.email}
              aria-invalid={emailInvalid || undefined}
              onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
              onBlur={() => setEmailTouched(true)}
            />
            {emailInvalid && <p className="mt-1 text-xs text-destructive">Μη έγκυρη μορφή email.</p>}
          </div>
          <div>
            <Label className="mb-1.5 block">Ονοματεπώνυμο</Label>
            <Input value={form.fullName} onChange={(e) => setForm((v) => ({ ...v, fullName: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5 block">Ρόλοι</Label>
            <TagBox
              dataSource={assignableRoles}
              valueExpr="id"
              displayExpr="name"
              value={form.roleIds}
              onValueChanged={(e) => setForm((v) => ({ ...v, roleIds: e.value ?? [] }))}
              showSelectionControls
              applyValueMode="useButtons"
              placeholder="Επίλεξε ρόλους"
              searchEnabled
            />
          </div>
          <div>
            <Button disabled={saving} onClick={handleCreate}>
              {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Δημιουργία'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Χρήστες</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Όνομα ή email..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
              Εμφάνιση ανενεργών
            </label>
          </div>

          <DataGrid dataSource={users} keyExpr="userId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν βρέθηκαν χρήστες.">
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={10} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
            <Column dataField="fullName" caption="Ονοματεπώνυμο" />
            <Column dataField="email" caption="Email" />
            <Column
              caption="Ρόλοι"
              cellRender={({ data }: { data: UserDto }) => (
                <div className="flex flex-wrap gap-1">
                  {data.roles.map((r) => (
                    <Badge key={r} variant={r === 'SuperUser' ? 'destructive' : 'secondary'} size="sm">{r}</Badge>
                  ))}
                </div>
              )}
            />
            <Column dataField="externalProvider" caption="Πάροχος" width={110} calculateCellValue={(row: UserDto) => row.externalProvider ?? '—'} />
            <Column dataField="createdAt" caption="Δημιουργήθηκε" width={120} calculateCellValue={(row: UserDto) => format(new Date(row.createdAt), 'dd/MM/yyyy')} />
            <Column
              dataField="isActive"
              caption="Κατάσταση"
              width={110}
              cellRender={({ data }: { data: UserDto }) => (
                <Badge variant={data.isActive ? 'success' : 'outline'} size="sm">{data.isActive ? 'Ενεργός' : 'Ανενεργός'}</Badge>
              )}
            />
            <Column
              caption="Ενέργειες"
              width={110}
              cellRender={({ data }: { data: UserDto }) => {
                const isSelf = data.userId === currentUser?.userId;
                // Only a SuperUser can edit another SuperUser's roles — an
                // Admin editing them would just hit a 403 on save, since the
                // grant/revoke of SuperUser itself is server-enforced.
                const rolesLocked = data.roles.includes('SuperUser') && !isSuperUser;
                return (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={rolesLocked}
                      title={rolesLocked ? 'Μόνο ένας SuperUser μπορεί να επεξεργαστεί τους ρόλους ενός SuperUser' : 'Ρόλοι'}
                      onClick={() => setEditing({ user: data, roleIds: [] })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isSelf && data.isActive}
                      title={isSelf && data.isActive ? 'Δεν μπορείς να απενεργοποιήσεις τον εαυτό σου' : data.isActive ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}
                      onClick={() => handleToggleStatus(data)}
                    >
                      {data.isActive ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                );
              }}
            />
          </DataGrid>
        </CardContent>
      </Card>

      {editing && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) { setEditing(null); return; }
          }}
        >
          <DialogContent onInteractOutside={ignoreDevExtremeOverlayInteraction}>
            <DialogHeader><DialogTitle>Ρόλοι — {editing.user.fullName}</DialogTitle></DialogHeader>
            <DialogBody>
              <RolesEditor
                allRoles={assignableRoles}
                currentRoleNames={editing.user.roles}
                onChange={(roleIds) => setEditing((v) => v && { ...v, roleIds })}
              />
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Άκυρο</Button>
              <Button disabled={saving} onClick={handleSaveRoles}>
                {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Αποθήκευση'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Resolves the editing user's current role names into ids (once `allRoles`
// is known) and reports every change upward — kept separate so the parent
// doesn't need its own effect just to do this one lookup.
function RolesEditor({
  allRoles,
  currentRoleNames,
  onChange,
}: {
  allRoles: RoleLookupDto[];
  currentRoleNames: string[];
  onChange: (roleIds: number[]) => void;
}) {
  const initialIds = useMemo(
    () => allRoles.filter((r) => currentRoleNames.includes(r.name)).map((r) => r.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRoles.length]
  );
  const [value, setValue] = useState<number[]>(initialIds);

  useEffect(() => { onChange(value); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TagBox
      dataSource={allRoles}
      valueExpr="id"
      displayExpr="name"
      value={value}
      onValueChanged={(e) => setValue(e.value ?? [])}
      showSelectionControls
      applyValueMode="useButtons"
      searchEnabled
    />
  );
}
