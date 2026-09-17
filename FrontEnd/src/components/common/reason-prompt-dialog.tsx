import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ReasonPromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  required?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

// Shared "why" prompt for cancel / no-show — the reason lands in Reason on
// the appointment and in the audit log's AfterSnapshot either way.
export function ReasonPromptDialog({ open, title, description, confirmLabel = 'Επιβεβαίωση', required, onCancel, onConfirm }: ReasonPromptDialogProps) {
  const [reason, setReason] = useState('');

  function handleConfirm() {
    if (required && !reason.trim()) return;
    onConfirm(reason.trim());
    setReason('');
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { setReason(''); onCancel(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-2">
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          <Label className="mb-1.5 block">Αιτία {required ? '' : '(προαιρετικό)'}</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setReason(''); onCancel(); }}>Άκυρο</Button>
          <Button variant="destructive" disabled={required && !reason.trim()} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
