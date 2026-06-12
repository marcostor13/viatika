import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CajaChicaReportService } from '../../../services/caja-chica-report.service';
import { ExpenseReportsService } from '../../../services/expense-reports.service';
import { NotificationService } from '../../../services/notification.service';
import { CajaChicaReportExportService, CajaChicaExportRow } from '../../../services/caja-chica-report-export.service';
import { ICajaChicaReport, ISelectedReport } from '../../../interfaces/caja-chica-report.interface';
import { IExpenseReport } from '../../../interfaces/expense-report.interface';

@Component({
  selector: 'app-rendicion-caja-chica-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rendicion-caja-chica-detalle.component.html',
})
export class RendicionCajaChicaDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(CajaChicaReportService);
  private expenseReportsService = inject(ExpenseReportsService);
  private notifications = inject(NotificationService);
  private exportService = inject(CajaChicaReportExportService);

  report = signal<ICajaChicaReport | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  available = signal<IExpenseReport[]>([]);
  availableLoading = signal(false);
  availableFilter = '';

  selectedToAdd = signal<Set<string>>(new Set());
  adding = signal(false);
  finalizing = signal(false);
  exporting = signal(false);

  get reportId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.findOne(this.reportId).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loading.set(false);
        if (r.status === 'draft') this.loadAvailable();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al cargar el reporte.');
        this.loading.set(false);
      },
    });
  }

  loadAvailable(): void {
    this.availableLoading.set(true);
    this.expenseReportsService.getAllCajaChicaAvailable().subscribe({
      next: (data: any[]) => {
        const report = this.report();
        const includedIds = new Set(
          (report?.selectedReports ?? []).map((sr) =>
            typeof sr.expenseReportId === 'string' ? sr.expenseReportId : (sr.expenseReportId as any)?._id
          )
        );
        this.available.set(data.filter((r: IExpenseReport) => !includedIds.has(r._id)));
        this.availableLoading.set(false);
      },
      error: () => { this.availableLoading.set(false); },
    });
  }

  filteredAvailable(): IExpenseReport[] {
    const f = this.availableFilter.toLowerCase().trim();
    if (!f) return this.available();
    return this.available().filter((r) => {
      const u = r.userId;
      const userName = typeof u === 'object'
        ? [u?.firstName ?? u?.name ?? '', u?.lastName ?? ''].join(' ')
        : '';
      return (userName + ' ' + (r.title ?? '')).toLowerCase().includes(f);
    });
  }

  toggleSelect(id: string): void {
    const s = new Set(this.selectedToAdd());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.selectedToAdd.set(s);
  }

  isSelected(id: string): boolean {
    return this.selectedToAdd().has(id);
  }

  addSelected(): void {
    const ids = Array.from(this.selectedToAdd());
    if (!ids.length) return;
    this.adding.set(true);
    this.service.addReports(this.reportId, ids).subscribe({
      next: (updated) => {
        this.report.set(updated);
        this.selectedToAdd.set(new Set());
        this.adding.set(false);
        this.loadAvailable();
        this.notifications.show(`${ids.length} rendicion(es) agregada(s).`, 'success');
      },
      error: (err) => {
        this.adding.set(false);
        const msg = err?.error?.message ?? 'Error al agregar rendiciones.';
        this.notifications.show(Array.isArray(msg) ? msg.join(', ') : msg, 'error');
      },
    });
  }

  removeReport(expenseReportId: string): void {
    this.service.removeReport(this.reportId, expenseReportId).subscribe({
      next: (updated) => {
        this.report.set(updated);
        this.loadAvailable();
        this.notifications.show('Rendicion eliminada del reporte.', 'success');
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Error al eliminar la rendicion.';
        this.notifications.show(Array.isArray(msg) ? msg.join(', ') : msg, 'error');
      },
    });
  }

  finalize(): void {
    if (!confirm('Al finalizar, no podras agregar ni quitar rendiciones. Continuar?')) return;
    this.finalizing.set(true);
    this.service.finalize(this.reportId).subscribe({
      next: (updated) => {
        this.report.set(updated);
        this.finalizing.set(false);
        this.notifications.show('Reporte finalizado.', 'success');
      },
      error: (err) => {
        this.finalizing.set(false);
        const msg = err?.error?.message ?? 'Error al finalizar el reporte.';
        this.notifications.show(Array.isArray(msg) ? msg.join(', ') : msg, 'error');
      },
    });
  }

  exportPdf(): void {
    const r = this.report();
    if (!r) return;
    this.exportService.exportPdf(r, this.buildRows(r));
  }

  async exportExcel(): Promise<void> {
    const r = this.report();
    if (!r) return;
    this.exporting.set(true);
    try {
      await this.exportService.exportExcel(r, this.buildRows(r));
    } finally {
      this.exporting.set(false);
    }
  }

  private buildRows(report: ICajaChicaReport): CajaChicaExportRow[] {
    const rows: CajaChicaExportRow[] = [];
    for (const sr of report.selectedReports) {
      const er: any = sr.expenseReport ?? (typeof sr.expenseReportId === 'object' ? sr.expenseReportId : null);
      const expenses: any[] = er?.expenseIds ?? [];
      for (const inv of expenses) {
        rows.push({
          colaborador: sr.colaboradorName,
          tipo: this.expenseTypeLabel(inv.expenseType ?? ''),
          fecha: inv.fecha ? new Date(inv.fecha).toLocaleDateString('es-PE') : '-',
          proveedor: inv.proveedor ?? inv.provider ?? '-',
          descripcion: inv.descripcion ?? inv.description ?? '-',
          monto: inv.amount ?? 0,
        });
      }
    }
    return rows;
  }

  getExpenseReportId(sr: ISelectedReport): string {
    return typeof sr.expenseReportId === 'string' ? sr.expenseReportId : (sr.expenseReportId as any)?._id ?? '';
  }

  getExpenseReport(sr: ISelectedReport): any {
    return sr.expenseReport ?? (typeof sr.expenseReportId === 'object' ? sr.expenseReportId : null);
  }

  getColaboradorDisplay(r: IExpenseReport): string {
    const u = r.userId;
    if (!u || typeof u === 'string') return 'Colaborador';
    return [u.firstName ?? u.name ?? '', u.lastName ?? ''].join(' ').trim() || 'Colaborador';
  }

  expenseTypeLabel(type: string): string {
    const map: Record<string, string> = {
      factura: 'Factura',
      planilla_movilidad: 'Plan. Movilidad',
      recibo_caja: 'Recibo de Caja',
      otros_gastos: 'Otros Gastos',
    };
    return map[type] ?? type ?? '-';
  }

  statusLabel(status: string): string {
    return status === 'finalized' ? 'Finalizado' : 'Borrador';
  }

  statusClasses(status: string): string {
    return status === 'finalized'
      ? 'bg-green-100 text-green-700'
      : 'bg-yellow-100 text-yellow-700';
  }

  availItemClass(id: string): string {
    const base = 'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ';
    return this.isSelected(id) ? base + 'border-primary bg-blue-50' : base + 'border-gray-200';
  }

  expenseSubtotal(expenses: any[]): number {
    return (expenses ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
  }

  goBack(): void {
    this.router.navigate(['/rendiciones-caja-chica']);
  }
}
