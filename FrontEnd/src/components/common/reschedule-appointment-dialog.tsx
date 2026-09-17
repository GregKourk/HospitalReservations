import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import DateBox from 'devextreme-react/date-box';
import notify from 'devextreme/ui/notify';
import { LoaderCircleIcon } from 'lucide-react';
import { ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AppointmentDto,
  DoctorAvailabilitySlotDto,
  getDoctorAvailability,
  getErrorMessage,
  rescheduleAppointment,
} from '@/services/hospital-api';

function toIsoDate(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

interface RescheduleAppointmentDialogProps {
  appointment: AppointmentDto;
  onClose: () => void;
  onDone: () => void;
}

// Shared by the Reception booking screen and the admin Appointments screen —
// its own availability lookup, independent of whatever date/slot state the
// caller has, since rescheduling can move a visit to an entirely different day.
export function RescheduleAppointmentDialog({ appointment, onClose, onDone }: RescheduleAppointmentDialogProps) {
  const [date, setDate] = useState<Date>(new Date(appointment.scheduledStart));
  const [slots, setSlots] = useState<DoctorAvailabilitySlotDto[]>([]);
  const [selected, setSelected] = useState<DoctorAvailabilitySlotDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(null);
    setLoading(true);
    getDoctorAvailability(appointment.doctorId, toIsoDate(date))
      .then(({ data }) => setSlots(data))
      .catch(() => notify('Αποτυχία φόρτωσης διαθεσιμότητας.', 'error', 4000))
      .finally(() => setLoading(false));
  }, [date, appointment.doctorId]);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await rescheduleAppointment(appointment.appointmentId, selected.start, selected.end);
      notify('Το ραντεβού μετατέθηκε.', 'success', 2500);
      onDone();
    } catch (err) {
      notify(getErrorMessage(err, 'Η μετάθεση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent onInteractOutside={ignoreDevExtremeOverlayInteraction}>
        <DialogHeader>
          <DialogTitle>Αλλαγή ώρας — {appointment.patientName}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Νέα ημερομηνία</Label>
            <DateBox value={date} onValueChanged={(e) => e.value && setDate(e.value as Date)} type="date" displayFormat="dd/MM/yyyy" min={new Date()} />
          </div>
          <div>
            <Label className="mb-1.5 block">Διαθέσιμες ώρες</Label>
            {loading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <LoaderCircleIcon className="h-4 w-4 animate-spin" /> Φόρτωση...
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχει διαθεσιμότητα αυτή την ημέρα.</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {slots.map((s) => (
                  <Button
                    key={s.start}
                    type="button"
                    size="sm"
                    variant={selected?.start === s.start ? 'primary' : 'outline'}
                    onClick={() => setSelected(s)}
                  >
                    {format(new Date(s.start), 'HH:mm')}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Άκυρο</Button>
          <Button disabled={!selected || saving} onClick={handleSave}>
            {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Αποθήκευση'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
