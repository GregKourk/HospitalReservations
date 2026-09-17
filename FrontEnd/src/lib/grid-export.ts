import notify from 'devextreme/ui/notify';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { exportDataGrid as exportGridToExcel } from 'devextreme/excel_exporter';
import { jsPDF } from 'jspdf';
import { exportDataGrid as exportGridToPdf } from 'devextreme/pdf_exporter';
import type dxDataGrid from 'devextreme/ui/data_grid';
import { NotoSansRegular } from '@/fonts/NotoSans-Regular';
import { logExport } from '@/services/hospital-api';

export function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}

// jsPDF's built-in fonts (Helvetica/Times/Courier) only cover Latin-1 — any
// Greek text silently comes out as boxes/blanks. Noto Sans has full Greek
// coverage; register + select it before every PDF export.
export function createPdfDocument() {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.addFileToVFS('NotoSans-Regular.ttf', NotoSansRegular);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.setFont('NotoSans');
  return doc;
}

// Shared by SummaryDialog and any admin screen that exports a DataGrid
// directly (e.g. Reports) — every export is audit-logged server-side
// (who/when come from the JWT), the file itself is generated entirely
// client-side.
export async function exportGridExcelFile(grid: dxDataGrid, title: string, fileBaseName: string, entityType: string) {
  try {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet(title.slice(0, 31)); // Excel sheet-name limit
    await exportGridToExcel({ component: grid, worksheet, autoFilterEnabled: true });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${fileBaseName}-${fileStamp()}.xlsx`);
    await logExport(entityType, 'excel').catch(() => {});
    notify('Η εξαγωγή σε Excel ολοκληρώθηκε.', 'success', 2500);
  } catch {
    notify('Η εξαγωγή σε Excel απέτυχε.', 'error', 4000);
  }
}

export async function exportGridPdfFile(grid: dxDataGrid, fileBaseName: string, entityType: string) {
  try {
    const doc = createPdfDocument();
    await exportGridToPdf({ jsPDFDocument: doc, component: grid });
    doc.save(`${fileBaseName}-${fileStamp()}.pdf`);
    await logExport(entityType, 'pdf').catch(() => {});
    notify('Η εξαγωγή σε PDF ολοκληρώθηκε.', 'success', 2500);
  } catch {
    notify('Η εξαγωγή σε PDF απέτυχε.', 'error', 4000);
  }
}
