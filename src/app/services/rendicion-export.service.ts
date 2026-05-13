import { Injectable, inject } from '@angular/core';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanyConfigService } from './company-config.service';

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
  approvedByName?: string;
  createdByName?: string;
  projectName?: string;
}

export interface AffidavitExportRow {
  fecha: string;
  documento: string;
  concepto: string;
  categoria: string;
  monto: number;
}

export interface AffidavitExportData {
  fileBaseName: string;
  tipo: 'viaticos_nacionales' | 'viajes_exterior';
  empresaNombre: string;
  empresaRuc: string;
  colaborador: string;
  documentoColaborador?: string;
  fechaGeneracion: string;
  total: number;
  rows: AffidavitExportRow[];
  signature?: string;
}

export interface MobilitySheetExportData {
  fileBaseName: string;
  collaborator: string;
  collaboratorDni?: string;
  internalCode?: string;
  location?: string;
  generatedAt: string;
  rows: Array<{
    fecha: string;
    clienteProveedor: string;
    origen: string;
    destino: string;
    gestion: string;
    total: number;
  }>;
  total: number;
  signature?: string;
}

export interface CashVoucherExportData {
  fileBaseName: string;
  collaborator: string;
  collaboratorDni?: string;
  internalCode?: string;
  entregadoA: string;
  direccion?: string;
  concepto: string;
  monto: number;
  generatedAt: string;
  signature?: string;
  projectName?: string;
  clientName?: string;
  fechaEmision?: string;
}

export interface ReceiptExportData {
  fileBaseName: string;
  collaborator: string;
  collaboratorDni?: string;
  razonSocial: string;
  ruc?: string;
  numeroDocumento?: string;
  concepto: string;
  fecha: string;
  monto: number;
  signature?: string;
}

export interface SingleExpenseAffidavitData {
  fileBaseName: string;
  titulo: string;
  colaborador: string;
  colaboradorDni?: string;
  empresaNombre?: string;
  fechaGeneracion: string;
  total: number;
  mobilityRows?: MobilitySheetExportData['rows'];
  receiptFields?: Array<{ label: string; value: string }>;
  descripcion?: string;
  signature?: string;
}

const RED_HEADER = 'FF912f2c'; // Dark red for headers
const YELLOW_CELL = 'FFFFFF00'; // Yellow for summary cell

@Injectable({ providedIn: 'root' })
export class RendicionExportService {
  private companyConfigService = inject(CompanyConfigService);

  private async getLogoBase64(): Promise<string | null> {
    const logoUrl = this.companyConfigService.getCompanyConfig()?.logo;
    const url = logoUrl || '/logo_header.png';
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      if (logoUrl) {
        // Retry with fallback
        try {
          const response = await fetch('/logo_header.png');
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch { return null; }
      }
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

    ws.getCell('A9').value = 'Colaborador:';
    ws.mergeCells('B9:D9');
    ws.getCell('B9').value = data.colaborador;
    
    ws.getCell('A10').value = 'Localidad:';
    ws.mergeCells('B10:D10');
    ws.getCell('B10').value = data.location || '';

    ws.getCell('E9').value = 'DNI:';
    ws.getCell('F9').value = data.idDocument || '';
    ws.getCell('E10').value = 'Cta / CCI:';
    ws.getCell('F10').value = data.accountNumber || '';

    if (data.peopleNames && data.peopleNames.length > 0) {
      ws.getCell('A11').value = 'Personas:';
      ws.mergeCells('B11:F11');
      ws.getCell('B11').value = data.peopleNames.join(', ');
    }

    // Table Header
    let r = 13;
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

    r += 1;
    if (data.items && data.items.length > 0) {
      ws.getCell(r, 1).value = 'RESUMEN DE SOLICITUD (PRESUPUESTO DETALLADO)';
      ws.getCell(r, 1).font = { bold: true };
      r++;
      const budgetHeaders = ['Viáticos', 'Importe (S/)', 'Personas', 'Combustible GLP/dia', 'Días', 'Total (S/)'];
      budgetHeaders.forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_HEADER } };
        c.alignment = { horizontal: 'center' };
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      r++;
      data.items.forEach(item => {
        ws.getCell(r, 1).value = item.descripcion;
        ws.getCell(r, 2).value = item.importe;
        ws.getCell(r, 3).value = item.personas;
        ws.getCell(r, 4).value = item.combustible;
        ws.getCell(r, 5).value = item.dias;
        ws.getCell(r, 6).value = item.total;
        [2, 4, 6].forEach(col => ws.getCell(r, col).numFmt = '#,##0.00');
        for (let i = 1; i <= 6; i++) {
          ws.getCell(r, i).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }
        r++;
      });
      r++;
    }

    ws.getCell(r, 1).value = 'RESUMEN DE RENDICIÓN';
    ws.getCell(r, 1).font = { bold: true };
    r++;
    ws.getCell(r, 1).value = 'Presupuesto asignado:';
    ws.getCell(r, 4).value = data.presupuesto;
    ws.getCell(r, 4).numFmt = '#,##0.00';
    r++;
    ws.getCell(r, 1).value = 'Total gastado:';
    ws.getCell(r, 4).value = data.totalGastado;
    ws.getCell(r, 4).numFmt = '#,##0.00';
    r++;
    ws.getCell(r, 1).value = 'Saldo sin gastar:';
    ws.getCell(r, 4).value = data.saldoLibre;
    ws.getCell(r, 4).numFmt = '#,##0.00';
    r++;
    if (data.approvedByName && data.approvedByName !== '—') {
      ws.getCell(r, 1).value = 'Aprobado por:';
      ws.getCell(r, 4).value = data.approvedByName;
      r++;
    }
    ws.getCell(r, 1).value = 'Estado:';
    ws.getCell(r, 4).value = data.estado;
    r++;
    ws.getCell(r, 1).value = 'Fecha generación:';
    ws.getCell(r, 4).value = data.fechaGeneracion;

    r += 2;

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
    y += 5;
    if (data.idDocument) {
      doc.text(`DNI:          ${data.idDocument}`, 14, y);
      y += 5;
    }
    if (data.accountNumber) {
      doc.text(`Cta / CCI:    ${data.accountNumber}`, 14, y);
      y += 5;
    }
    if (data.peopleNames && data.peopleNames.length > 0) {
      doc.text(`Personas:     ${data.peopleNames.join(', ')}`, 14, y);
      y += 5;
    }
    y += 3;

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

    doc.setFont("helvetica", "bold");
    doc.text('RESUMEN DE RENDICIÓN', 14, y);
    doc.setFont("helvetica", "normal");
    y += 6;
    doc.text(`Presupuesto asignado:   S/ ${data.presupuesto.toFixed(2)}`, 14, y);
    y += 5;
    doc.text(`Total gastado:          S/ ${data.totalGastado.toFixed(2)}`, 14, y);
    y += 5;
    doc.text(`Saldo sin gastar:       S/ ${data.saldoLibre.toFixed(2)}`, 14, y);
    y += 6;
    if (data.approvedByName && data.approvedByName !== '—') {
      doc.text(`Aprobado por: ${data.approvedByName}`, 14, y);
      y += 5;
    }
    doc.text(`Estado: ${data.estado}`, 14, y);
    y += 5;
    doc.text(`Fecha generación: ${data.fechaGeneracion}`, 14, y);

    if (data.items && data.items.length > 0) {
      y += 10;
      if (y > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text('RESUMEN DE SOLICITUD (PRESUPUESTO DETALLADO)', 14, y);
      y += 5;
      autoTable(doc, {
        startY: y,
        head: [['Viáticos', 'Importe', 'Personas', 'Combustible', 'Días', 'Total']],
        body: data.items.map(i => [
          i.descripcion,
          i.importe.toFixed(2),
          i.personas,
          i.combustible.toFixed(2),
          i.dias,
          i.total.toFixed(2)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [145, 47, 44], textColor: 255 },
        styles: { fontSize: 8 },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'center' },
          5: { halign: 'right' },
        },
        margin: { left: 14, right: 14 }
      });
      y = afterTable(doc);
    }

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

  exportAffidavitToPdf(data: AffidavitExportData): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('DECLARACION JURADA', 105, 16, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Tipo: ${data.tipo === 'viajes_exterior' ? 'Viajes al Exterior' : 'Viaticos Nacionales'}`, 14, 26);
    doc.text(`Empresa: ${data.empresaNombre}`, 14, 32);
    doc.text(`RUC: ${data.empresaRuc}`, 14, 38);
    doc.text(`Colaborador: ${data.colaborador}`, 14, 44);
    doc.text(`Documento: ${data.documentoColaborador || '-'}`, 14, 50);

    autoTable(doc, {
      startY: 58,
      head: [['Fecha', 'Documento', 'Concepto', 'Categoria', 'Monto (S/)']],
      body: data.rows.map(r => [r.fecha, r.documento, r.concepto, r.categoria, r.monto.toFixed(2)]),
      theme: 'grid',
      headStyles: { fillColor: [145, 47, 44], textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: { 4: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });

    const y = afterTable(doc) + 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total declarado: S/ ${data.total.toFixed(2)}`, 196, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de generacion: ${data.fechaGeneracion}`, 14, y + 8);

    if (data.signature) {
      doc.addImage(data.signature, 'PNG', 74, y + 16, 60, 24);
      doc.line(60, y + 44, 150, y + 44);
      doc.text(data.colaborador.toUpperCase(), 105, y + 49, { align: 'center' });
    }

    doc.save(`${data.fileBaseName}.pdf`);
  }

  exportMobilitySheetToPdf(data: MobilitySheetExportData): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('PLANILLA DE MOVILIDAD', 105, 16, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Colaborador: ${data.collaborator}`, 14, 26);
    doc.text(`DNI: ${data.collaboratorDni || '-'}`, 14, 32);
    doc.text(`Correlativo: ${data.internalCode || '-'}`, 14, 38);
    doc.text(`Lugar de generacion: ${data.location || '-'}`, 14, 44);
    doc.text(`Fecha de generacion: ${data.generatedAt}`, 14, 50);

    autoTable(doc, {
      startY: 58,
      head: [['Fecha', 'Cliente/Proveedor', 'Origen', 'Destino', 'Gestion', 'Total (S/)']],
      body: data.rows.map(r => [
        r.fecha,
        r.clienteProveedor || '-',
        r.origen || '-',
        r.destino || '-',
        r.gestion || '-',
        r.total.toFixed(2),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [145, 47, 44], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: { 5: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });

    const y = afterTable(doc) + 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total general: S/ ${data.total.toFixed(2)}`, 196, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    if (data.signature) {
      doc.addImage(data.signature, 'PNG', 74, y + 10, 60, 22);
      doc.line(60, y + 36, 150, y + 36);
      doc.text(data.collaborator.toUpperCase(), 105, y + 41, { align: 'center' });
    }

    doc.save(`${data.fileBaseName}.pdf`);
  }

  async exportCashVoucherToPdf(data: CashVoucherExportData): Promise<void> {
    // Quarter A4: 105 x 148 mm
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [105, 148] });
    const pageW = 105;
    const lm = 7;
    const rm = 98;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('COMPROBANTE DE CAJA', pageW / 2, 10, { align: 'center' });

    // Logo + company name + N°
    const logoB64 = await this.getLogoBase64();
    const headerY = 19;
    if (logoB64) {
      doc.addImage(logoB64, 'PNG', lm, headerY - 5, 14, 8);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(data.clientName || '', logoB64 ? lm + 17 : lm, headerY);
    doc.setTextColor(145, 47, 44);
    doc.text(`Nº  ${data.internalCode || '-'}`, rm, headerY, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    // Separator
    doc.setLineWidth(0.3);
    let y = headerY + 5;
    doc.line(lm, y, rm, y);
    y += 6;

    // Entregado a / Dirección
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const labelW = 24;
    doc.text('Entregado a:', lm, y);
    doc.text(data.entregadoA, lm + labelW, y);
    doc.line(lm + labelW, y + 0.5, rm, y + 0.5);
    y += 6;
    doc.text('Dirección:', lm, y);
    doc.text(data.direccion || '', lm + labelW, y);
    doc.line(lm + labelW, y + 0.5, rm, y + 0.5);
    y += 7;

    // Separator
    doc.line(lm, y, rm, y);
    y += 5;

    // He recibido de / concepto
    doc.text(`He recibido de ${data.clientName || ''}`, lm, y);
    y += 5;
    const conceptoLabel = 'Por concepto de:  ';
    doc.text(conceptoLabel, lm, y);
    const conceptoX = lm + doc.getTextWidth(conceptoLabel);
    doc.text(data.concepto, conceptoX, y);
    doc.line(conceptoX, y + 0.5, rm, y + 0.5);
    y += 7;

    // Separator
    doc.line(lm, y, rm, y);
    y += 5;

    // La Suma de / Proyecto
    const sumaLabel = 'La Suma de:  ';
    doc.text(sumaLabel, lm, y);
    const sumaX = lm + doc.getTextWidth(sumaLabel);
    doc.setFont('helvetica', 'bold');
    doc.text(`S/ ${data.monto.toFixed(2)}`, sumaX, y);
    doc.setFont('helvetica', 'normal');
    doc.line(sumaX, y + 0.5, rm, y + 0.5);
    y += 6;
    const proyLabel = 'Proyecto:  ';
    doc.text(proyLabel, lm, y);
    const proyX = lm + doc.getTextWidth(proyLabel);
    doc.text(data.projectName || '-', proyX, y);
    doc.line(proyX, y + 0.5, rm, y + 0.5);
    y += 12;

    // Signature block (right side)
    const sigX1 = 58;
    const sigX2 = rm;
    const sigCX = (sigX1 + sigX2) / 2;
    if (data.signature) {
      doc.addImage(data.signature, 'PNG', sigCX - 16, y - 10, 32, 10);
    }
    doc.line(sigX1, y, sigX2, y);
    doc.setFontSize(7);
    doc.text('Firma', sigCX, y + 4, { align: 'center' });
    doc.text(`DNI: ${data.collaboratorDni || ''}`, sigCX, y + 8, { align: 'center' });
    y += 14;

    // Date
    doc.setFontSize(8);
    const dateObj = data.fechaEmision ? new Date(data.fechaEmision) : new Date();
    const day = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    doc.text(`Lima,   ${day}   de   ${month}   de   ${year}`, lm, y);

    // Footer
    doc.setLineWidth(0.2);
    doc.line(lm, 140, rm, 140);
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text(data.clientName || '', pageW / 2, 144, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    doc.save(`${data.fileBaseName}.pdf`);
  }

  exportReceiptToPdf(data: ReceiptExportData): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('RECIBO DE CAJA', 105, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    let y = 30;
    doc.text(`Fecha: ${data.fecha}`, 14, y); y += 6;
    doc.text(`Proveedor: ${data.razonSocial}`, 14, y); y += 6;
    if (data.ruc) { doc.text(`RUC: ${data.ruc}`, 14, y); y += 6; }
    if (data.numeroDocumento) { doc.text(`N° Documento: ${data.numeroDocumento}`, 14, y); y += 6; }
    doc.text(`Colaborador: ${data.collaborator}`, 14, y); y += 6;
    if (data.collaboratorDni) { doc.text(`DNI: ${data.collaboratorDni}`, 14, y); y += 6; }
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Concepto', 'Monto (S/)']],
      body: [[data.concepto, data.monto.toFixed(2)]],
      theme: 'grid',
      headStyles: { fillColor: [145, 47, 44], textColor: 255 },
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
      margin: { left: 14, right: 14 },
    });

    const sigY = afterTable(doc) + 24;
    if (data.signature) {
      doc.addImage(data.signature, 'PNG', 74, sigY - 20, 60, 20);
    }
    doc.line(60, sigY + 6, 150, sigY + 6);
    doc.setFontSize(9);
    doc.text(data.collaborator.toUpperCase(), 105, sigY + 11, { align: 'center' });
    if (data.collaboratorDni) {
      doc.text(`DNI N° ${data.collaboratorDni}`, 105, sigY + 16, { align: 'center' });
    }

    doc.save(`${data.fileBaseName}.pdf`);
  }

  async exportMobilitySheetToExcel(data: MobilitySheetExportData): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Viatika';
    wb.created = new Date();
    const ws = wb.addWorksheet('Planilla Movilidad', { views: [{ showGridLines: false }] });

    ws.columns = [
      { width: 14 },
      { width: 30 },
      { width: 30 },
      { width: 30 },
      { width: 20 },
      { width: 14 },
    ];

    ws.mergeCells('A1:F1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'PLANILLA DE MOVILIDAD';
    titleCell.font = { bold: true, size: 12 };
    titleCell.alignment = { horizontal: 'center' };

    ws.getCell('A3').value = 'Colaborador:';
    ws.mergeCells('B3:F3');
    ws.getCell('B3').value = data.collaborator;
    ws.getCell('A4').value = 'DNI:';
    ws.getCell('B4').value = data.collaboratorDni || '';
    ws.getCell('A5').value = 'Correlativo:';
    ws.getCell('B5').value = data.internalCode || '';
    ws.getCell('A6').value = 'Lugar:';
    ws.getCell('B6').value = data.location || '';
    ws.getCell('A7').value = 'Fecha generación:';
    ws.getCell('B7').value = data.generatedAt;

    let r = 9;
    const headers = ['Fecha', 'Cliente / Proveedor', 'Origen', 'Destino', 'Gestión', 'Total (S/)'];
    headers.forEach((h, i) => {
      const c = ws.getCell(r, i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_HEADER } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    ws.getRow(r).height = 24;
    r++;

    let total = 0;
    data.rows.forEach(row => {
      ws.getCell(r, 1).value = row.fecha;
      ws.getCell(r, 2).value = row.clienteProveedor || '';
      ws.getCell(r, 3).value = row.origen || '';
      ws.getCell(r, 4).value = row.destino || '';
      ws.getCell(r, 5).value = row.gestion || '';
      ws.getCell(r, 6).value = row.total;
      ws.getCell(r, 6).numFmt = '#,##0.00';
      ws.getCell(r, 6).alignment = { horizontal: 'right' };
      for (let i = 1; i <= 6; i++) {
        ws.getCell(r, i).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
      total += row.total || 0;
      r++;
    });

    ws.mergeCells(r, 1, r, 5);
    const cLabel = ws.getCell(r, 1);
    cLabel.value = 'TOTAL GENERAL';
    cLabel.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_HEADER } };
    cLabel.alignment = { horizontal: 'right' };
    const cTotal = ws.getCell(r, 6);
    cTotal.value = total;
    cTotal.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_HEADER } };
    cTotal.numFmt = '#,##0.00';
    cTotal.alignment = { horizontal: 'right' };
    for (let i = 1; i <= 6; i++) {
      ws.getCell(r, i).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
    r += 3;

    if (data.signature) {
      const sigImgId = wb.addImage({ base64: data.signature, extension: 'png' });
      ws.addImage(sigImgId, { tl: { col: 1, row: r - 1 }, ext: { width: 150, height: 50 } });
    }
    ws.getRow(r).height = 55;
    ws.mergeCells(r, 2, r, 4);
    ws.getCell(r, 2).border = { bottom: { style: 'medium' } };
    r++;
    ws.mergeCells(r, 2, r, 4);
    ws.getCell(r, 2).value = data.collaborator.toUpperCase();
    ws.getCell(r, 2).alignment = { horizontal: 'center' };
    ws.getCell(r, 2).font = { size: 9 };
    if (data.collaboratorDni) {
      r++;
      ws.mergeCells(r, 2, r, 4);
      ws.getCell(r, 2).value = `DNI N° ${data.collaboratorDni}`;
      ws.getCell(r, 2).alignment = { horizontal: 'center' };
      ws.getCell(r, 2).font = { size: 9 };
    }

    const buf = await wb.xlsx.writeBuffer();
    this.triggerDownload(
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${data.fileBaseName}.xlsx`,
    );
  }

  exportSingleExpenseAffidavitToPdf(data: SingleExpenseAffidavitData): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('DECLARACIÓN JURADA', 105, 16, { align: 'center' });
    doc.setFontSize(10);
    doc.text(data.titulo, 105, 23, { align: 'center' });
    doc.setFont('helvetica', 'normal');

    let y = 33;
    if (data.empresaNombre) { doc.text(`Empresa: ${data.empresaNombre}`, 14, y); y += 6; }
    doc.text(`Colaborador: ${data.colaborador}`, 14, y); y += 6;
    if (data.colaboradorDni) { doc.text(`DNI: ${data.colaboradorDni}`, 14, y); y += 6; }
    doc.text(`Fecha: ${data.fechaGeneracion}`, 14, y); y += 10;

    let tableRendered = false;

    if (data.mobilityRows && data.mobilityRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Cliente / Proveedor', 'Origen', 'Destino', 'Gestión', 'Total (S/)']],
        body: data.mobilityRows.map(r => [r.fecha, r.clienteProveedor || '—', r.origen || '—', r.destino || '—', r.gestion || '—', r.total.toFixed(2)]),
        theme: 'grid',
        headStyles: { fillColor: [145, 47, 44], textColor: 255 },
        styles: { fontSize: 8 },
        columnStyles: { 5: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      });
      tableRendered = true;
    } else if (data.receiptFields && data.receiptFields.length > 0) {
      autoTable(doc, {
        startY: y,
        body: data.receiptFields.map(f => [f.label, f.value]),
        theme: 'plain',
        styles: { fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
        margin: { left: 14, right: 14 },
      });
      tableRendered = true;
    } else if (data.descripcion) {
      const lines = doc.splitTextToSize(`Descripción: ${data.descripcion}`, 182);
      doc.text(lines, 14, y);
      y += (lines.length + 1) * 6;
    }

    if (tableRendered) {
      y = afterTable(doc) + 8;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(`Total declarado: S/ ${data.total.toFixed(2)}`, 196, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    y += 20;
    const center = 105;
    if (data.signature) {
      doc.addImage(data.signature, 'PNG', center - 30, y - 18, 60, 18);
    }
    doc.line(center - 40, y, center + 40, y);
    y += 4;
    doc.setFontSize(9);
    doc.text(data.colaborador.toUpperCase(), center, y, { align: 'center' });
    if (data.colaboradorDni) {
      y += 4;
      doc.text(`DNI N° ${data.colaboradorDni}`, center, y, { align: 'center' });
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

