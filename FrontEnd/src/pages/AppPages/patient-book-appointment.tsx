import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import SelectBox from 'devextreme-react/select-box';
import DateBox from 'devextreme-react/date-box';
import notify from 'devextreme/ui/notify';
import { Clock3, LoaderCircleIcon, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ClinicDto,
  DoctorAvailabilitySlotDto,
  LookupItemDto,
  WaitlistEntryDto,
  cancelWaitlistEntry,
  createAppointment,
  getClinics,
  getDoctorAvailability,
  getErrorMessage,
  getLookupDepartments,
  getLookupDoctors,
  getOwnPatient,
  getWaitlist,
  joinWaitlist,
} from '@/services/hospital-api';

const WAITLIST_STATUS_LABELS: Record<string, string> = {
  Waiting: 'Σε αναμονή', Notified: 'Ελευθερώθηκε θέση', Booked: 'Κλείστηκε', Cancelled: 'Ακυρώθηκε',
};

function toIsoDate(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

export default function PatientBookAppointmentPage() {
  const navigate = useNavigate();

  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientLoading, setPatientLoading] = useState(true);

  const [clinics, setClinics] = useState<ClinicDto[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);

  const [departments, setDepartments] = useState<LookupItemDto[]>([]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<LookupItemDto[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);

  const [date, setDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<DoctorAvailabilitySlotDto[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<DoctorAvailabilitySlotDto | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [reason, setReason] = useState('');
  const [booking, setBooking] = useState(false);

  const [waitlist, setWaitlist] = useState<WaitlistEntryDto[]>([]);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

  const loadWaitlist = () => {
    getWaitlist().then(({ data }) => setWaitlist(data)).catch(() => {});
  };

  useEffect(() => {
    getOwnPatient()
      .then(({ data }) => setPatientId(data.patientId))
      .catch(() => notify('Δεν βρέθηκε το προφίλ ασθενή σου — επικοινώνησε με τη γραμματεία.', 'error', 6000))
      .finally(() => setPatientLoading(false));
    getClinics().then(({ data }) => setClinics(data)).catch(() => notify('Αποτυχία φόρτωσης κλινικών.', 'error', 4000));
    loadWaitlist();
  }, []);

  useEffect(() => {
    setDepartmentId(null);
    if (!clinicId) { setDepartments([]); return; }
    getLookupDepartments(clinicId).then(({ data }) => setDepartments(data)).catch(() => {});
  }, [clinicId]);

  useEffect(() => {
    setDoctorId(null);
    if (!clinicId) { setDoctors([]); return; }
    getLookupDoctors(clinicId, departmentId ?? undefined).then(({ data }) => setDoctors(data)).catch(() => {});
  }, [clinicId, departmentId]);

  useEffect(() => {
    setSelectedSlot(null);
    if (!doctorId) { setSlots([]); return; }
    setSlotsLoading(true);
    getDoctorAvailability(doctorId, toIsoDate(date))
      .then(({ data }) => setSlots(data))
      .catch(() => notify('Αποτυχία φόρτωσης διαθεσιμότητας.', 'error', 4000))
      .finally(() => setSlotsLoading(false));
  }, [doctorId, date]);

  async function handleBook() {
    if (!patientId) {
      notify('Δεν βρέθηκε το προφίλ ασθενή σου — επικοινώνησε με τη γραμματεία.', 'error', 5000);
      return;
    }
    if (!clinicId || !departmentId || !doctorId || !selectedSlot) {
      notify('Επίλεξε κλινική, τμήμα, γιατρό και ώρα.', 'warning', 3500);
      return;
    }
    setBooking(true);
    try {
      await createAppointment({
        clinicId,
        departmentId,
        doctorId,
        patientId,
        scheduledStart: selectedSlot.start,
        scheduledEnd: selectedSlot.end,
        reason: reason || undefined,
      });
      notify('Το ραντεβού καταχωρήθηκε.', 'success', 3000);
      navigate('/patient/appointments/upcoming');
    } catch (err) {
      notify(getErrorMessage(err, 'Η καταχώρηση απέτυχε.'), 'error', 4500);
    } finally {
      setBooking(false);
    }
  }

  async function handleJoinWaitlist() {
    if (!patientId || !clinicId || !departmentId || !doctorId) {
      notify('Επίλεξε κλινική, τμήμα και γιατρό.', 'warning', 3500);
      return;
    }
    setJoiningWaitlist(true);
    try {
      await joinWaitlist({
        clinicId,
        departmentId,
        doctorId,
        patientId,
        preferredDate: toIsoDate(date),
        reason: reason || undefined,
      });
      notify('Εγγράφηκες στη λίστα αναμονής — θα ειδοποιηθείς αν ελευθερωθεί θέση.', 'success', 3500);
      loadWaitlist();
    } catch (err) {
      notify(getErrorMessage(err, 'Η εγγραφή απέτυχε.'), 'error', 4500);
    } finally {
      setJoiningWaitlist(false);
    }
  }

  async function handleWithdrawWaitlist(entry: WaitlistEntryDto) {
    try {
      await cancelWaitlistEntry(entry.waitlistId);
      notify('Αποσύρθηκες από τη λίστα αναμονής.', 'success', 2500);
      loadWaitlist();
    } catch (err) {
      notify(getErrorMessage(err, 'Η απόσυρση απέτυχε.'), 'error', 4500);
    }
  }

  const alreadyWaitingForSelection = doctorId
    ? waitlist.some((w) => w.status === 'Waiting' && w.doctorId === doctorId && w.preferredDate.slice(0, 10) === toIsoDate(date))
    : false;

  if (patientLoading) {
    return (
      <div className="p-6 flex justify-center py-16">
        <LoaderCircleIcon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Νέο Ραντεβού</h1>
        <p className="text-sm text-muted-foreground">Επίλεξε κλινική, γιατρό και ώρα για να κλείσεις ραντεβού.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Κλινική / Γιατρός</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block">Κλινική</Label>
            <SelectBox dataSource={clinics} valueExpr="clinicId" displayExpr="name" value={clinicId} onValueChanged={(e) => setClinicId(e.value)} placeholder="Επίλεξε κλινική" searchEnabled />
          </div>
          <div>
            <Label className="mb-1.5 block">Τμήμα</Label>
            <SelectBox dataSource={departments} valueExpr="id" displayExpr="text" value={departmentId} onValueChanged={(e) => setDepartmentId(e.value)} placeholder="Επίλεξε τμήμα" disabled={!clinicId} searchEnabled />
          </div>
          <div>
            <Label className="mb-1.5 block">Γιατρός</Label>
            <SelectBox dataSource={doctors} valueExpr="id" displayExpr="text" value={doctorId} onValueChanged={(e) => setDoctorId(e.value)} placeholder="Επίλεξε γιατρό" disabled={!clinicId} searchEnabled />
          </div>
          <div>
            <Label className="mb-1.5 block">Ημερομηνία</Label>
            <DateBox value={date} onValueChanged={(e) => e.value && setDate(e.value as Date)} type="date" displayFormat="dd/MM/yyyy" min={new Date()} />
          </div>
        </CardContent>
      </Card>

      {doctorId && (
        <Card>
          <CardHeader><CardTitle className="text-base">Διαθέσιμες ώρες — {format(date, 'dd/MM/yyyy')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {slotsLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <LoaderCircleIcon className="h-4 w-4 animate-spin" /> Φόρτωση...
              </div>
            ) : slots.length === 0 ? (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">Δεν υπάρχει διαθεσιμότητα αυτή την ημέρα.</p>
                {alreadyWaitingForSelection ? (
                  <Badge variant="info" size="sm"><Clock3 className="h-3 w-3 mr-1" /> Ήδη σε λίστα αναμονής</Badge>
                ) : (
                  <Button size="sm" variant="outline" disabled={joiningWaitlist} onClick={handleJoinWaitlist}>
                    {joiningWaitlist ? <LoaderCircleIcon className="h-3.5 w-3.5 animate-spin" /> : 'Εγγραφή σε λίστα αναμονής'}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {slots.map((s) => (
                  <Button
                    key={s.start}
                    type="button"
                    size="sm"
                    variant={selectedSlot?.start === s.start ? 'primary' : 'outline'}
                    onClick={() => setSelectedSlot(s)}
                  >
                    {format(new Date(s.start), 'HH:mm')}
                  </Button>
                ))}
              </div>
            )}

            <div>
              <Label className="mb-1.5 block">Αιτία επίσκεψης (προαιρετικό)</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            <Button className="w-full" disabled={booking || !selectedSlot} onClick={handleBook}>
              {booking ? (
                <span className="flex items-center gap-2"><LoaderCircleIcon className="h-4 w-4 animate-spin" /> Καταχώρηση...</span>
              ) : (
                'Κράτηση ραντεβού'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {waitlist.filter((w) => w.status === 'Waiting' || w.status === 'Notified').length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Οι λίστες αναμονής σου</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {waitlist
              .filter((w) => w.status === 'Waiting' || w.status === 'Notified')
              .map((w) => (
                <div key={w.waitlistId} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{w.doctorName}</span> — {format(new Date(w.preferredDate), 'dd/MM/yyyy')}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={w.status === 'Notified' ? 'success' : 'info'} size="sm">
                      {w.status === 'Notified' && <Clock3 className="h-3 w-3 mr-1" />}
                      {WAITLIST_STATUS_LABELS[w.status] ?? w.status}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => handleWithdrawWaitlist(w)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
