import { Injectable, inject } from '@angular/core';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanyConfigService } from './company-config.service';
import { ICajaChicaReport } from '../interfaces/caja-chica-report.interface';

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export interface CajaChicaExportRow {
  colaborador: string;
  tipo: string;
  fecha: string;
  proveedor: string;
  descripcion: string;
  monto: number;
}

@Injectable({ providedIn: 'root' })
export class CajaChicaReportExportService {
  private companyConfigService = inject(CompanyConfigService);

  private get companyName(): string {
    return (this.companyConfigService as any).companyConfig?.name || 'Empresa';
  }

  exportPdf(report: ICajaChicaReport, rows: CajaChicaExportRow[]): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable;
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Header
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(this.companyName, margin, 10);
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rendicion Caja Chica - ${report.codigo}`, margin, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(report.title, margin, 27);
    doc.text(`Estado: ${report.status === 'finalized' ? 'Finalizado' : 'Borrador'}`, margin, 33);
    const totalStr = `Total: S/ ${report.totalAmount.toFixed(2)}`;
    doc.text(totalStr, pageW - margin - doc.getTextWidth(totalStr), 33);

    // Table
    autoTable(doc, {
      startY: 38,
      head: [['Colaborador', 'Tipo', 'Fecha', 'Proveedor / Descripcion', 'Monto (S/)']],
      body: rows.map((r) => [
        r.colaborador,
        r.tipo,
        r.fecha,
        r.proveedor || r.descripcion,
        r.monto.toFixed(2),
      ]),
      foot: [['', '', '', 'TOTAL', report.totalAmount.toFixed(2)]],
      headStyles: { fillColor: [211, 18, 18], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      footStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 4: { halign: 'right' } },
      margin: { left: margin, right: margin },
      styles: { overflow: 'linebreak' },
    });

    doc.save(`CC-${report.codigo}-${report.title.replace(/\s+/g, '_')}.pdf`);
  }

  async exportExcel(report: ICajaChicaReport, rows: CajaChicaExportRow[]): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = this.companyName;

    // Sheet: Resumen
    const ws = wb.addWorksheet('Resumen');
    ws.columns = [
      { header: 'Campo', key: 'campo', width: 28 },
      { header: 'Valor', key: 'valor', width: 40 },
    ];
    ws.addRow({ campo: 'Codigo', valor: report.codigo });
    ws.addRow({ campo: 'Titulo', valor: report.title });
    ws.addRow({ campo: 'Estado', valor: report.status === 'finalized' ? 'Finalizado' : 'Borrador' });
    ws.addRow({ campo: 'Rendiciones incluidas', valor: report.selectedReports?.length ?? 0 });
    ws.addRow({ campo: 'Total (S/)', valor: report.totalAmount });

    ws.getRow(1).font = { bold: true };
    ws.getColumn('campo').font = { bold: true };

    // Sheet: Detalle
    const wd = wb.addWorksheet('Detalle');
    wd.columns = [
      { header: 'Colaborador', key: 'colaborador', width: 28 },
      { header: 'Tipo', key: 'tipo', width: 20 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Proveedor / Descripcion', key: 'proveedor', width: 36 },
      { header: 'Monto (S/)', key: 'monto', width: 14 },
    ];

    const headerRow = wd.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD31212' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    rows.forEach((r) => {
      wd.addRow({
        colaborador: r.colaborador,
        tipo: r.tipo,
        fecha: r.fecha,
        proveedor: r.proveedor || r.descripcion,
        monto: r.monto,
      });
    });

    // Total row
    const totalRow = wd.addRow({ colaborador: '', tipo: '', fecha: '', proveedor: 'TOTAL', monto: report.totalAmount });
    totalRow.font = { bold: true };
    totalRow.getCell('proveedor').alignment = { horizontal: 'right' };

    wd.getColumn('monto').numFmt = '"S/"#,##0.00';

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CC-${report.codigo}-${report.title.replace(/\s+/g, '_')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
