import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import DataGrid, { Column, DataGridRef, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import DateBox from 'devextreme-react/date-box';
import notify from 'devextreme/ui/notify';
import { FileSpreadsheet, FileText, LoaderCircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exportGridExcelFile, exportGridPdfFile } from '@/lib/grid-export';
import {
  CancellationNoShowDto,
  ClinicStatDto,
  DoctorStatDto,
  getCancellationsNoShows,
  getClinicStats,
  getDoctorStats,
} from '@/services/hospital-api';

const STATUS_LABELS: Record<string, string> = { Cancelled: 'Ακυρώθηκε', NoShow: 'Μη προσέλευση' };

function ExportButtons({ gridRef, title, fileBaseName, entityType }: { gridRef: React.RefObject<DataGridRef | null>; title: string; fileBaseName: string; entityType: string }) {
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => { const g = gridRef.current?.instance(); if (g) exportGridExcelFile(g, title, fileBaseName, entityType); }}
      >
        <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Excel
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => { const g = gridRef.current?.instance(); if (g) exportGridPdfFile(g, fileBaseName, entityType); }}
      >
        <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
      </Button>
    </div>
  );
}

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; });
  const [toDate, setToDate] = useState<Date>(new Date());

  const [clinicStats, setClinicStats] = useState<ClinicStatDto[]>([]);
  const [doctorStats, setDoctorStats] = useState<DoctorStatDto[]>([]);
  const [cancellationsNoShows, setCancellationsNoShows] = useState<CancellationNoShowDto[]>([]);
  const [loading, setLoading] = useState(false);

  const clinicGridRef = useRef<DataGridRef>(null);
  const doctorGridRef = useRef<DataGridRef>(null);
  const cancelGridRef = useRef<DataGridRef>(null);

  const load = () => {
    setLoading(true);
    const from = fromDate.toISOString();
    const to = toDate.toISOString();
    Promise.all([getClinicStats(from, to), getDoctorStats(from, to), getCancellationsNoShows(from, to)])
      .then(([clinics, doctors, cancellations]) => {
        setClinicStats(clinics.data);
        setDoctorStats(doctors.data);
        setCancellationsNoShows(cancellations.data);
      })
      .catch(() => notify('Αποτυχία φόρτωσης αναφορών.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Αναφορές</h1>
        <p className="text-sm text-muted-foreground">Στατιστικά ανά κλινική/γιατρό και ακυρώσεις/μη προσέλευση για το επιλεγμένο διάστημα.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Διάστημα</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="mb-1.5 block">Από</Label>
            <DateBox value={fromDate} onValueChanged={(e) => e.value && setFromDate(e.value as Date)} type="date" displayFormat="dd/MM/yyyy" />
          </div>
          <div>
            <Label className="mb-1.5 block">Έως</Label>
            <DateBox value={toDate} onValueChanged={(e) => e.value && setToDate(e.value as Date)} type="date" displayFormat="dd/MM/yyyy" />
          </div>
          <Button size="sm" disabled={loading} onClick={load}>
            {loading ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : 'Εφαρμογή φίλτρων'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Στατιστικά ανά Κλινική</CardTitle>
          <ExportButtons gridRef={clinicGridRef} title="Στατιστικά ανά Κλινική" fileBaseName="Στατιστικά Κλινικών" entityType="ClinicStatsReport" />
        </CardHeader>
        <CardContent>
          <DataGrid ref={clinicGridRef} dataSource={clinicStats} keyExpr="clinicId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχουν δεδομένα για αυτό το διάστημα.">
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={10} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
            <Column dataField="clinicName" caption="Κλινική" />
            <Column dataField="total" caption="Σύνολο" width={100} />
            <Column dataField="completed" caption="Ολοκληρωμένα" width={130} />
            <Column dataField="cancelled" caption="Ακυρωμένα" width={120} />
            <Column dataField="noShow" caption="Μη προσέλευση" width={130} />
            <Column dataField="completionRate" caption="Ποσοστό ολοκλήρωσης" width={160} calculateCellValue={(row: ClinicStatDto) => `${row.completionRate}%`} />
          </DataGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Στατιστικά ανά Γιατρό</CardTitle>
          <ExportButtons gridRef={doctorGridRef} title="Στατιστικά ανά Γιατρό" fileBaseName="Στατιστικά Γιατρών" entityType="DoctorStatsReport" />
        </CardHeader>
        <CardContent>
          <DataGrid ref={doctorGridRef} dataSource={doctorStats} keyExpr="doctorId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχουν δεδομένα για αυτό το διάστημα.">
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={10} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
            <Column dataField="doctorName" caption="Γιατρός" />
            <Column dataField="clinicName" caption="Κλινική" />
            <Column dataField="total" caption="Σύνολο" width={100} />
            <Column dataField="completed" caption="Ολοκληρωμένα" width={130} />
            <Column dataField="cancelled" caption="Ακυρωμένα" width={120} />
            <Column dataField="noShow" caption="Μη προσέλευση" width={130} />
            <Column dataField="completionRate" caption="Ποσοστό ολοκλήρωσης" width={160} calculateCellValue={(row: DoctorStatDto) => `${row.completionRate}%`} />
          </DataGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Ακυρώσεις / Μη προσέλευση</CardTitle>
          <ExportButtons gridRef={cancelGridRef} title="Ακυρώσεις - Μη προσέλευση" fileBaseName="Ακυρώσεις-Μη προσέλευση" entityType="CancellationsNoShowsReport" />
        </CardHeader>
        <CardContent>
          <DataGrid ref={cancelGridRef} dataSource={cancellationsNoShows} keyExpr="appointmentId" showBorders columnAutoWidth loadPanel={{ enabled: loading }} noDataText="Δεν υπάρχουν ακυρώσεις ή περιστατικά μη προσέλευσης.">
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={10} />
            <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
            <Column dataField="scheduledStart" caption="Ημ/νία & Ώρα" width={150} calculateCellValue={(row: CancellationNoShowDto) => format(new Date(row.scheduledStart), 'dd/MM/yyyy HH:mm')} />
            <Column dataField="clinicName" caption="Κλινική" />
            <Column dataField="doctorName" caption="Γιατρός" />
            <Column dataField="patientName" caption="Ασθενής" />
            <Column
              dataField="statusCode"
              caption="Κατάσταση"
              width={140}
              cellRender={({ data }: { data: CancellationNoShowDto }) => (
                <Badge variant={data.statusCode === 'Cancelled' ? 'destructive' : 'warning'} size="sm">
                  {STATUS_LABELS[data.statusCode] ?? data.statusCode}
                </Badge>
              )}
            />
            <Column dataField="reason" caption="Αιτία" calculateCellValue={(row: CancellationNoShowDto) => row.reason ?? '—'} />
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  );
}
