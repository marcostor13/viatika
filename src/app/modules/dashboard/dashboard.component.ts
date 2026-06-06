import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  DashboardService,
  IDashboardResponse,
  IDashboardKpis,
} from './services/dashboard.service';
import { InvoicesService } from '../invoices/services/invoices.service';
import { AdminUsersService } from '../admin-users/services/admin-users.service';
import { IProject } from '../invoices/interfaces/project.interface';
import { ICategory } from '../invoices/interfaces/category.interface';
import { IUserResponse } from '../../interfaces/user.interface';
import { NotificationService } from '../../services/notification.service';

declare var Chart: any;

const EMPTY_KPIS: IDashboardKpis = {
  totalGasto: 0,
  gastoCount: 0,
  ticketPromedio: 0,
  totalGastoPrev: 0,
  totalGastoDeltaPct: 0,
  gastoApprovedAmount: 0,
  gastoPendingAmount: 0,
  gastoPendingCount: 0,
  gastoRejectedAmount: 0,
  tasaAprobacionGastos: 0,
  anticipoSolicitado: 0,
  anticipoSolicitadoCount: 0,
  anticipoAprobadoAmount: 0,
  anticipoPagadoAmount: 0,
  anticipoPendienteAprobAmount: 0,
  anticipoPendienteAprobCount: 0,
  devolucionesPendientesAmount: 0,
  devolucionesPendientesCount: 0,
  rendicionesTotal: 0,
  rendicionesPendientes: 0,
  rendicionesAprobadas: 0,
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('monthlyChart') monthlyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart') categoryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('projectChart') projectChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusChart') statusChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('advanceChart') advanceChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('collaboratorChart')
  collaboratorChartRef!: ElementRef<HTMLCanvasElement>;

  private dashboardService = inject(DashboardService);
  private invoicesService = inject(InvoicesService);
  private adminUsersService = inject(AdminUsersService);
  private notificationService = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  loading = signal(true);
  data = signal<IDashboardResponse | null>(null);
  kpis = signal<IDashboardKpis>(EMPTY_KPIS);
  /** Valores con animación de conteo para las tarjetas KPI. */
  animated = signal<IDashboardKpis>(EMPTY_KPIS);

  projects: IProject[] = [];
  categories: ICategory[] = [];
  collaborators: { id: string; name: string }[] = [];

  filterDateFrom = signal(this.defaultStartDate());
  filterDateTo = signal(this.defaultEndDate());
  filterProject = signal('');
  filterCategory = signal('');
  filterCollaborator = signal('');

  activeFilterCount = computed(
    () =>
      [
        this.filterProject(),
        this.filterCategory(),
        this.filterCollaborator(),
      ].filter((v) => !!v).length
  );

  private chartLibraryLoaded = false;
  private charts: Record<string, any> = {};
  private tweenHandles: Record<string, number> = {};

  readonly palette = [
    '#D31212',
    '#3B82F6',
    '#05CD99',
    '#FFB547',
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
    '#9B1B22',
    '#F59E0B',
    '#6366F1',
  ];

  private readonly statusColorMap: Record<string, string> = {
    approved: '#05CD99',
    sunat_valid: '#05CD99',
    paid: '#3B82F6',
    settled: '#14B8A6',
    pending: '#FFB547',
    pending_l1: '#FFB547',
    pending_l2: '#F59E0B',
    sunat_valid_not_ours: '#FCD34D',
    sunat_not_found: '#9CA3AF',
    rejected: '#D31212',
    sunat_error: '#D31212',
    returned: '#8B5CF6',
    cancelled: '#9CA3AF',
    draft: '#CBD5E1',
    // Estados de rendición (expense-report)
    solicited: '#6366F1',
    open: '#94A3B8',
    submitted: '#3B82F6',
    pending_accounting: '#F59E0B',
    reimbursed: '#10B981',
    closed: '#0EA5E9',
  };

  private readonly expenseStatusLabels: Record<string, string> = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    sunat_valid: 'Válida SUNAT',
    sunat_valid_not_ours: 'Válida externa',
    sunat_not_found: 'No encontrada',
    sunat_error: 'Error SUNAT',
  };

  private readonly advanceStatusLabels: Record<string, string> = {
    draft: 'Borrador',
    pending_l1: 'Pend. Nivel 1',
    pending_l2: 'Pend. Nivel 2',
    approved: 'Aprobado',
    paid: 'Pagado',
    settled: 'Liquidado',
    rejected: 'Rechazado',
    returned: 'Devuelto',
    cancelled: 'Cancelado',
  };

  private readonly reportStatusLabels: Record<string, string> = {
    solicited: 'Solicitada',
    open: 'Abierta',
    submitted: 'Enviada',
    pending_accounting: 'Pend. contabilidad',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    reimbursed: 'Reembolsada',
    closed: 'Cerrada',
    cancelled: 'Cancelada',
  };

  private readonly expenseTypeLabels: Record<string, string> = {
    factura: 'Factura',
    planilla_movilidad: 'Movilidad',
    otros_gastos: 'Otros gastos',
    recibo_caja: 'Recibo de caja',
    comprobante_caja: 'Comprobante de caja',
  };

  ngOnInit() {
    this.loadFilterSources();
    this.loadChartLibrary();
    this.loadDashboard();
  }

  ngAfterViewInit() {
    this.tryRenderCharts();
  }

  ngOnDestroy() {
    Object.values(this.tweenHandles).forEach((h) => cancelAnimationFrame(h));
    Object.values(this.charts).forEach((c) => c?.destroy?.());
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  loadFilterSources() {
    forkJoin([
      this.invoicesService.getProjects().pipe(catchError(() => of([]))),
      this.invoicesService.getCategories().pipe(catchError(() => of([]))),
      this.adminUsersService.getUsers().pipe(catchError(() => of([]))),
    ]).subscribe(([projects, categories, users]) => {
      this.projects = (projects as IProject[]) || [];
      this.categories = (categories as ICategory[]) || [];
      this.collaborators = ((users as IUserResponse[]) || [])
        .map((u) => ({ id: u._id || '', name: u.name || u.email || 'Sin nombre' }))
        .filter((u) => !!u.id);
    });
  }

  loadDashboard() {
    this.loading.set(true);
    this.dashboardService
      .getDashboard({
        dateFrom: this.filterDateFrom(),
        dateTo: this.filterDateTo(),
        projectId: this.filterProject(),
        categoryId: this.filterCategory(),
        collaboratorId: this.filterCollaborator(),
      })
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.kpis.set(res.kpis);
          this.loading.set(false);
          this.animateKpis(res.kpis);
          this.cdr.detectChanges();
          this.tryRenderCharts();
        },
        error: (err) => {
          this.loading.set(false);
          this.notificationService.show(
            'Error al cargar el dashboard: ' + (err?.message || ''),
            'error'
          );
        },
      });
  }

  onFilterChange() {
    this.loadDashboard();
  }

  clearFilters() {
    this.filterProject.set('');
    this.filterCategory.set('');
    this.filterCollaborator.set('');
    this.filterDateFrom.set(this.defaultStartDate());
    this.filterDateTo.set(this.defaultEndDate());
    this.loadDashboard();
  }

  // ─── KPI counter animation ────────────────────────────────────────────────

  private animateKpis(target: IDashboardKpis) {
    const start = { ...EMPTY_KPIS };
    const keys = Object.keys(target) as (keyof IDashboardKpis)[];
    const duration = 700;
    let startTime: number | null = null;

    if (this.tweenHandles['kpis']) {
      cancelAnimationFrame(this.tweenHandles['kpis']);
    }

    const step = (ts: number) => {
      if (startTime === null) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current: any = {};
      keys.forEach((k) => {
        current[k] = start[k] + (target[k] - start[k]) * eased;
      });
      this.animated.set(current as IDashboardKpis);
      if (progress < 1) {
        this.tweenHandles['kpis'] = requestAnimationFrame(step);
      } else {
        this.animated.set(target);
      }
    };
    this.tweenHandles['kpis'] = requestAnimationFrame(step);
  }

  // ─── Charts ────────────────────────────────────────────────────────────────

  private loadChartLibrary() {
    if (typeof Chart !== 'undefined') {
      this.chartLibraryLoaded = true;
      this.tryRenderCharts();
      return;
    }
    const existing = document.getElementById('chartjs-cdn');
    if (existing) {
      existing.addEventListener('load', () => {
        this.chartLibraryLoaded = true;
        this.tryRenderCharts();
      });
      return;
    }
    const script = document.createElement('script');
    script.id = 'chartjs-cdn';
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => {
      this.chartLibraryLoaded = true;
      this.tryRenderCharts();
    };
    document.body.appendChild(script);
  }

  private tryRenderCharts() {
    if (
      !this.chartLibraryLoaded ||
      typeof Chart === 'undefined' ||
      !this.data() ||
      !this.monthlyChartRef
    ) {
      return;
    }
    this.renderMonthlyChart();
    this.renderCategoryChart();
    this.renderProjectChart();
    this.renderStatusChart();
    this.renderAdvanceChart();
    this.renderCollaboratorChart();
  }

  private baseAnimation() {
    return { duration: 900, easing: 'easeOutQuart' };
  }

  private destroyChart(key: string) {
    if (this.charts[key]) {
      this.charts[key].destroy();
      this.charts[key] = null;
    }
  }

  private renderMonthlyChart() {
    const ref = this.monthlyChartRef?.nativeElement;
    if (!ref) return;
    this.destroyChart('monthly');
    const series = this.data()!.monthlySeries;
    const labels = series.map((s) => this.formatMonthLabel(s.month));

    this.charts['monthly'] = new Chart(ref, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Gasto',
            data: series.map((s) => s.gasto),
            backgroundColor: 'rgba(211, 18, 18, 0.85)',
            borderRadius: 6,
            order: 2,
          },
          {
            label: 'Anticipos',
            type: 'line',
            data: series.map((s) => s.anticipo),
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: '#3B82F6',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: this.baseAnimation(),
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx: any) =>
                `${ctx.dataset.label}: ${this.formatCurrency(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v: any) => this.formatCompact(v) },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          x: { grid: { display: false } },
        },
      },
    });
  }

  private renderCategoryChart() {
    const ref = this.categoryChartRef?.nativeElement;
    if (!ref) return;
    this.destroyChart('category');
    const rows = this.data()!.topCategories;
    this.charts['category'] = new Chart(ref, {
      type: 'doughnut',
      data: {
        labels: rows.map((r) => r.name),
        datasets: [
          {
            data: rows.map((r) => r.amount),
            backgroundColor: this.palette.slice(0, rows.length),
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        animation: { ...this.baseAnimation(), animateRotate: true },
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx: any) =>
                `${ctx.label}: ${this.formatCurrency(ctx.parsed)}`,
            },
          },
        },
      },
    });
  }

  private renderProjectChart() {
    const ref = this.projectChartRef?.nativeElement;
    if (!ref) return;
    this.destroyChart('project');
    const rows = this.data()!.topProjects;
    this.charts['project'] = new Chart(ref, {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.name),
        datasets: [
          {
            label: 'Gasto',
            data: rows.map((r) => r.amount),
            backgroundColor: rows.map(
              (_, i) => this.palette[i % this.palette.length]
            ),
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: this.baseAnimation(),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => this.formatCurrency(ctx.parsed.x),
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { callback: (v: any) => this.formatCompact(v) },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          y: { grid: { display: false } },
        },
      },
    });
  }

  private renderStatusChart() {
    const ref = this.statusChartRef?.nativeElement;
    if (!ref) return;
    this.destroyChart('status');
    const rows = this.data()!.expenseByStatus;
    this.charts['status'] = new Chart(ref, {
      type: 'doughnut',
      data: {
        labels: rows.map((r) => this.expenseStatusLabel(r.status)),
        datasets: [
          {
            data: rows.map((r) => r.amount),
            backgroundColor: rows.map(
              (r) => this.statusColorMap[r.status] || '#9CA3AF'
            ),
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        animation: { ...this.baseAnimation(), animateRotate: true },
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx: any) =>
                `${ctx.label}: ${this.formatCurrency(ctx.parsed)}`,
            },
          },
        },
      },
    });
  }

  private renderAdvanceChart() {
    const ref = this.advanceChartRef?.nativeElement;
    if (!ref) return;
    this.destroyChart('advance');
    const rows = this.data()!.advanceByStatus;
    this.charts['advance'] = new Chart(ref, {
      type: 'bar',
      data: {
        labels: rows.map((r) => this.advanceStatusLabel(r.status)),
        datasets: [
          {
            label: 'Monto',
            data: rows.map((r) => r.amount),
            backgroundColor: rows.map(
              (r) => this.statusColorMap[r.status] || '#9CA3AF'
            ),
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: this.baseAnimation(),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) =>
                `${this.formatCurrency(ctx.parsed.y)} · ${
                  rows[ctx.dataIndex]?.count ?? 0
                } anticipos`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v: any) => this.formatCompact(v) },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          x: { grid: { display: false } },
        },
      },
    });
  }

  private renderCollaboratorChart() {
    const ref = this.collaboratorChartRef?.nativeElement;
    if (!ref) return;
    this.destroyChart('collaborator');
    const rows = this.data()!.topCollaborators;
    this.charts['collaborator'] = new Chart(ref, {
      type: 'bar',
      data: {
        labels: rows.map((r) =>
          r.name.length > 22 ? r.name.slice(0, 22) + '…' : r.name
        ),
        datasets: [
          {
            label: 'Consumo',
            data: rows.map((r) => r.amount),
            backgroundColor: '#3B82F6',
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: this.baseAnimation(),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => this.formatCurrency(ctx.parsed.x),
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { callback: (v: any) => this.formatCompact(v) },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          y: { grid: { display: false } },
        },
      },
    });
  }

  // ─── Template helpers ──────────────────────────────────────────────────────

  hasData(): boolean {
    return !!this.data() && this.kpis().gastoCount > 0;
  }

  expenseStatusLabel(status: string): string {
    return this.expenseStatusLabels[status] || status;
  }

  advanceStatusLabel(status: string): string {
    return this.advanceStatusLabels[status] || status;
  }

  reportStatusLabel(status: string): string {
    return this.reportStatusLabels[status] || status;
  }

  expenseTypeLabel(type: string): string {
    return this.expenseTypeLabels[type] || type;
  }

  statusColor(status: string): string {
    return this.statusColorMap[status] || '#9CA3AF';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      maximumFractionDigits: 2,
    }).format(value || 0);
  }

  formatCompact(value: number): string {
    const v = value || 0;
    if (Math.abs(v) >= 1000) {
      return 'S/ ' + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k';
    }
    return 'S/ ' + v.toFixed(0);
  }

  formatInt(value: number): string {
    return Math.round(value || 0).toLocaleString('es-PE');
  }

  formatPct(value: number): string {
    return (value || 0).toFixed(1) + '%';
  }

  private formatMonthLabel(monthKey: string): string {
    const [year, month] = monthKey.split('-');
    const names = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
    ];
    const idx = parseInt(month, 10) - 1;
    return `${names[idx] ?? month} ${year?.slice(2) ?? ''}`;
  }

  private defaultStartDate(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return this.toInputDate(d);
  }

  private defaultEndDate(): string {
    return this.toInputDate(new Date());
  }

  private toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
