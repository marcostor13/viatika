import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { CompanyConfigService } from './company-config.service';
import { PlatformFileService } from './platform-file.service';

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export interface IViaticoSolicitudExportLine {
  categoria: string;
  detalle?: string;
  importe: number;
  peopleCount: number;
  glpPerDay: number;
  days: number;
  lineTotal: number;
}

/** Datos del formato "SOLICITUD DE VIÁTICOS" ya normalizados por el llamador. */
export interface IViaticoSolicitudExportData {
  /** Id de la solicitud; solo se usa para nombrar el archivo. */
  id: string;
  responsable: string;
  /** N° de cuenta y CCI ya formateados en una línea. */
  cuenta: string;
  dni: string;
  lugar: string;
  /** Fechas ya formateadas (dd/mm/aaaa). */
  desde: string;
  hasta: string;
  proyecto: string;
  lines: IViaticoSolicitudExportLine[];
  total: number;
  /** Saldo de una solicitud anterior aplicado a esta (si lo hay). */
  saldoAnterior?: number;
  /** Prefijo de moneda: 'S/', 'US$'… Por defecto 'S/'. */
  currency?: string;
}

/**
 * Genera el documento "SOLICITUD DE VIÁTICOS" en PDF y Excel.
 *
 * El mismo formato lo usan la solicitud nueva (rendición de tipo viático, que
 * coordinador y contabilidad ven en el popup de detalle) y las solicitudes
 * legacy basadas en `Advance`, así que vive en un servicio y no en el componente.
 */
@Injectable({ providedIn: 'root' })
export class ViaticoSolicitudExportService {
  private companyConfigService = inject(CompanyConfigService);
  private platformFile = inject(PlatformFileService);

  private filename(data: IViaticoSolicitudExportData, ext: string): string {
    const id = data.id?.slice(-8) || 'doc';
    return `solicitud-viaticos-${id}.${ext}`;
  }

  private currencyPrefix(data: IViaticoSolicitudExportData): string {
    return (data.currency || '').trim() || 'S/';
  }

  private money(data: IViaticoSolicitudExportData, value: number): string {
    return `${this.currencyPrefix(data)} ${Number(value ?? 0).toFixed(2)}`;
  }

  private peopleMax(data: IViaticoSolicitudExportData): number {
    return data.lines?.length ? Math.max(...data.lines.map((l) => Number(l.peopleCount ?? 0))) : 0;
  }

  /**
   * Logo de la empresa con respaldo al logo por defecto. En nativo el WebView no
   * puede hacer `fetch` al bucket de S3 por CORS (ver RendicionExportService).
   */
  private async loadLogoBase64(): Promise<string | null> {
    const logoUrl = this.companyConfigService.getCompanyConfig()?.logo;
    const toBase64 = (blob: Blob) =>
      new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    try {
      const url = logoUrl || '/logo_header.png';
      const blob = /^https?:\/\//i.test(url)
        ? await this.platformFile.fetchBinary(url)
        : await (await fetch(url)).blob();
      if (!blob) throw new Error('logo no disponible');
      return await toBase64(blob);
    } catch {
      if (!logoUrl) return null;
      try {
        return await toBase64(await (await fetch('/logo_header.png')).blob());
      } catch {
        return null;
      }
    }
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  async downloadPdf(data: IViaticoSolicitudExportData): Promise<void> {
    const logoBase64 = await this.loadLogoBase64();

    const DARK_RED: [number, number, number] = [126, 29, 29];
    const WHITE: [number, number, number] = [255, 255, 255];
    const LIGHT: [number, number, number] = [248, 243, 243];
    const BLACK: [number, number, number] = [30, 30, 30];
    const AMBER_BG: [number, number, number] = [255, 251, 235];
    const AMBER_FG: [number, number, number] = [120, 70, 20];

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable;
    const pageW = doc.internal.pageSize.getWidth();
    const M = 14;
    const W = pageW - M * 2;

    // ── Logo (fuera del recuadro) ──
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', M, 6, 42, 15);
    }

    // ── Título ──
    const HEADER_H = 10;
    const headerY = 23;
    doc.setFillColor(...DARK_RED);
    doc.rect(M, headerY, W, HEADER_H, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...WHITE);
    doc.text('SOLICITUD DE VIÁTICOS', pageW / 2, headerY + HEADER_H / 2 + 2, { align: 'center' });

    // ── Info section ──
    // Col widths: label 72, rest distributed across 5 cols = 110
    const COL_LABEL = 72;
    const COL_REST = W - COL_LABEL;

    autoTable(doc, {
      startY: 36,
      margin: { left: M, right: M },
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 }, textColor: BLACK, lineWidth: 0.2, lineColor: [200, 200, 200] },
      body: [
        [{ content: 'Responsable:', styles: { fontStyle: 'bold' } }, { content: data.responsable, colSpan: 5 }],
        [{ content: 'N° cuenta  y CCI', styles: { fontStyle: 'bold' } }, { content: data.cuenta, colSpan: 5 }],
        [{ content: 'Documento de identificación en caso sea CCI', styles: { fontStyle: 'bold' } }, { content: data.dni, colSpan: 5 }],
        [{ content: 'Cantidad de Personas (nombres):', styles: { fontStyle: 'bold' } }, { content: String(this.peopleMax(data)), colSpan: 5 }],
        [{ content: 'Lugar:', styles: { fontStyle: 'bold' } }, { content: data.lugar, colSpan: 5 }],
        [
          { content: 'Tiempo presupuestado:', styles: { fontStyle: 'bold' } },
          { content: 'Del .....' }, { content: data.desde },
          { content: 'Al .....' }, { content: data.hasta, colSpan: 2 },
        ],
        [{ content: 'Proyecto:', styles: { fontStyle: 'bold' } }, { content: data.proyecto, colSpan: 5 }],
      ],
      columnStyles: {
        0: { cellWidth: COL_LABEL },
        1: { cellWidth: 16 },
        2: { cellWidth: 28 },
        3: { cellWidth: 16 },
        4: { cellWidth: 28 },
        5: { cellWidth: COL_REST - 16 - 28 - 16 - 28 },
      },
    });

    // ── Tabla de líneas ──
    const tableY = (doc.lastAutoTable?.finalY ?? 23) + 4;

    const tableRows = (data.lines ?? []).map((ln) => [
      ln.categoria,
      ln.detalle ?? '',
      this.money(data, ln.importe),
      String(ln.peopleCount),
      ln.glpPerDay > 0 ? ln.glpPerDay.toFixed(2) : '—',
      String(ln.days),
      this.money(data, ln.lineTotal),
    ]);

    const hasSaldo = data.saldoAnterior != null && data.saldoAnterior > 0;

    autoTable(doc, {
      startY: tableY,
      margin: { left: M, right: M },
      head: [['Viáticos', 'Detalle', 'Importe', 'Cantidad\nde personas', 'Combustible\nGLP x dia', 'Días', 'Total']],
      body: [
        ...(hasSaldo ? [[
          { content: 'Saldo anterior', styles: { fontStyle: 'bold' as const, fillColor: AMBER_BG, textColor: AMBER_FG } },
          { content: '', styles: { fillColor: AMBER_BG } },
          { content: '', styles: { fillColor: AMBER_BG } },
          { content: '', styles: { fillColor: AMBER_BG } },
          { content: '', styles: { fillColor: AMBER_BG } },
          { content: '', styles: { fillColor: AMBER_BG } },
          { content: this.money(data, data.saldoAnterior!), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: AMBER_BG, textColor: AMBER_FG } },
        ]] : []),
        ...tableRows,
        [
          {
            content: 'TOTAL',
            colSpan: 6,
            styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: DARK_RED, textColor: WHITE },
          },
          {
            content: this.money(data, data.total),
            styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: DARK_RED, textColor: WHITE },
          },
        ],
      ],
      headStyles: {
        fillColor: DARK_RED, textColor: WHITE, fontStyle: 'bold',
        halign: 'center', valign: 'middle', fontSize: 8,
        cellPadding: { top: 3, bottom: 3, left: 1.5, right: 1.5 },
        lineWidth: 0.3, lineColor: [160, 40, 40],
      },
      styles: {
        fontSize: 8.5, textColor: BLACK,
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
        lineWidth: 0.2, lineColor: [200, 200, 200],
        valign: 'middle', overflow: 'linebreak',
      },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 44 },
        1: { cellWidth: 'auto' },
        2: { halign: 'right' as const, cellWidth: 22 },
        3: { halign: 'center' as const, cellWidth: 24 },
        4: { halign: 'center' as const, cellWidth: 26 },
        5: { halign: 'center' as const, cellWidth: 14 },
        6: { halign: 'right' as const, cellWidth: 22 },
      },
    });

    await this.platformFile.saveBlob(doc.output('blob'), this.filename(data, 'pdf'));
  }

  // ── Excel ──────────────────────────────────────────────────────────────────

  async downloadExcel(data: IViaticoSolicitudExportData): Promise<void> {
    const logoBase64 = await this.loadLogoBase64();
    const hasSaldo = data.saldoAnterior != null && data.saldoAnterior > 0;
    const lines = data.lines ?? [];

    const DR = 'FF7E1D1D';
    const WH = 'FFFFFFFF';
    const LT = 'FFF8F3F3';
    const GR = 'FFD0D0D0';

    const borderThin = (color = GR): Partial<ExcelJS.Border> => ({ style: 'thin', color: { argb: color } });
    const allBorders = (color = GR): Partial<ExcelJS.Borders> => ({
      top: borderThin(color), left: borderThin(color), bottom: borderThin(color), right: borderThin(color),
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Viatika';
    const ws = wb.addWorksheet('Solicitud Viáticos');

    ws.columns = [
      { width: 40 },
      { width: 30 },
      { width: 16 },
      { width: 20 },
      { width: 24 },
      { width: 14 },
      { width: 16 },
    ];

    // ── Logo (fila 1, fuera del recuadro) ──
    ws.mergeCells('A1:G1');
    ws.getRow(1).height = 44;
    if (logoBase64) {
      const logoData = logoBase64.replace(/^data:[^;]+;base64,/, '');
      const imgId = wb.addImage({ base64: logoData, extension: 'png' });
      ws.addImage(imgId, { tl: { col: 0, row: 0 } as any, ext: { width: 142, height: 42 } });
    }

    // ── Título (fila 2) ──
    ws.mergeCells('A2:G2');
    const title = ws.getCell('A2');
    title.value = 'SOLICITUD DE VIÁTICOS';
    title.font = { bold: true, size: 13, color: { argb: WH } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DR } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.border = allBorders('FF7E1D1D');
    ws.getRow(2).height = 26;

    // ── Helper: info row ──
    const addInfoRow = (label: string, value: string, rowIdx: number, mergeValue = true) => {
      const row = ws.addRow([label, value, '', '', '', '', '']);
      if (mergeValue) ws.mergeCells(`B${rowIdx}:G${rowIdx}`);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.font = col === 1 ? { bold: true, size: 9.5 } : { size: 9.5 };
        cell.border = allBorders();
        cell.alignment = { vertical: 'middle' };
      });
    };

    addInfoRow('Responsable:', data.responsable, 3);
    addInfoRow('N° cuenta  y CCI', data.cuenta, 4);
    addInfoRow('Documento de identificación en caso sea CCI', data.dni, 5);
    addInfoRow('Cantidad de Personas (nombres):', String(this.peopleMax(data)), 6);
    addInfoRow('Lugar:', data.lugar, 7);

    // Tiempo presupuestado (row 8)
    const timeRow = ws.addRow(['Tiempo presupuestado:', 'Del .....', data.desde, 'Al .....', data.hasta, '', '']);
    ws.mergeCells(timeRow.number, 5, timeRow.number, 7);
    timeRow.height = 18;
    timeRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = col === 1 ? { bold: true, size: 9.5 } : { size: 9.5 };
      cell.border = allBorders();
      cell.alignment = { vertical: 'middle' };
    });

    addInfoRow('Proyecto:', data.proyecto, 9);

    // ── Separador ──
    ws.addRow([]);

    // ── Encabezado tabla (row 11) ──
    const hRow = ws.addRow([
      'Viáticos', 'Detalle', 'Importe', 'Cantidad de personas',
      'Combustible GLP x dia', 'Días', 'Total',
    ]);
    hRow.height = 36;
    hRow.eachCell((cell) => {
      cell.font = { bold: true, size: 9.5, color: { argb: WH } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DR } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = allBorders('FF5C1515');
    });

    // ── Líneas ──
    const numFmt = `"${this.currencyPrefix(data)} "#,##0.00`;
    const numFmtPlain = '#,##0.00';

    if (hasSaldo) {
      const sRow = ws.addRow(['Saldo anterior', '', '', '', '', '', data.saldoAnterior!]);
      sRow.height = 18;
      sRow.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        cell.font = (col === 1 || col === 7)
          ? { bold: true, size: 9.5, color: { argb: 'FF92400E' } }
          : { size: 9.5, color: { argb: 'FF92400E' } };
        cell.border = allBorders();
        cell.alignment = col === 7
          ? { horizontal: 'right', vertical: 'middle' }
          : { vertical: 'middle' };
        if (col === 7) cell.numFmt = numFmt;
      });
    }

    lines.forEach((ln, i) => {
      const dRow = ws.addRow([
        ln.categoria,
        ln.detalle ?? '',
        ln.importe,
        ln.peopleCount,
        ln.glpPerDay,
        ln.days,
        ln.lineTotal,
      ]);
      dRow.height = 18;
      dRow.eachCell({ includeEmpty: true }, (cell, col) => {
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LT } };
        cell.font = { size: 9.5 };
        cell.border = allBorders();
        if (col === 1 || col === 2) {
          cell.alignment = { vertical: 'middle' };
        } else if (col === 3 || col === 7) {
          cell.numFmt = numFmt;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (col === 4 || col === 6) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.numFmt = numFmtPlain;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
    });

    // ── Fila TOTAL ──
    const totalRowIdx = 11 + lines.length + (hasSaldo ? 1 : 0) + 1;
    const tRow = ws.addRow(['TOTAL', '', '', '', '', '', data.total]);
    ws.mergeCells(`A${totalRowIdx}:F${totalRowIdx}`);
    tRow.height = 22;
    tRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { bold: true, size: 10, color: { argb: WH } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DR } };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.border = allBorders('FF5C1515');
      if (col === 7) cell.numFmt = numFmt;
    });

    // ── Guardar ──
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await this.platformFile.saveBlob(blob, this.filename(data, 'xlsx'));
  }
}
