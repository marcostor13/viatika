import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseReportsService } from '../../services/expense-reports.service';
import { UserStateService } from '../../services/user-state.service';
import { InvoicesService } from '../invoices/services/invoices.service';
import { NotificationService } from '../../services/notification.service';
import { IProject } from '../invoices/interfaces/project.interface';
import { ICategory } from '../invoices/interfaces/category.interface';
import {
  RendicionExportService,
  MobilitySheetExportData,
  CashVoucherExportData,
  ReceiptExportData,
} from '../../services/rendicion-export.service';
import {
  formatFechaEmisionDdMmYyyy,
  resolveExpenseFechaEmision,
} from '../../utils/fecha-emision.util';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type JsPdfAT = jsPDF & { lastAutoTable?: { finalY: number } };

@Component({
  selector: 'app-rendiciones-directas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rendiciones-directas.component.html',
})
export class RendicionesDirectasComponent implements OnInit {
  private expenseReportsService = inject(ExpenseReportsService);
  private userState = inject(UserStateService);
  private invoicesService = inject(InvoicesService);
  private notifications = inject(NotificationService);
  private exportService = inject(RendicionExportService);

  loading = signal(false);
  data = signal<any[]>([]);
  total = signal(0);
  pages = signal(0);

  filterDateFrom = '';
  filterDateTo = '';
  filterProjectId = '';
  filterCategoryId = '';
  filterDocNumber = '';
  page = 1;
  readonly limit = 50;

  projects = signal<IProject[]>([]);
  categories = signal<ICategory[]>([]);

  expandedId = signal<string | null>(null);
  approvingId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCatalogs();
    this.loadData();
  }

  private get clientId(): string {
    const user = this.userState.getUser() as any;
    return user?.companyId || user?.client?._id ||
      (typeof user?.clientId === 'string' ? user.clientId : user?.clientId?._id) || '';
  }

  private loadCatalogs(): void {
    const cid = this.clientId;
    if (!cid) return;
    this.invoicesService.getProjects(cid).subscribe({ next: list => this.projects.set(list ?? []) });
    this.invoicesService.getCategories().subscribe({ next: list => this.categories.set(list ?? []) });
  }

  loadData(): void {
    const cid = this.clientId;
    if (!cid) return;
    this.loading.set(true);
    this.expenseReportsService.findDirectRendicionExpenses(cid, {
      page: this.page, limit: this.limit,
      dateFrom: this.filterDateFrom || undefined, dateTo: this.filterDateTo || undefined,
      projectId: this.filterProjectId || undefined, categoryId: this.filterCategoryId || undefined,
      docNumber: this.filterDocNumber || undefined,
    }).subscribe({
      next: res => { this.data.set(res.data ?? []); this.total.set(res.total ?? 0); this.pages.set(res.pages ?? 0); this.loading.set(false); },
      error: () => { this.loading.set(false); this.notifications.show('Error al cargar los datos', 'error'); },
    });
  }

  applyFilters(): void { this.page = 1; this.loadData(); }
  clearFilters(): void { this.filterDateFrom = ''; this.filterDateTo = ''; this.filterProjectId = ''; this.filterCategoryId = ''; this.filterDocNumber = ''; this.page = 1; this.loadData(); }
  goToPage(p: number): void { if (p < 1 || p > this.pages()) return; this.page = p; this.loadData(); }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  // ─── Aprobación ──────────────────────────────────────────────────────────────

  approveExpense(e: any): void {
    if (this.approvingId()) return;
    this.approvingId.set(e._id);
    this.invoicesService.approveByContabilidad(e._id).subscribe({
      next: () => {
        this.approvingId.set(null);
        this.notifications.show('Documento marcado como revisado.', 'success');
        // Actualizar localmente sin recargar
        this.data.update(list => list.map(row =>
          row._id === e._id
            ? { ...row, approvalCont: { status: 'approved' } }
            : row
        ));
      },
      error: (err) => {
        this.approvingId.set(null);
        const msg = err?.error?.message;
        this.notifications.show(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al revisar.', 'error');
      },
    });
  }

  // ─── Helpers display ─────────────────────────────────────────────────────────

  getData(e: any): Record<string, unknown> {
    const raw = e?.data;
    try {
      if (raw == null) return {};
      if (typeof raw === 'string') return JSON.parse(raw);
      if (typeof raw === 'object') return { ...raw };
    } catch { return {}; }
    return {};
  }

  getTypeKey(e: any): string {
    const t = e?.expenseType;
    if (t === 'planilla_movilidad') return 'planilla_movilidad';
    if (t === 'otros_gastos') return 'otros_gastos';
    if (t === 'comprobante_caja') return 'comprobante_caja';
    if (t === 'recibo_caja') return 'recibo_caja';
    return 'factura';
  }

  getTypeCode(e: any): string {
    const type = e?.expenseType;
    if (type === 'planilla_movilidad') return 'PM';
    if (type === 'comprobante_caja') return 'CC';
    if (type === 'recibo_caja') return 'H';
    if (type === 'otros_gastos') {
      const sub = e?.subTipo ?? this.getData(e)['subTipo'];
      if (sub === 'TK') return 'TK';
      if (sub === 'BV') return 'BV';
      if (sub === 'RC') return 'RC';
      if (sub === 'DJ') return 'DJ';
      if (sub === 'OT') return 'OT';
      return 'SC';
    }
    const d = this.getData(e);
    const tc = String(d['tipoComprobante'] ?? '').trim();
    if (tc === '03') return 'BV';
    if (tc === '12') return 'TK';
    if (tc === '01') return 'FE';
    return 'FT';
  }

  getTypeBadgeClass(e: any): string {
    const code = this.getTypeCode(e);
    if (code === 'PM') return 'bg-yellow-100 text-yellow-800';
    if (code === 'CC') return 'bg-purple-100 text-purple-800';
    if (code === 'SC' || code === 'OT') return 'bg-gray-100 text-gray-600';
    if (code === 'DJ') return 'bg-amber-100 text-amber-800';
    if (code === 'TK') return 'bg-teal-100 text-teal-700';
    if (code === 'RC') return 'bg-indigo-100 text-indigo-700';
    return 'bg-blue-100 text-blue-700';
  }

  getTipoLabel(e: any): string {
    const map: Record<string, string> = { factura: 'Factura', planilla_movilidad: 'Planilla de Movilidad', otros_gastos: 'Otros Gastos', recibo_caja: 'Recibo de Caja', comprobante_caja: 'Comprobante de Caja' };
    return map[e.expenseType] ?? e.expenseType ?? '—';
  }

  getColaborador(e: any): string {
    const u = e._report?.userId;
    if (!u) return '—';
    return (typeof u === 'object' ? u.name || u.email : u) || '—';
  }

  getRendicionTitle(e: any): string { return e._report?.motivo || e._report?.title || '—'; }

  getProject(e: any): string {
    const p = e._projectDoc || e._project?.[0];
    if (!p) return '—';
    return p.code ? `${p.code} — ${p.name}` : p.name || '—';
  }

  getCategory(e: any): string {
    const c = e._categoryDoc || e._category?.[0];
    return c?.name || '—';
  }

  getDocNumber(e: any): string {
    const type = e?.expenseType;
    if (type === 'planilla_movilidad' || type === 'comprobante_caja') {
      return (typeof e?.internalCode === 'string' && e.internalCode) ? e.internalCode : '-';
    }
    if (type === 'recibo_caja') {
      const d = this.getData(e);
      const payload = d['payload'];
      const p: any = typeof payload === 'string' ? (() => { try { return JSON.parse(payload); } catch { return {}; } })() : (payload ?? {});
      return p['numeroDocumento'] ? String(p['numeroDocumento']) : '-';
    }
    const d = this.getData(e);
    const serie = d['serie'] ? String(d['serie']) : '';
    const corr = d['correlativo'] ? String(d['correlativo']) : '';
    if (serie && corr) return `${serie}-${corr}`;
    return serie || corr || '-';
  }

  getProveedor(e: any): string {
    const type = e?.expenseType;
    if (type === 'planilla_movilidad' || type === 'comprobante_caja' || type === 'otros_gastos') return '-';
    const d = this.getData(e);
    const r = d['razonSocial'];
    if (typeof r === 'string' && r.trim()) return r.trim();
    return e?.provider || '-';
  }

  getConcepto(e: any): string {
    const type = e?.expenseType;
    if (type === 'planilla_movilidad') { const rows: any[] = e?.mobilityRows || []; const first = rows[0]; return first?.gestion || `${rows.length} filas`; }
    if (type === 'otros_gastos') return e?.description || 'DJ firmada';
    if (type === 'comprobante_caja') { try { const d = this.getData(e); const raw = d['payload']; const obj: any = typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {}); return String(obj['concepto'] || ''); } catch { return ''; } }
    const d = this.getData(e);
    return String(d['concepto'] || e.description || '');
  }

  getFecha(e: any): string {
    const type = e?.expenseType;
    if (type === 'planilla_movilidad') { const rows: any[] = e?.mobilityRows || []; const dates = rows.map((r: any) => r.fecha).filter(Boolean); return dates.length ? ([...dates].sort()[0]) : '—'; }
    if (type === 'otros_gastos') return e.fechaEmision || formatFechaEmisionDdMmYyyy(e.createdAt) || '—';
    return e.fechaEmision || '—';
  }

  emissionDateText(e: any): string { return formatFechaEmisionDdMmYyyy(resolveExpenseFechaEmision(e)); }

  dataText(e: any, key: string): string {
    const d = this.getData(e);
    const v = d[key];
    if (v == null) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  cashVoucherPayload(e: any): Record<string, unknown> {
    const d = this.getData(e);
    const raw = d['payload'];
    let obj: any = {};
    if (raw && typeof raw === 'string') { try { obj = JSON.parse(raw); } catch { /**/ } }
    else if (raw && typeof raw === 'object') { obj = raw; }
    if (!obj['concepto'] && e['description']) { try { const p = JSON.parse(String(e['description'])); if (p?.concepto) obj = p; } catch { /**/ } }
    return obj;
  }

  cashVoucherText(e: any, key: string): string {
    const v = this.cashVoucherPayload(e)[key];
    if (v == null || v === '') return '—';
    return String(v);
  }

  mobilityRows(e: any): any[] { const r = e?.mobilityRows; return Array.isArray(r) ? r : []; }
  mobilityRowTotal(row: any): number { const t = row?.total; if (typeof t === 'number') return t; const n = Number(t); return Number.isNaN(n) ? 0 : n; }
  trackRow(i: number): number { return i; }

  getFileUrl(e: any): string | null { const f = e?.file; return (typeof f === 'string' && f.trim()) ? f.trim() : null; }
  hasFile(e: any): boolean { return this.getFileUrl(e) !== null; }
  isPreviewImage(e: any): boolean { const u = this.getFileUrl(e); return u ? /\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(u) : false; }
  openFile(e: any): void { const url = this.getFileUrl(e); url ? window.open(url, '_blank', 'noopener,noreferrer') : this.notifications.show('Sin documento adjunto', 'warning'); }

  getPopulatedName(field: any): string {
    if (field && typeof field === 'object' && 'name' in field) return String(field.name);
    return '—';
  }

  getEstadoCont(e: any): string { return e.approvalCont?.status === 'approved' ? 'Revisado' : 'Pendiente'; }
  getEstadoContClass(e: any): string { return e.approvalCont?.status === 'approved' ? 'bg-teal-100 text-teal-700' : 'bg-yellow-100 text-yellow-700'; }
  isRevisado(e: any): boolean { return e.approvalCont?.status === 'approved'; }
  getTotal(e: any): number { const t = e?.total; if (typeof t === 'number') return t; const n = Number(t); return Number.isNaN(n) ? 0 : n; }

  sunatBlock(e: any): any | null {
    const d = this.getData(e);
    const s = d['sunatValidation'];
    return (s && typeof s === 'object') ? s : null;
  }

  reviewHistory(e: any): any[] {
    const r = e?.reviewHistory;
    return Array.isArray(r) ? r.filter(Boolean) : [];
  }

  reviewActionLabel(action: unknown): string { return action === 'rejected' ? 'Rechazado' : 'Aprobado'; }

  get totalMonto(): number { return this.data().reduce((sum, e) => sum + this.getTotal(e), 0); }

  // ─── Exports individuales ────────────────────────────────────────────────────

  async exportMobilityPdf(e: any): Promise<void> {
    const collab = this.getColaborador(e);
    const rows = this.mobilityRows(e).map((r: any) => ({
      fecha: String(r.fecha || ''), clienteProveedor: String(r.clienteProveedor || ''),
      origen: String(r.origen || ''), destino: String(r.destino || ''),
      gestion: String(r.gestion || ''), total: this.mobilityRowTotal(r),
    }));
    const data: MobilitySheetExportData = {
      fileBaseName: `planilla_${String(e._id || 'doc')}`,
      collaborator: collab, internalCode: e.internalCode || undefined,
      generatedAt: new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }),
      proyecto: this.getProject(e), rows, total: this.getTotal(e),
    };
    await this.exportService.exportMobilitySheetToPdf(data);
  }

  async exportMobilityExcel(e: any): Promise<void> {
    const collab = this.getColaborador(e);
    const rows = this.mobilityRows(e).map((r: any) => ({
      fecha: String(r.fecha || ''), clienteProveedor: String(r.clienteProveedor || ''),
      origen: String(r.origen || ''), destino: String(r.destino || ''),
      gestion: String(r.gestion || ''), total: this.mobilityRowTotal(r),
    }));
    const data: MobilitySheetExportData = {
      fileBaseName: `planilla_${String(e._id || 'doc')}`,
      collaborator: collab, internalCode: e.internalCode || undefined,
      generatedAt: new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }),
      proyecto: this.getProject(e), rows, total: this.getTotal(e),
    };
    await this.exportService.exportMobilitySheetToExcel(data);
  }

  async exportCashVoucherPdf(e: any): Promise<void> {
    const payload = this.cashVoucherPayload(e);
    const data: CashVoucherExportData = {
      fileBaseName: `comprobante_caja_${String(e._id || 'doc')}`,
      collaborator: this.getColaborador(e),
      internalCode: e.internalCode || undefined,
      entregadoA: String(payload['entregadoA'] || ''),
      direccion: String(payload['direccion'] || ''),
      concepto: String(payload['concepto'] || ''),
      monto: this.getTotal(e),
      generatedAt: new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }),
      projectName: this.getProject(e),
      fechaEmision: this.emissionDateText(e),
    };
    await this.exportService.exportCashVoucherToPdf(data);
  }

  async exportReceiptPdf(e: any): Promise<void> {
    const d = this.getData(e);
    const payload: any = typeof d['payload'] === 'string' ? (() => { try { return JSON.parse(String(d['payload'])); } catch { return {}; } })() : (d['payload'] ?? {});
    const data: ReceiptExportData = {
      fileBaseName: `recibo_${String(e._id || 'doc')}`,
      collaborator: this.getColaborador(e),
      razonSocial: String(e.receiptRazonSocial || payload['razonSocial'] || ''),
      ruc: String(e.receiptRuc || payload['ruc'] || ''),
      numeroDocumento: String(payload['numeroDocumento'] || e.receiptNumeroDocumento || ''),
      concepto: String(e.receiptConcepto || payload['concepto'] || ''),
      fecha: this.emissionDateText(e),
      monto: this.getTotal(e),
    };
    await this.exportService.exportReceiptToPdf(data);
  }

  // ─── Export global (todos los filtrados) ────────────────────────────────────

  private readonly HEADERS = ['Fecha', 'Tipo', 'N° Doc', 'Colaborador', 'Rendicion', 'Proyecto', 'Categoria', 'Proveedor', 'Concepto', 'Monto S/', 'Revisado'];

  private buildExportRows(): any[][] {
    return this.data().map(e => [
      this.getFecha(e), this.getTypeCode(e), this.getDocNumber(e),
      this.getColaborador(e), this.getRendicionTitle(e),
      this.getProject(e), this.getCategory(e),
      this.getProveedor(e), this.getConcepto(e),
      Number(this.getTotal(e)).toFixed(2),
      this.getEstadoCont(e),
    ]);
  }

  async exportExcel(): Promise<void> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rendiciones Directas');

    // Título
    ws.mergeCells('A1:K1');
    const titleRow = ws.getCell('A1');
    titleRow.value = 'Reporte de Rendiciones Directas';
    titleRow.font = { bold: true, size: 14 };
    titleRow.alignment = { horizontal: 'center' };

    // Filtros aplicados
    ws.mergeCells('A2:K2');
    const subtitle = [`Generado: ${new Date().toLocaleDateString('es-PE')}`, `Total: ${this.total()} registros`];
    if (this.filterDateFrom || this.filterDateTo) subtitle.push(`Periodo: ${this.filterDateFrom || '...'} al ${this.filterDateTo || '...'}`);
    ws.getCell('A2').value = subtitle.join('   |   ');
    ws.getCell('A2').font = { size: 9, italic: true };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    ws.addRow([]); // spacer

    // Headers
    const headerRow = ws.addRow(this.HEADERS);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4763B1' } };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF4763B1' } } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    headerRow.height = 28;

    // Data rows
    this.buildExportRows().forEach((r, i) => {
      const row = ws.addRow(r);
      const fill = i % 2 === 0 ? 'FFFAFAFA' : 'FFF5F7FF';
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      });
      // Colorear columna Revisado
      const revisadoCell = row.getCell(11);
      const isRevisado = r[10] === 'Revisado';
      revisadoCell.font = { bold: true, color: { argb: isRevisado ? 'FF0D9488' : 'FFB45309' } };
    });

    // Fila total
    ws.addRow([]);
    const totalRow = ws.addRow(['', '', '', '', '', '', '', '', 'TOTAL', this.totalMonto.toFixed(2), '']);
    totalRow.eachCell(cell => { cell.font = { bold: true }; });
    totalRow.getCell(9).alignment = { horizontal: 'right' };

    // Anchos de columna
    ws.columns.forEach((col, i) => {
      const widths = [12, 6, 14, 20, 22, 22, 16, 20, 24, 12, 10];
      col.width = widths[i] ?? 14;
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rendiciones_directas_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportPdf(): void {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' }) as JsPdfAT;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte de Rendiciones Directas', pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const subtitle = [`Generado: ${new Date().toLocaleDateString('es-PE')}`, `Total: ${this.total()} registros`];
    if (this.filterDateFrom || this.filterDateTo) subtitle.push(`Periodo: ${this.filterDateFrom || '...'} - ${this.filterDateTo || '...'}`);
    doc.text(subtitle.join('   |   '), pageWidth / 2, 20, { align: 'center' });

    autoTable(doc, {
      startY: 26,
      head: [this.HEADERS],
      body: this.buildExportRows(),
      styles: { fontSize: 6.5, cellPadding: 2 },
      headStyles: { fillColor: [71, 99, 177], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      columnStyles: {
        0: { cellWidth: 18 }, 1: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 20 },
        3: { cellWidth: 26 }, 4: { cellWidth: 28 }, 5: { cellWidth: 28 },
        6: { cellWidth: 22 }, 7: { cellWidth: 26 }, 8: { cellWidth: 30 },
        9: { cellWidth: 16, halign: 'right' }, 10: { cellWidth: 16, halign: 'center' },
      },
      didDrawPage: (d) => {
        // Página numeración
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(7);
        doc.text(`Pag ${d.pageNumber} de ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      },
    });

    // Fila de totales
    const finalY = doc.lastAutoTable?.finalY ?? 30;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total general: S/ ${this.totalMonto.toFixed(2)}`, pageWidth - 14, finalY + 8, { align: 'right' });

    doc.save(`rendiciones_directas_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  get pageNumbers(): number[] {
    const count = this.pages();
    if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
    const arr: number[] = [1];
    if (this.page > 3) arr.push(-1);
    for (let i = Math.max(2, this.page - 1); i <= Math.min(count - 1, this.page + 1); i++) arr.push(i);
    if (this.page < count - 2) arr.push(-1);
    arr.push(count);
    return arr;
  }
}
