import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseReportsService } from '../../services/expense-reports.service';
import { UserStateService } from '../../services/user-state.service';
import { NotificationService } from '../../services/notification.service';
import { IExpenseReport } from '../../interfaces/expense-report.interface';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CreateRendicionModalComponent } from '../admin-users/user-details/create-rendicion-modal/create-rendicion-modal.component';
import { AdvanceService } from '../../services/advance.service';
import {
  IAdvance,
  ADVANCE_STATUS_LABELS,
  ADVANCE_STATUS_COLORS,
} from '../../interfaces/advance.interface';

@Component({
  selector: 'app-mis-rendiciones',
  standalone: true,
  imports: [CommonModule, RouterModule, CreateRendicionModalComponent],
  templateUrl: './mis-rendiciones.component.html',
  styleUrls: ['./mis-rendiciones.component.scss']
})
export class MisRendicionesComponent implements OnInit {
  private expenseReportsService = inject(ExpenseReportsService);
  private userStateService = inject(UserStateService);
  private advanceService = inject(AdvanceService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  expenseReports: IExpenseReport[] = [];
  myAdvances: IAdvance[] = [];
  isLoading = true;
  showCreateModal = false;
  showGuidelines = signal(false);

  readonly ADVANCE_STATUS_LABELS = ADVANCE_STATUS_LABELS;
  readonly ADVANCE_STATUS_COLORS = ADVANCE_STATUS_COLORS;

  toggleGuidelines() {
    this.showGuidelines.update(v => !v);
  }

  get currentUserId(): string {
    return (this.userStateService.getUser() as any)?._id ?? '';
  }

  get canCreateRendicion(): boolean {
    return this.userStateService.canCreateRendicion();
  }

  ngOnInit(): void {
    this.loadMyReports();
    this.loadMyAdvances();
  }

  loadMyAdvances() {
    const user = this.userStateService.getUser() as Record<string, unknown> | null;
    const clientId =
      (user?.['companyId'] as string) ||
      ((user?.['client'] as { _id?: string })?._id ?? '') ||
      ((user?.['clientId'] as { _id?: string })?._id ?? '') ||
      (typeof user?.['clientId'] === 'string' ? (user['clientId'] as string) : '');
    if (!user?.['_id'] || !clientId) return;
    this.advanceService.findMy().subscribe({
      next: (list) => {
        this.myAdvances = list ?? [];
        this.maybeOpenAdvanceFromEmailLink();
      },
      error: () => {
        this.myAdvances = [];
      },
    });
  }

  loadMyReports() {
    this.isLoading = true;
    const user = this.userStateService.getUser() as any;

    if (user && user._id) {
      const clientId = user.companyId || (user.client?._id) || (user.clientId?._id) || user.clientId;

      if (clientId) {
        this.expenseReportsService.findAllByUser(user._id, clientId).subscribe({
          next: (reports) => {
            this.expenseReports = reports;
            this.isLoading = false;
          },
          error: (err) => {
            console.error('Error loading reports', err);
            this.isLoading = false;
          }
        });
      } else {
        console.warn('No clientId found for user');
        this.isLoading = false;
      }
    } else {
      this.isLoading = false;
    }
  }

  openCreateModal() {
    this.showCreateModal = true;
  }

  openNuevaRendicion() {
    this.router.navigate(['/mis-rendiciones/nueva']);
  }

  openViaticosModal() {
    this.router.navigate(['/mis-rendiciones/solicitud-viaticos/nueva']);
  }

  openResubmitAdvance(advance: IAdvance) {
    this.router.navigate(['/mis-rendiciones/solicitud-viaticos', advance._id, 'editar']);
  }

  /** Deep link desde correo de rechazo (Fase 3): ?viaticoAdvanceId= */
  private maybeOpenAdvanceFromEmailLink(): void {
    const id =
      this.route.snapshot.queryParamMap.get('viaticoAdvanceId')?.trim();
    if (!id) return;
    const adv = this.myAdvances.find((a) => a._id === id);
    if (adv && (adv.status === 'rejected' || adv.status === 'pending_l1')) {
      void this.router.navigate(['/mis-rendiciones/solicitud-viaticos', adv._id, 'editar']);
    } else {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { viaticoAdvanceId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  advanceProjectLabel(adv: IAdvance): string {
    const p = adv.projectId;
    if (p && typeof p === 'object' && 'name' in p) {
      const code = (p as { code?: string }).code;
      return code ? `${code} — ${(p as { name: string }).name}` : (p as { name: string }).name;
    }
    return 'Centro de costo';
  }

  advanceDateRange(adv: IAdvance): string {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
    if (adv.startDate && adv.endDate) return `${fmt(adv.startDate)} al ${fmt(adv.endDate)}`;
    if (adv.startDate) return fmt(adv.startDate);
    return '';
  }

  getTotalGastado(report: IExpenseReport): number {
    if (!report.expenseIds?.length) return 0;
    return report.expenseIds.reduce((sum: number, e: any) => sum + (parseFloat(e.total) || 0), 0);
  }

  getSaldoLibre(report: IExpenseReport): number {
    return (report.budget ?? 0) - this.getTotalGastado(report);
  }

  advanceStatusText(adv: IAdvance): string {
    if (adv.status === 'paid') return 'En Progreso - Registrando Gastos';
    return this.ADVANCE_STATUS_LABELS[adv.status];
  }

  hasExpenseReportLink(adv: IAdvance): boolean {
    return !!this.getExpenseReportId(adv);
  }

  get pendingAdvances(): IAdvance[] {
    return this.myAdvances.filter(adv => !this.hasExpenseReportLink(adv));
  }

  getExpenseReportId(adv: IAdvance): string | null {
    if (!adv.expenseReportId) return null;
    if (typeof adv.expenseReportId === 'object' && '_id' in adv.expenseReportId) {
      return (adv.expenseReportId as { _id: string })._id;
    }
    if (typeof adv.expenseReportId === 'string' && adv.expenseReportId) {
      return adv.expenseReportId;
    }
    return null;
  }

  navigateToAdvanceReport(adv: IAdvance): void {
    const reportId = this.getExpenseReportId(adv);
    if (reportId) {
      this.router.navigate(['/mis-rendiciones', reportId, 'detalle']);
    }
  }

  onModalClose(success: boolean) {
    this.showCreateModal = false;
    if (success) {
      this.loadMyReports();
    }
  }

  // ─── Cancelar / Eliminar rendición solicitada ────────────────────────────────

  showCancelReportModal = signal(false);
  cancellingReport = signal<IExpenseReport | null>(null);
  isCancellingReport = signal(false);
  cancelReportReason = signal('');

  openCancelReportModal(report: IExpenseReport, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cancellingReport.set(report);
    this.cancelReportReason.set('');
    this.showCancelReportModal.set(true);
  }

  confirmCancelReport(): void {
    const report = this.cancellingReport();
    if (!report) return;
    this.isCancellingReport.set(true);
    this.expenseReportsService
      .cancelRendicion(report._id, this.cancelReportReason().trim() || undefined)
      .subscribe({
        next: () => {
          this.isCancellingReport.set(false);
          this.showCancelReportModal.set(false);
          this.cancellingReport.set(null);
          this.notificationService.show('Rendicion cancelada correctamente', 'success');
          this.loadMyReports();
        },
        error: (err) => {
          this.isCancellingReport.set(false);
          const raw = err?.error?.message;
          const msg = Array.isArray(raw) ? raw.join(', ') : raw;
          this.notificationService.show(msg || 'Error al cancelar', 'error');
        },
      });
  }

  goToReportDetail(report: IExpenseReport, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/mis-rendiciones', report._id, 'detalle']);
  }

  // ─── Cancelar / Eliminar solicitud de viáticos pendiente ─────────────────────

  showCancelAdvanceModal = signal(false);
  cancellingAdvance = signal<IAdvance | null>(null);
  isCancellingAdvance = signal(false);

  openCancelAdvanceModal(adv: IAdvance): void {
    this.cancellingAdvance.set(adv);
    this.showCancelAdvanceModal.set(true);
  }

  confirmCancelAdvance(): void {
    const adv = this.cancellingAdvance();
    if (!adv) return;
    this.isCancellingAdvance.set(true);
    this.advanceService.cancelAdvance(adv._id).subscribe({
      next: () => {
        this.isCancellingAdvance.set(false);
        this.showCancelAdvanceModal.set(false);
        this.cancellingAdvance.set(null);
        this.notificationService.show('Solicitud cancelada correctamente', 'success');
        this.loadMyAdvances();
      },
      error: (err) => {
        this.isCancellingAdvance.set(false);
        const raw = err?.error?.message;
        const msg = Array.isArray(raw) ? raw.join(', ') : raw;
        this.notificationService.show(msg || 'Error al cancelar', 'error');
      },
    });
  }

  isReportInProgress(report: IExpenseReport): boolean {
    if (report.status !== 'open') return false;
    return this.myAdvances.some(adv => {
      const rid =
        adv.expenseReportId && typeof adv.expenseReportId === 'object'
          ? adv.expenseReportId._id
          : null;
      return rid === report._id && (adv.status === 'paid' || adv.status === 'settled');
    });
  }

  reportDateRange(report: IExpenseReport): string {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
    if (report.startDate && report.endDate) return `${fmt(report.startDate)} al ${fmt(report.endDate)}`;
    if (report.startDate) return fmt(report.startDate);
    return '';
  }

  panelStatusText(report: IExpenseReport): string {
    if (this.isReportInProgress(report)) return 'EN PROGRESO - REGISTRANDO GASTOS';
    const map: Partial<Record<IExpenseReport['status'], string>> = {
      solicited: 'SOLICITADA',
      open: 'ABIERTA',
      submitted: 'ENVIADA',
      pending_accounting: 'PENDIENTE CONTABILIDAD',
      approved: 'APROBADA',
      rejected: 'RECHAZADA',
      reimbursed: 'REEMBOLSADO',
      closed: 'CERRADA',
      cancelled: 'CANCELADA',
    };
    return map[report.status] ?? report.status.toUpperCase();
  }
}
