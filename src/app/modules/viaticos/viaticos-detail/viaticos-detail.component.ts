import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { AdvanceService } from '../../../services/advance.service';
import { UserStateService } from '../../../services/user-state.service';
import { NotificationService } from '../../../services/notification.service';
import {
  IAdvance,
  IAdvanceLine,
  ADVANCE_STATUS_LABELS,
  ADVANCE_STATUS_COLORS,
} from '../../../interfaces/advance.interface';

type JsPdfAT = jsPDF & { lastAutoTable?: { finalY: number } };

@Component({
  selector: 'app-viaticos-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './viaticos-detail.component.html',
})
export class ViaticosDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private advanceService = inject(AdvanceService);
  private userState = inject(UserStateService);
  private notifications = inject(NotificationService);
  private fb = inject(FormBuilder);

  readonly STATUS_LABELS = ADVANCE_STATUS_LABELS;
  readonly STATUS_COLORS = ADVANCE_STATUS_COLORS;

  isLoading = signal(true);
  isActing = signal(false);
  isDownloading = signal(false);
  advance = signal<IAdvance | null>(null);

  showRejectModal = signal(false);
  rejectForm!: FormGroup;

  get canApproveL1() { return this.userState.canApproveL1(); }
  get canApproveL2() { return this.userState.canApproveL2(); }

  ngOnInit() {
    this.rejectForm = this.fb.group({
      rejectionReason: ['', [Validators.required, Validators.minLength(10)]],
    });
    const id = this.route.snapshot.paramMap.get('id')!;
    this.advanceService.findOne(id).subscribe({
      next: (a) => { this.advance.set(a); this.isLoading.set(false); },
      error: () => { this.notifications.show('No se pudo cargar la solicitud', 'error'); this.router.navigate(['/viaticos']); },
    });
  }

  back() { this.router.navigate(['/viaticos']); }

  get canApproveL1Action(): boolean {
    const a = this.advance();
    return !!a && a.status === 'pending_l1' && this.canApproveL1;
  }

  get canApproveL2Action(): boolean {
    const a = this.advance();
    return !!a && a.status === 'pending_l2' && this.canApproveL2;
  }

  get canRejectAction(): boolean {
    const a = this.advance();
    return !!a && ['pending_l1', 'pending_l2'].includes(a.status) && (this.canApproveL1 || this.canApproveL2);
  }

  approveL1() {
    const a = this.advance();
    if (!a) return;
    this.isActing.set(true);
    this.advanceService.approveL1(a._id, {}).subscribe({
      next: (updated) => {
        this.advance.set(updated);
        this.notifications.show('Solicitud aprobada (Nivel 1)', 'success');
        this.isActing.set(false);
      },
      error: (e) => {
        this.notifications.show(e?.error?.message || 'Error al aprobar', 'error');
        this.isActing.set(false);
      },
    });
  }

  approveL2() {
    const a = this.advance();
    if (!a) return;
    this.isActing.set(true);
    this.advanceService.approveL2(a._id, {}).subscribe({
      next: (updated) => {
        this.advance.set(updated);
        this.notifications.show('Solicitud aprobada (Nivel 2)', 'success');
        this.isActing.set(false);
      },
      error: (e) => {
        this.notifications.show(e?.error?.message || 'Error al aprobar', 'error');
        this.isActing.set(false);
      },
    });
  }

  confirmReject() {
    const a = this.advance();
    if (!a || this.rejectForm.invalid) return;
    this.isActing.set(true);
    this.advanceService.reject(a._id, this.rejectForm.value).subscribe({
      next: (updated) => {
        this.advance.set(updated);
        this.notifications.show('Solicitud rechazada', 'success');
        this.showRejectModal.set(false);
        this.isActing.set(false);
      },
      error: (e) => {
        this.notifications.show(e?.error?.message || 'Error al rechazar', 'error');
        this.isActing.set(false);
      },
    });
  }

  collaboratorName(): string {
    const u = this.advance()?.userId;
    return u && typeof u === 'object' ? u.name : '—';
  }

  collaboratorEmail(): string {
    const u = this.advance()?.userId;
    return u && typeof u === 'object' ? u.email : '';
  }

  projectLabel(): string {
    const p = this.advance()?.projectId;
    if (!p || typeof p === 'string') return '—';
    return p.code ? `${p.code} — ${p.name}` : p.name;
  }

  dateRange(): string {
    const a = this.advance();
    if (!a) return '—';
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
    if (a.startDate && a.endDate) return `${fmt(a.startDate)} al ${fmt(a.endDate)}`;
    if (a.startDate) return fmt(a.startDate);
    return '—';
  }

  createdAt(): string {
    const c = this.advance()?.createdAt;
    if (!c) return '—';
    return new Date(c).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  lines(): IAdvanceLine[] {
    return this.advance()?.lines ?? [];
  }

  categoryName(line: IAdvanceLine): string {
    const c = line.categoryId;
    if (c && typeof c === 'object' && 'name' in c) return (c as { name: string }).name;
    return '—';
  }

  historyActionLabel(action: string): string {
    const map: Record<string, string> = {
      approved: 'Aprobado',
      rejected: 'Rechazado',
      resubmitted: 'Reenviado',
    };
    return map[action] ?? action;
  }

  // ── Helpers compartidos ──────────────────────────────────────────────────

  private exportData() {
    const a = this.advance()!;
    const user = a.userId as any;
    const project = a.projectId as any;
    const bank = user?.bankAccount;

    const responsible = user?.name ?? '—';
    const dni = user?.dni ?? '—';
    const nroCuenta = bank?.accountNumber ?? '';
    const cci = bank?.cci ?? '';
    const accountStr = [nroCuenta, cci ? `CCI: ${cci}` : ''].filter(Boolean).join('  /  ') || '—';
    const peopleMax = a.lines?.length
      ? Math.max(...a.lines.map((l) => l.peopleCount))
      : 0;
    const place = a.place ?? '—';
    const fmt = (d?: string) =>
      d ? new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const startFmt = fmt(a.startDate);
    const endFmt = fmt(a.endDate);
    const projectName = project && typeof project === 'object' ? project.name : '—';
    const lines = a.lines ?? [];
    const catName = (ln: IAdvanceLine) =>
      typeof ln.categoryId === 'object' && 'name' in (ln.categoryId as any)
        ? (ln.categoryId as any).name
        : '—';

    return { a, responsible, accountStr, dni, peopleMax, place, startFmt, endFmt, projectName, lines, catName };
  }

  private filename(ext: string) {
    const id = this.advance()?._id?.slice(-8) ?? 'doc';
    return `solicitud-viaticos-${id}.${ext}`;
  }

  // ── PDF ──────────────────────────────────────────────────────────────────

  downloadPdf(): void {
    const a = this.advance();
    if (!a || this.isDownloading()) return;
    this.isDownloading.set(true);

    try {
      const { responsible, accountStr, dni, peopleMax, place, startFmt, endFmt, projectName, lines, catName } =
        this.exportData();

      const DARK_RED: [number, number, number] = [126, 29, 29];
      const WHITE: [number, number, number] = [255, 255, 255];
      const LIGHT: [number, number, number] = [248, 243, 243];
      const BLACK: [number, number, number] = [30, 30, 30];

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfAT;
      const pageW = doc.internal.pageSize.getWidth();
      const M = 14;
      const W = pageW - M * 2;

      // ── Título ──
      doc.setFillColor(...DARK_RED);
      doc.rect(M, 10, W, 11, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...WHITE);
      doc.text('SOLICITUD DE VIÁTICOS', pageW / 2, 17.5, { align: 'center' });

      // ── Info section ──
      // Col widths: label 72, rest distributed across 5 cols = 110
      const COL_LABEL = 72;
      const COL_REST = W - COL_LABEL;

      autoTable(doc, {
        startY: 23,
        margin: { left: M, right: M },
        theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 }, textColor: BLACK, lineWidth: 0.2, lineColor: [200, 200, 200] },
        body: [
          [{ content: 'Responsable:', styles: { fontStyle: 'bold' } }, { content: responsible, colSpan: 5 }],
          [{ content: 'N° cuenta  y CCI', styles: { fontStyle: 'bold' } }, { content: accountStr, colSpan: 5 }],
          [{ content: 'Documento de identificación en caso sea CCI', styles: { fontStyle: 'bold' } }, { content: dni, colSpan: 5 }],
          [{ content: 'Cantidad de Personas (nombres):', styles: { fontStyle: 'bold' } }, { content: String(peopleMax), colSpan: 5 }],
          [{ content: 'Lugar:', styles: { fontStyle: 'bold' } }, { content: place, colSpan: 5 }],
          [
            { content: 'Tiempo presupuestado:', styles: { fontStyle: 'bold' } },
            { content: 'Del .....' }, { content: startFmt },
            { content: 'Al .....' }, { content: endFmt },
            { content: '' },
          ],
          [{ content: 'Proyecto:', styles: { fontStyle: 'bold' } }, { content: projectName, colSpan: 5 }],
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

      const tableRows = lines.map((ln) => [
        catName(ln),
        `S/ ${ln.importe.toFixed(2)}`,
        String(ln.peopleCount),
        ln.glpPerDay > 0 ? ln.glpPerDay.toFixed(2) : '—',
        String(ln.days),
        `S/ ${ln.lineTotal.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: tableY,
        margin: { left: M, right: M },
        head: [['Viáticos', 'Importe', 'Cantidad\nde personas', 'Cantidad combustible\nGLP x dia', 'Cantidad\nde días', 'Total']],
        body: [
          ...tableRows,
          [
            {
              content: 'TOTAL',
              colSpan: 5,
              styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: DARK_RED, textColor: WHITE },
            },
            {
              content: `S/ ${a.amount.toFixed(2)}`,
              styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: DARK_RED, textColor: WHITE },
            },
          ],
        ],
        headStyles: {
          fillColor: DARK_RED, textColor: WHITE, fontStyle: 'bold',
          halign: 'center', fontSize: 8.5, cellPadding: 4, lineWidth: 0.3, lineColor: [160, 40, 40],
        },
        styles: { fontSize: 8.5, cellPadding: 3, textColor: BLACK, lineWidth: 0.2, lineColor: [200, 200, 200] },
        alternateRowStyles: { fillColor: LIGHT },
        columnStyles: {
          0: { cellWidth: 68 },
          1: { halign: 'right' as const, cellWidth: 24 },
          2: { halign: 'center' as const, cellWidth: 24 },
          3: { halign: 'center' as const, cellWidth: 30 },
          4: { halign: 'center' as const, cellWidth: 18 },
          5: { halign: 'right' as const, cellWidth: W - 68 - 24 - 24 - 30 - 18 },
        },
      });

      doc.save(this.filename('pdf'));
    } finally {
      this.isDownloading.set(false);
    }
  }

  // ── Excel ────────────────────────────────────────────────────────────────

  async downloadExcel(): Promise<void> {
    const a = this.advance();
    if (!a || this.isDownloading()) return;
    this.isDownloading.set(true);

    try {
      const { responsible, accountStr, dni, peopleMax, place, startFmt, endFmt, projectName, lines, catName } =
        this.exportData();

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
        { width: 44 },
        { width: 17 },
        { width: 20 },
        { width: 24 },
        { width: 16 },
        { width: 18 },
      ];

      // ── Título ──
      ws.mergeCells('A1:F1');
      const title = ws.getCell('A1');
      title.value = 'SOLICITUD DE VIÁTICOS';
      title.font = { bold: true, size: 13, color: { argb: WH } };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DR } };
      title.alignment = { horizontal: 'center', vertical: 'middle' };
      title.border = allBorders('FF7E1D1D');
      ws.getRow(1).height = 26;

      // ── Helper: info row ──
      const addInfoRow = (label: string, value: string, rowIdx: number, mergeValue = true) => {
        const row = ws.addRow([label, value, '', '', '', '']);
        if (mergeValue) ws.mergeCells(`B${rowIdx}:F${rowIdx}`);
        row.height = 18;
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.font = col === 1 ? { bold: true, size: 9.5 } : { size: 9.5 };
          cell.border = allBorders();
          cell.alignment = { vertical: 'middle' };
        });
      };

      addInfoRow('Responsable:', responsible, 2);
      addInfoRow('N° cuenta  y CCI', accountStr, 3);
      addInfoRow('Documento de identificación en caso sea CCI', dni, 4);
      addInfoRow('Cantidad de Personas (nombres):', String(peopleMax), 5);
      addInfoRow('Lugar:', place, 6);

      // Tiempo presupuestado (row 7, no merge)
      const timeRow = ws.addRow(['Tiempo presupuestado:', 'Del .....', startFmt, 'Al .....', endFmt, '']);
      timeRow.height = 18;
      timeRow.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.font = col === 1 ? { bold: true, size: 9.5 } : { size: 9.5 };
        cell.border = allBorders();
        cell.alignment = { vertical: 'middle' };
      });

      addInfoRow('Proyecto:', projectName, 8);

      // ── Separador ──
      ws.addRow([]);

      // ── Encabezado tabla (row 10) ──
      const hRow = ws.addRow([
        'Viáticos', 'Importe', 'Cantidad de personas',
        'Cantidad combustible GLP x dia', 'Cantidad de días', 'Total',
      ]);
      hRow.height = 36;
      hRow.eachCell((cell) => {
        cell.font = { bold: true, size: 9.5, color: { argb: WH } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DR } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = allBorders('FF5C1515');
      });

      // ── Líneas ──
      const numFmt = '"S/ "#,##0.00';
      const numFmtPlain = '#,##0.00';

      lines.forEach((ln, i) => {
        const dRow = ws.addRow([
          catName(ln),
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
          if (col === 1) {
            cell.alignment = { vertical: 'middle' };
          } else if (col === 2 || col === 6) {
            cell.numFmt = numFmt;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else if (col === 3 || col === 5) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.numFmt = numFmtPlain;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });
      });

      // ── Fila TOTAL ──
      const totalRowIdx = 10 + lines.length + 1;
      const tRow = ws.addRow(['TOTAL', '', '', '', '', a.amount]);
      ws.mergeCells(`A${totalRowIdx}:E${totalRowIdx}`);
      tRow.height = 22;
      tRow.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.font = { bold: true, size: 10, color: { argb: WH } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DR } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.border = allBorders('FF5C1515');
        if (col === 6) cell.numFmt = numFmt;
      });

      // ── Guardar ──
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.filename('xlsx');
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      this.isDownloading.set(false);
    }
  }
}
