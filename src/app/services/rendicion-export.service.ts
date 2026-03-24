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
  proveedor?: string;
  numeroDocumento?: string;
}

export interface RendicionExportAnticipoRow {
  descripcion: string;
  monto: number;
  estado: string;
  fechaSolicitud: string;
}

export interface RendicionExportBudgetItemRow {
  descripcion: string;
  importe: number;
  personas: number;
  combustible: number;
  dias: number;
  total: number;
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
  accountNumber?: string;
  idDocument?: string;
  peopleNames?: string[];
  location?: string;
  startDate?: string;
  endDate?: string;
  items?: RendicionExportBudgetItemRow[];
  signature?: string;
}

const RED_HEADER = 'FF912f2c'; // Dark red for headers
const YELLOW_CELL = 'FFFFFF00'; // Yellow for summary cell

@Injectable({ providedIn: 'root' })
export class RendicionExportService {
  
  private async getLogoBase64(): Promise<string | null> {
    try {
      const response = await fetch('/logo_header.png');
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Could not load logo', e);
      return null;
    }
  }

  async exportToExcel(data: RendicionExportData): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Viatika';
    wb.created = new Date();
    const ws = wb.addWorksheet('Rendición', { views: [{ showGridLines: false }] });

    const logoB64 = await this.getLogoBase64();
    if (logoB64) {
      const imageId = wb.addImage({
        base64: logoB64,
        extension: 'png',
      });
      ws.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 140, height: 40 },
      });
    }

    ws.columns = [
      { width: 6 },  // Item
      { width: 12 }, // Fecha
      { width: 16 }, // Tipo
      { width: 18 }, // No Doc
      { width: 30 }, // Proveedor
      { width: 35 }, // Concepto
      { width: 12 }, // Ingresos
      { width: 12 }, // Gastos
    ];

    // Title Block
    ws.mergeCells('A4:H4');
    const titleCell = ws.getCell('A4');
    titleCell.value = 'RENDICIÓN DE VIÁTICOS';
    titleCell.font = { bold: true, size: 12 };
    titleCell.alignment = { horizontal: 'center' };

    ws.mergeCells('A5:H5');
    const subtitleCell = ws.getCell('A5');
    subtitleCell.value = `PROYECTO:\n${data.titulo}`;
    subtitleCell.font = { size: 10 };
    subtitleCell.alignment = { horizontal: 'center', wrapText: true };

    ws.mergeCells('A7:H7');
    const dateCell = ws.getCell('A7');
    if (data.startDate && data.endDate) {
      dateCell.value = `DEL ${data.startDate} AL ${data.endDate}`;
    } else {
      dateCell.value = `Rendición de la fecha`;
    }
    dateCell.font = { bold: true, size: 10 };
    dateCell.alignment = { horizontal: 'center' };

    // Info block
    ws.getCell('A9').value = 'Colaborador:';
    ws.mergeCells('B9:D9');
    ws.getCell('B9').value = data.colaborador;
    
    ws.getCell('A10').value = 'Localidad:';
    ws.mergeCells('B10:D10');
    ws.getCell('B10').value = data.location || '';

    // Table Header
    let r = 12;
    const headers = ['Item', 'Fecha\nEmisión', 'Tipo\nde\nDoc.', 'Nº del Documento', 'Proveedor', 'Concepto', 'Ingresos', 'Gastos'];
    headers.forEach((h, i) => {
      const c = ws.getCell(r, i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_HEADER } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });
    ws.getRow(r).height = 30;
    r++;

    let itemIndex = 1;
    let sumIngresos = 0;
    let sumGastos = 0;

    const addDataRow = (rowVals: any[]) => {
      rowVals.forEach((val, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = val;
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (i === 6 || i === 7) { 
           c.numFmt = '#,##0.00'; 
           if (val === 0 || !val) c.value = ''; // Hide 0s to match screenshot
           c.alignment = { horizontal: 'right' };
        } else {
           c.alignment = { horizontal: i === 0 || i === 1 || i === 2 ? 'center' : 'left' };
        }
      });
      r++;
    };

    // Advances as "Ingresos"
    data.anticipos.forEach(a => {
      addDataRow([
        itemIndex++,
        a.fechaSolicitud,
        '', 
        '', 
        'Transferencia',
        a.descripcion,
        a.monto,
        ''
      ]);
      sumIngresos += a.monto;
    });

    // Expenses as "Gastos"
    data.comprobantes.forEach(exp => {
      addDataRow([
        itemIndex++,
        exp.fecha,
        exp.tipo,
        exp.numeroDocumento || '',
        exp.proveedor || '',
        exp.descripcion,
        '',
        exp.monto
      ]);
      sumGastos += exp.monto;
    });

    // Fill some empty rows to make it look like a complete table (min 5 rows)
    const minRows = Math.max(5, itemIndex);
    while (itemIndex <= minRows) {
      addDataRow([itemIndex++, '', '', '', '', '', '', '']);
    }

    // Totals row
    ws.mergeCells(r, 1, r, 6);
    let cTotalId = ws.getCell(r, 6);
    cTotalId.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    
    const cIng = ws.getCell(r, 7);
    cIng.value = sumIngresos;
    cIng.font = { color: { argb: 'FFFFFFFF' } };
    cIng.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_HEADER } };
    cIng.numFmt = '#,##0.00';
    cIng.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    
    const cGas = ws.getCell(r, 8);
    cGas.value = sumGastos;
    cGas.font = { color: { argb: 'FFFFFFFF' } };
    cGas.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_HEADER } };
    cGas.numFmt = '#,##0.00';
    cGas.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    r += 2;

    // Summary Difference
    ws.mergeCells(r, 5, r, 6);
    const cDiffTitle = ws.getCell(r, 5);
    cDiffTitle.value = 'Por rendir y/o reembolsar';
    cDiffTitle.alignment = { horizontal: 'right' };

    const cDiffVal = ws.getCell(r, 8);
    cDiffVal.value = sumIngresos - sumGastos;
    cDiffVal.numFmt = '#,##0.00';
    cDiffVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_CELL } };
    cDiffVal.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    r += 4;

    if (data.signature) {
      ws.getRow(r - 1).height = 45; // Make some room
      const sigImgId = wb.addImage({
        base64: data.signature,
        extension: 'png',
      });
      ws.addImage(sigImgId, {
        tl: { col: 2, row: r - 2 },
        ext: { width: 150, height: 75 },
      });
    }

    // Signature
    ws.mergeCells(r, 3, r, 6);
    const cSigLine = ws.getCell(r, 3);
    cSigLine.border = { bottom: { style: 'medium' } };
    r++;
    ws.mergeCells(r, 3, r, 6);
    const cSigName = ws.getCell(r, 3);
    cSigName.value = data.colaborador.toUpperCase();
    cSigName.alignment = { horizontal: 'center' };
    cSigName.font = { size: 9 };
    r++;
    ws.mergeCells(r, 3, r, 6);
    const cSigDoc = ws.getCell(r, 3);
    cSigDoc.value = data.idDocument ? `DNI N° ${data.idDocument}` : '';
    cSigDoc.alignment = { horizontal: 'center' };
    cSigDoc.font = { size: 9 };

    const buf = await wb.xlsx.writeBuffer();
    this.triggerDownload(
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${data.fileBaseName}.xlsx`,
    );
  }

  async exportToPdf(data: RendicionExportData): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let y = 15;

    const logoB64 = await this.getLogoBase64();
    if (logoB64) {
      doc.addImage(logoB64, 'PNG', 14, 10, 45, 12);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text('RENDICIÓN DE VIÁTICOS', doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`PROYECTO:\n${data.titulo}`, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
    
    if (data.startDate && data.endDate) {
      doc.setFont("helvetica", "bold");
      doc.text(`DEL ${data.startDate} AL ${data.endDate}`, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
    }
    
    y = 50;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Colaborador:  ${data.colaborador}`, 14, y);
    y += 5;
    doc.text(`Localidad:    ${data.location || ''}`, 14, y);
    y += 8;

    let itemIndex = 1;
    let sumIngresos = 0;
    let sumGastos = 0;

    const bodyData: any[] = [];

    data.anticipos.forEach(a => {
      bodyData.push([
        itemIndex++,
        a.fechaSolicitud,
        '', 
        '', 
        'Transferencia',
        a.descripcion,
        a.monto.toFixed(2),
        ''
      ]);
      sumIngresos += a.monto;
    });

    data.comprobantes.forEach(exp => {
      bodyData.push([
        itemIndex++,
        exp.fecha,
        exp.tipo,
        exp.numeroDocumento || '',
        exp.proveedor || '',
        exp.descripcion,
        '',
        (exp.monto || 0).toFixed(2)
      ]);
      sumGastos += exp.monto || 0;
    });

    const minRows = Math.max(5, itemIndex);
    while (itemIndex <= minRows) {
      bodyData.push([itemIndex++, '', '', '', '', '', '', '']);
    }

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Fecha\nEmisión', 'Tipo\nde\nDoc.', 'Nº del Documento', 'Proveedor', 'Concepto', 'Ingresos', 'Gastos']],
      body: bodyData,
      theme: 'grid',
      headStyles: { fillColor: [145, 47, 44], textColor: 255, halign: 'center', valign: 'middle' },
      styles: { fontSize: 8, cellPadding: 2, textColor: 0 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 25 },
        3: { cellWidth: 35 },
        4: { cellWidth: 50 },
        5: { cellWidth: 'auto' },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'right', cellWidth: 20 },
      },
      margin: { left: 14, right: 14 }
    });

    y = afterTable(doc);

    // Totals row (simulated below table)
    doc.setFillColor(145, 47, 44);
    doc.rect(doc.internal.pageSize.getWidth() - 14 - 40, y, 20, 6, 'F');
    doc.rect(doc.internal.pageSize.getWidth() - 14 - 20, y, 20, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.text(sumIngresos.toFixed(2), doc.internal.pageSize.getWidth() - 14 - 22, y + 4, { align: 'right' });
    doc.text(sumGastos.toFixed(2), doc.internal.pageSize.getWidth() - 14 - 2, y + 4, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    y += 12;

    doc.text('Por rendir y/o reembolsar', doc.internal.pageSize.getWidth() - 14 - 25, y + 4, { align: 'right' });
    doc.setFillColor(255, 255, 0); // Yellow
    doc.setDrawColor(0);
    doc.rect(doc.internal.pageSize.getWidth() - 14 - 20, y, 20, 6, 'FD');
    doc.text((sumIngresos - sumGastos).toFixed(2), doc.internal.pageSize.getWidth() - 14 - 2, y + 4, { align: 'right' });

    y += 30;
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 30;
    }

    const centerPage = doc.internal.pageSize.getWidth() / 2;
    if (data.signature) {
      doc.addImage(data.signature, 'PNG', centerPage - 25, y - 25, 50, 25);
    }
    const lineY = y;
    doc.setLineWidth(0.5);
    doc.line(centerPage - 40, lineY, centerPage + 40, lineY);
    doc.setFontSize(8);
    doc.text(data.colaborador.toUpperCase(), centerPage, lineY + 4, { align: 'center' });
    if (data.idDocument) {
      doc.text(`DNI N° ${data.idDocument}`, centerPage, lineY + 8, { align: 'center' });
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

