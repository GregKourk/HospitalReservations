import { useTheme } from 'next-themes';
import { Link } from 'react-router-dom';
import { CalendarPlus, Moon, Calendar, LayoutDashboard, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { UserInitials } from '@/partials/topbar/user-dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

const ROLE_QUICK_LINKS: { role: string; label: string; to: string; icon: React.ElementType }[] = [
  { role: 'Admin', label: 'Πίνακας Ελέγχου', to: '/admin/dashboard', icon: LayoutDashboard },
  { role: 'SuperUser', label: 'Πίνακας Ελέγχου', to: '/admin/dashboard', icon: LayoutDashboard },
  { role: 'Doctor', label: 'Πρόγραμμα μου', to: '/admin/schedules', icon: Calendar },
  { role: 'Reception', label: 'Ρεσεψιόν', to: '/reception', icon: Users },
  { role: 'ClinicManager', label: 'Γιατροί', to: '/admin/doctors', icon: Stethoscope },
  { role: 'Patient', label: 'Νέο Ραντεβού', to: '/patient/book-appointment', icon: CalendarPlus },
];

export default function MyAccountPage() {
  const { currentUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const fullName = currentUser?.fullName ?? 'Χρήστης';
  const email = currentUser?.email ?? '—';
  const amka = currentUser?.amka ?? null;
  const roles = currentUser?.roles ?? [];

  const quickLinks = ROLE_QUICK_LINKS.filter((l) => roles.includes(l.role))
    .filter((l, i, arr) => arr.findIndex((x) => x.to === l.to) === i); // dedupe (Admin+SuperUser share one)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ο Λογαριασμός μου</h1>
        <p className="text-sm text-muted-foreground">Στοιχεία λογαριασμού και γρήγορη πρόσβαση.</p>
      </div>

      <Card>
        <CardContent className="pt-6 flex items-center gap-4">
          <UserInitials name={fullName} className="size-14 text-lg shrink-0" />
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate">{fullName}</div>
            <div className="text-sm text-muted-foreground truncate">{email}</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {roles.map((r) => (
                <Badge key={r} variant={r === 'SuperUser' ? 'destructive' : 'secondary'} size="sm">{r}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Στοιχεία</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Email</span>
            <span>{email}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">ΑΜΚΑ</span>
            <span>{amka ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ρόλοι</span>
            <span>{roles.join(', ') || '—'}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Προτιμήσεις</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm flex-1">Σκοτεινό θέμα</span>
            <Switch size="sm" checked={theme === 'dark'} onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')} />
          </div>
        </CardContent>
      </Card>

      {quickLinks.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Γρήγορη πρόσβαση</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {quickLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <l.icon className="h-3.5 w-3.5" /> {l.label}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {roles.includes('SuperUser') && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-destructive shrink-0" />
            Ως SuperUser έχεις πρόσβαση σε ενέργειες υψηλού κινδύνου (ανάθεση ρόλου SuperUser, παράκαμψη πολιτικών ακύρωσης/αλλαγής ώρας) — κάθε τέτοια ενέργεια καταγράφεται στο Audit Log.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
