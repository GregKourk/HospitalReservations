import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import notify from 'devextreme/ui/notify';
import { LoaderCircleIcon, Pencil } from 'lucide-react';
import { ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MedicalRecordDto,
  createMedicalRecord,
  getErrorMessage,
  getMedicalRecords,
  updateMedicalRecord,
} from '@/services/hospital-api';

interface MedicalRecordsDialogProps {
  patientId: string;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Doctor-only clinical notes on a patient — separate from Appointment
// history (dates/statuses) and from the patient's own contact record.
// Server scopes this to the caller's own notes; a Doctor never sees another
// doctor's notes on the same patient.
export function MedicalRecordsDialog({ patientId, patientName, open, onOpenChange }: MedicalRecordsDialogProps) {
  const [records, setRecords] = useState<MedicalRecordDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const load = () => {
    setLoading(true);
    getMedicalRecords(patientId)
      .then(({ data }) => setRecords(data))
      .catch(() => notify('Αποτυχία φόρτωσης ιατρικού ιστορικού.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      await createMedicalRecord({ patientId, notes: newNote.trim() });
      setNewNote('');
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η καταχώρηση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editingText.trim()) return;
    setSaving(true);
    try {
      await updateMedicalRecord(id, editingText.trim());
      setEditingId(null);
      load();
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενημέρωση απέτυχε.'), 'error', 4500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" onInteractOutside={ignoreDevExtremeOverlayInteraction}>
        <DialogHeader><DialogTitle>Ιατρικό ιστορικό — {patientName}</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Textarea rows={3} placeholder="Νέα σημείωση..." value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            <Button size="sm" disabled={saving || !newNote.trim()} onClick={handleAdd}>
              {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Προσθήκη σημείωσης'}
            </Button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8"><LoaderCircleIcon className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : records.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Δεν υπάρχουν καταχωρημένες σημειώσεις.</p>
            ) : (
              records.map((r) => (
                <div key={r.recordId} className="rounded-md border p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{r.doctorName} — {format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm')}{r.updatedAt !== r.createdAt ? ' (επεξεργασμένο)' : ''}</span>
                    {editingId !== r.recordId && (
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(r.recordId); setEditingText(r.notes); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {editingId === r.recordId ? (
                    <div className="space-y-2">
                      <Textarea rows={3} value={editingText} onChange={(e) => setEditingText(e.target.value)} autoFocus />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Άκυρο</Button>
                        <Button size="sm" disabled={saving} onClick={() => handleSaveEdit(r.recordId)}>
                          {saving ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Αποθήκευση'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{r.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
