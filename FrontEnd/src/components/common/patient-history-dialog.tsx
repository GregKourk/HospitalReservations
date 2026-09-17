import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { LoaderCircleIcon } from 'lucide-react';
import { ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AppointmentDto,
  STATUS_BADGE_VARIANT,
  StatusLookupDto,
  getAppointmentStatuses,
  getAppointments,
} from '@/services/hospital-api';

interface PatientHistoryDialogProps {
  patientId: string;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Shared by Patients admin and Reception's booking panel — both need "show
// me everything this patient has ever had booked" on demand, not as a
// standing part of either screen's own layout.
export function PatientHistoryDialog({ patientId, patientName, open, onOpenChange }: PatientHistoryDialogProps) {
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [statuses, setStatuses] = useState<StatusLookupDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([getAppointments({ patientId }), getAppointmentStatuses()])
      .then(([a, s]) => { setAppointments(a.data); setStatuses(s.data); })
      .catch(() => notify('Αποτυχία φόρτωσης ιστορικού.', 'error', 4000))
      .finally(() => setLoading(false));
  }, [open, patientId]);

  const statusLabel = (code: string) => statuses.find((s) => s.code === code)?.description || code;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" onInteractOutside={ignoreDevExtremeOverlayInteraction}>
        <DialogHeader><DialogTitle>Ιστορικό ραντεβού — {patientName}</DialogTitle></DialogHeader>
        <DialogBody>
          {loading ? (
            <div className="flex justify-center py-10"><LoaderCircleIcon className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <DataGrid
              dataSource={appointments}
              keyExpr="appointmentId"
              showBorders
              columnAutoWidth
              wordWrapEnabled
              noDataText="Δεν υπάρχουν ραντεβού για αυτόν τον ασθενή."
            >
              <FilterRow visible />
              <HeaderFilter visible />
              <Paging defaultPageSize={10} />
              <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
              <Column
                dataField="scheduledStart"
                caption="Ημ/νία & Ώρα"
                width={150}
                sortOrder="desc"
                calculateCellValue={(row: AppointmentDto) => format(new Date(row.scheduledStart), 'dd/MM/yyyy HH:mm')}
              />
              <Column dataField="doctorName" caption="Γιατρός" />
              <Column
                dataField="statusCode"
                caption="Κατάσταση"
                width={140}
                cellRender={({ data }: { data: AppointmentDto }) => (
                  <Badge variant={STATUS_BADGE_VARIANT[data.statusCode] ?? 'secondary'} size="sm">{statusLabel(data.statusCode)}</Badge>
                )}
              />
              <Column dataField="reason" caption="Αιτία" calculateCellValue={(row: AppointmentDto) => row.reason ?? '—'} />
            </DataGrid>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
