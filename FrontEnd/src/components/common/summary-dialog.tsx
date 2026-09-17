import { ReactNode, useRef } from 'react';
import DataGrid, { DataGridRef, FilterRow, HeaderFilter, Pager, Paging, SearchPanel } from 'devextreme-react/data-grid';
import { FileSpreadsheet, FileText, LoaderCircleIcon } from 'lucide-react';
import { ignoreDevExtremeOverlayInteraction } from '@/components/common/entity-grid';
import { exportGridExcelFile, exportGridPdfFile } from '@/lib/grid-export';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Human title shown in the dialog and used to name the Excel worksheet. */
  title: string;
  /** Stable slug for the audit log, e.g. "DepartmentsSummary" — not shown to the user. */
  entityType: string;
  /** Greek name used for the downloaded file, e.g. "Τμήματα". */
  fileBaseName: string;
  keyExpr: string;
  dataSource: unknown[];
  loading?: boolean;
  /** <Column> elements describing the consolidated grid. */
  children: ReactNode;
}

// Shared "Συγκεντρωτική προβολή" popup for every Administration screen: an
// unfiltered grid of everything in that entity, with PDF/Excel export.
// Every export is audit-logged server-side (who/when come from the JWT) —
// the file itself is generated entirely client-side, nothing to upload.
export function SummaryDialog({ open, onOpenChange, title, entityType, fileBaseName, keyExpr, dataSource, loading, children }: SummaryDialogProps) {
  const gridRef = useRef<DataGridRef>(null);

  async function handleExportExcel() {
    const grid = gridRef.current?.instance();
    if (!grid) return;
    await exportGridExcelFile(grid, title, fileBaseName, entityType);
  }

  async function handleExportPdf() {
    const grid = gridRef.current?.instance();
    if (!grid) return;
    await exportGridPdfFile(grid, fileBaseName, entityType);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-hidden" onInteractOutside={ignoreDevExtremeOverlayInteraction}>
        <DialogHeader className="flex-row items-center justify-between gap-4 sm:text-start shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <div className="flex gap-2 mr-6">
            <Button size="sm" variant="outline" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportPdf}>
              <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <LoaderCircleIcon className="h-4 w-4 animate-spin" /> Φόρτωση...
            </div>
          ) : (
            <DataGrid
              ref={gridRef}
              dataSource={dataSource}
              keyExpr={keyExpr}
              showBorders
              columnAutoWidth
              wordWrapEnabled
              allowColumnResizing
              noDataText="Δεν υπάρχουν δεδομένα."
            >
              <SearchPanel visible width={240} placeholder="Αναζήτηση..." />
              <FilterRow visible />
              <HeaderFilter visible />
              <Paging defaultPageSize={20} />
              <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
              {children}
            </DataGrid>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
