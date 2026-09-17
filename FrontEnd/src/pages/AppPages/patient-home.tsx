import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import notify from 'devextreme/ui/notify';
import { CalendarClock, CalendarPlus, History, LoaderCircleIcon, UserRound } from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AppointmentDto,
  STATUS_BADGE_VARIANT,
  getAppointments,
} from '@/services/hospital-api';

const STATUS_LABELS: Record<string, string> = {
  Scheduled: 'Προγραμματισμένο', Confirmed: 'Επιβεβαιωμένο', CheckedIn: 'Άφιξη',
  Completed: 'Ολοκληρωμένο', Cancelled: 'Ακυρωμένο', NoShow: 'Μη προσέλευση', Rescheduled: 'Μετατεθειμένο',
};

export default function PatientHomePage() {
  const { currentUser } = useAuth();
  const [nextAppointment, setNextAppointment] = useState<AppointmentDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The backend already scopes /Appointments to the caller's own record
    // for a Patient — no patientId needs to be passed from here.
    getAppointments({ from: new Date().toISOString() })
      .then(({ data }) => {
        const upcoming = data
          .filter((a) => a.statusCode !== 'Cancelled')
          .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
        setNextAppointment(upcoming[0] ?? null);
      })
      .catch(() => notify('Αποτυχία φόρτωσης ραντεβού.', 'error', 4000))
      .finally(() => setLoading(false));
  }, []);

  const firstName = currentUser?.fullName?.split(' ')[0] ?? '';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Καλωσόρισες{firstName ? `, ${firstName}` : ''}</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE dd/MM/yyyy', { locale: el })}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Επόμενο ραντεβού</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon className="h-4 w-4 animate-spin" /> Φόρτωση...
            </div>
          ) : nextAppointment ? (
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-lg font-medium">
                  {format(new Date(nextAppointment.scheduledStart), 'EEEE dd/MM/yyyy, HH:mm', { locale: el })}
                </div>
                <div className="text-sm text-muted-foreground">{nextAppointment.doctorName}</div>
              </div>
              <Badge variant={STATUS_BADGE_VARIANT[nextAppointment.statusCode] ?? 'secondary'}>
                {STATUS_LABELS[nextAppointment.statusCode] ?? nextAppointment.statusCode}
              </Badge>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Δεν έχεις προγραμματισμένα ραντεβού.</p>
              <Button asChild size="sm">
                <Link to="/patient/book-appointment">Κλείσε ραντεβού</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/patient/book-appointment">
          <Card className="hover:bg-accent transition-colors h-full">
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3"><CalendarPlus className="h-5 w-5 text-primary" /></div>
              <span className="font-medium">Νέο Ραντεβού</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/patient/appointments/upcoming">
          <Card className="hover:bg-accent transition-colors h-full">
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3"><CalendarClock className="h-5 w-5 text-primary" /></div>
              <span className="font-medium">Επερχόμενα</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/patient/appointments/history">
          <Card className="hover:bg-accent transition-colors h-full">
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3"><History className="h-5 w-5 text-primary" /></div>
              <span className="font-medium">Ιστορικό</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/patient/profile">
          <Card className="hover:bg-accent transition-colors h-full">
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3"><UserRound className="h-5 w-5 text-primary" /></div>
              <span className="font-medium">Το Προφίλ μου</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
