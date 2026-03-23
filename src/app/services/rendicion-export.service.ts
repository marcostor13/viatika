import { Injectable } from '@angular/core';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

function afterTable(doc: jsPDF): number {
  const d = doc as JsPdfWithAutoTable;
  return d.lastAutoTable?.finalY ?? 14;
}

export interface RendicionExportComprobanteRow {
  tipo: string;
  fecha: string;
  descripcion: string;
  monto: number;
  estadoComprobante: string;
}

export interface RendicionExportAnticipoRow {
  descripcion: string;
  monto: number;
  estado: string;
  fechaSolicitud: string;
}

export interface RendicionExportSettlement {
  advanceTotal: number;
  expenseTotal: number;
  difference: number;
  typeLabel: string;
}

/** Datos normalizados para exportar el detalle de una rendición. */
export interface RendicionExportData {
  fileBaseName: string;
  titulo: string;
  estado: string;
  descripcionRendicion?: string;
  colaborador: string;
  presupuesto: number;
  totalGastado: number;
  totalAnticipado: number;
  saldoLibre: number;
  fechaGeneracion: string;
  rejectionReason?: string;
  comprobantes: RendicionExportComprobanteRow[];
  anticipos: RendicionExportAnticipoRow[];
  settlement?: RendicionExportSettlement;
}

const HEADER_FILL = 'FF1e3a5a';
const SECTION_FILL = 'FF2563eb';
const ALT_ROW_FILL = 'FFf1f5f9';
const ACCENT_GREEN = 'FF059669';
const ACCENT_RED = 'FFdc2626';

@Injectable({ providedIn: 'root' })
export class RendicionExportService {
  async exportToExcel(data: RendicionExportData): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Viatika';
    wb.created = new Date();
    const ws = wb.addWorksheet('Rendición', {
      views: [{ showGridLines: true }],
    });

    ws.columns = [
      { width: 22 },
      { width: 28 },
      { width: 40 },
      { width: 14 },
      { width: 18 },
      { width: 14 },
    ];

    let r = 1;
    const mergeTitle = (text: string, fill: string, fontColor = 'FFFFFFFF') => {
      ws.mergeCells(r, 1, r, 6);
      const cell = ws.getCell(r, 1);
      cell.value = text;
      cell.font = { bold: true, size: 14, color: { argb: fontColor } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fill },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(r).height = 28;
      r += 1;
    };

    mergeTitle(`Detalle de rendición — ${data.titulo}`, HEADER_FILL);

    const section = (label: string) => {
      ws.mergeCells(r, 1, r, 6);
      const c = ws.getCell(r, 1);
      c.value = label;
      c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: SECTION_FILL },
      };
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(r).height = 22;
      r += 1;
    };

    const kv = (k: string, v: string | number) => {
      ws.getCell(r, 1).value = k;
      ws.getCell(r, 1).font = { bold: true, color: { argb: 'FF475569' } };
      ws.mergeCells(r, 2, r, 6);
      ws.getCell(r, 2).value = v;
      ws.getCell(r, 2).alignment = { wrapText: true };
      r += 1;
    };

    section('Resumen general');
    kv('Estado', data.estado);
    kv('Colaborador', data.colaborador);
    if (data.descripcionRendicion) {
      kv('Descripción', data.descripcionRendicion);
    }
    kv('Presupuesto (S/)', data.presupuesto);
    kv('Total gastado (S/)', data.totalGastado);
    kv('Total anticipos aprob./pagados (S/)', data.totalAnticipado);
    const saldoCell = r;
    kv('Saldo disponible (S/)', data.saldoLibre);
    ws.getCell(saldoCell, 2).font = {
      bold: true,
      color: { argb: data.saldoLibre < 0 ? ACCENT_RED : ACCENT_GREEN },
    };
    kv('Generado el', data.fechaGeneracion);
    if (data.rejectionReason) {
      kv('Motivo de rechazo', data.rejectionReason);
    }

    if (data.anticipos.length > 0) {
      section('Anticipos');
      ['Descripción', 'Monto (S/)', 'Estado', 'Fecha solicitud'].forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: HEADER_FILL },
        };
        c.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
      r += 1;
      data.anticipos.forEach((a, idx) => {
        ws.getCell(r, 1).value = a.descripcion;
        ws.getCell(r, 2).value = a.monto;
        ws.getCell(r, 2).numFmt = '#,##0.00';
        ws.getCell(r, 3).value = a.estado;
        ws.getCell(r, 4).value = a.fechaSolicitud;
        if (idx % 2 === 1) {
          for (let col = 1; col <= 4; col++) {
            ws.getCell(r, col).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: ALT_ROW_FILL },
            };
          }
        }
        for (let col = 1; col <= 4; col++) {
          ws.getCell(r, col).border = {
            top: { style: 'thin', color: { argb: 'FFe2e8f0' } },
            left: { style: 'thin', color: { argb: 'FFe2e8f0' } },
            bottom: { style: 'thin', color: { argb: 'FFe2e8f0' } },
            right: { style: 'thin', color: { argb: 'FFe2e8f0' } },
          };
        }
        r += 1;
      });
      r += 1;
    }

    section('Comprobantes asociados');
    const compHeaders = [
      'Tipo',
      'Fecha',
      'Descripción',
      'Monto (S/)',
      'Estado comprobante',
    ];
    compHeaders.forEach((h, i) => {
      const c = ws.getCell(r, i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_FILL },
      };
      c.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    r += 1;

    data.comprobantes.forEach((row, idx) => {
      ws.getCell(r, 1).value = row.tipo;
      ws.getCell(r, 2).value = row.fecha;
      ws.getCell(r, 3).value = row.descripcion;
      ws.getCell(r, 3).alignment = { wrapText: true };
      ws.getCell(r, 4).value = row.monto;
      ws.getCell(r, 4).numFmt = '#,##0.00';
      ws.getCell(r, 5).value = row.estadoComprobante;
      if (idx % 2 === 1) {
        for (let col = 1; col <= 5; col++) {
          ws.getCell(r, col).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: ALT_ROW_FILL },
          };
        }
      }
      for (let col = 1; col <= 5; col++) {
        ws.getCell(r, col).border = {
          top: { style: 'thin', color: { argb: 'FFe2e8f0' } },
          left: { style: 'thin', color: { argb: 'FFe2e8f0' } },
          bottom: { style: 'thin', color: { argb: 'FFe2e8f0' } },
          right: { style: 'thin', color: { argb: 'FFe2e8f0' } },
        };
      }
      r += 1;
    });

    if (data.settlement) {
      r += 1;
      section('Liquidación');
      kv('Anticipo entregado (S/)', data.settlement.advanceTotal);
      kv('Gastos reales (S/)', data.settlement.expenseTotal);
      kv(data.settlement.typeLabel, data.settlement.difference);
    }

    const buf = await wb.xlsx.writeBuffer();
    this.triggerDownload(
      new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `${data.fileBaseName}.xlsx`,
    );
  }

  exportToPdf(data: RendicionExportData): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 14;

    doc.setFillColor(30, 58, 90);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('Detalle de rendición', 14, 14);
    doc.setFontSize(10);
    doc.text(data.titulo, 14, 19);
    doc.setTextColor(0, 0, 0);
    y = 30;

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Generado: ${data.fechaGeneracion}`, 14, y);
    y += 8;

    const addSection = (title: string) => {
      if (y > 250) {
        doc.addPage();
        y = 14;
      }
      doc.setFillColor(37, 99, 235);
      doc.setTextColor(255, 255, 255);
      doc.rect(14, y - 4, pageW - 28, 7, 'F');
      doc.setFontSize(10);
      doc.text(title, 16, y);
      doc.setTextColor(0, 0, 0);
      y += 10;
    };

    const summaryBody: (string | number)[][] = [
      ['Estado', data.estado],
      ['Colaborador', data.colaborador],
      ['Presupuesto (S/)', data.presupuesto.toFixed(2)],
      ['Total gastado (S/)', data.totalGastado.toFixed(2)],
      ['Anticipos (S/)', data.totalAnticipado.toFixed(2)],
      ['Saldo disponible (S/)', data.saldoLibre.toFixed(2)],
    ];
    if (data.descripcionRendicion) {
      summaryBody.splice(2, 0, ['Descripción', data.descripcionRendicion]);
    }
    if (data.rejectionReason) {
      summaryBody.push(['Motivo rechazo', data.rejectionReason]);
    }

    addSection('Resumen general');
    autoTable(doc, {
      startY: y,
      head: [['Campo', 'Valor']],
      body: summaryBody,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 90], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
      margin: { left: 14, right: 14 },
    });
    y = afterTable(doc) + 8;

    if (data.anticipos.length > 0) {
      addSection('Anticipos');
      autoTable(doc, {
        startY: y,
        head: [['Descripción', 'Monto (S/)', 'Estado', 'Fecha']],
        body: data.anticipos.map((a) => [
          a.descripcion,
          a.monto.toFixed(2),
          a.estado,
          a.fechaSolicitud,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 90] },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        styles: { fontSize: 8, cellPadding: 1.5 },
        margin: { left: 14, right: 14 },
      });
      y = afterTable(doc) + 8;
    }

    addSection('Comprobantes asociados');
    autoTable(doc, {
      startY: y,
      head: [['Tipo', 'Fecha', 'Descripción', 'Monto (S/)', 'Estado']],
      body: data.comprobantes.map((c) => [
        c.tipo,
        c.fecha,
        c.descripcion,
        c.monto.toFixed(2),
        c.estadoComprobante,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 90] },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      styles: { fontSize: 7, cellPadding: 1.2 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 24 },
        2: { cellWidth: 62 },
        3: { cellWidth: 22 },
        4: { cellWidth: 28 },
      },
      margin: { left: 14, right: 14 },
    });
    y = afterTable(doc) + 8;

    if (data.settlement) {
      addSection('Liquidación');
      autoTable(doc, {
        startY: y,
        body: [
          ['Anticipo entregado (S/)', data.settlement.advanceTotal.toFixed(2)],
          ['Gastos reales (S/)', data.settlement.expenseTotal.toFixed(2)],
          [data.settlement.typeLabel, data.settlement.difference.toFixed(2)],
        ],
        theme: 'grid',
        styles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(`${data.fileBaseName}.pdf`);
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
