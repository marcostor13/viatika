import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpenseReportsService } from '../../../services/expense-reports.service';
import { AdvanceService } from '../../../services/advance.service';
import { NotificationService } from '../../../services/notification.service';
import { UserStateService } from '../../../services/user-state.service';
import { InvoicesService } from '../../invoices/services/invoices.service';
import { IExpenseReport } from '../../../interfaces/expense-report.interface';
import { IAdvance, ADVANCE_STATUS_LABELS, ADVANCE_STATUS_COLORS } from '../../../interfaces/advance.interface';
import { ButtonComponent } from '../../../design-system/button/button.component';
import {
  RendicionExportService,
  RendicionExportData,
} from '../../../services/rendicion-export.service';

@Component({
  selector: 'app-rendicion-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ButtonComponent],
  templateUrl: './rendicion-detail.component.html',
  styleUrls: ['./rendicion-detail.component.scss']
})
export class RendicionDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private expenseReportsService = inject(ExpenseReportsService);
  private advanceService = inject(AdvanceService);
  private notificationService = inject(NotificationService);
  private userStateService = inject(UserStateService);
  private invoicesService = inject(InvoicesService);
  private rendicionExportService = inject(RendicionExportService);
  private fb = inject(FormBuilder);

  id: string = this.route.snapshot.params['id'];
  report: IExpenseReport | null = null;
  isLoading = true;
  advances: IAdvance[] = [];
  showAdvanceModal = false;
  isRequestingAdvance = signal(false);
  advanceForm!: FormGroup;

  readonly ADVANCE_STATUS_LABELS = ADVANCE_STATUS_LABELS;
  readonly ADVANCE_STATUS_COLORS = ADVANCE_STATUS_COLORS;

  totalGastado = 0;

  get saldoLibre(): number {
    return (this.report?.budget ?? 0) + this.totalAnticipado - this.totalGastado;
  }

  ngOnInit(): void {
    this.advanceForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      description: ['', Validators.required],
    });
    if (this.id) {
      this.loadReport();
      this.loadAdvances();
    }
  }

  loadAdvances() {
    this.advanceService.findMy().subscribe({
      next: (advances) => {
        this.advances = advances.filter(a => {
          const rid = typeof a.expenseReportId === 'object' ? a.expenseReportId?._id : a.expenseReportId;
          return rid === this.id;
        });
      },
      error: () => {},
    });
  }

  get totalAnticipado(): number {
    return this.advances
      .filter(a => ['approved', 'paid', 'settled'].includes(a.status))
      .reduce((sum, a) => sum + a.amount, 0);
  }

  get settlement(): any {
    return (this.report as any)?.settlement;
  }

  openAdvanceModal() {
    this.advanceForm.reset();
    this.showAdvanceModal = true;
  }

  submitAdvance() {
    if (this.advanceForm.invalid) return;
    this.isRequestingAdvance.set(true);
    this.advanceService.create({
      ...this.advanceForm.value,
      expenseReportId: this.id,
    }).subscribe({
      next: () => {
        this.notificationService.show('Solicitud de anticipo enviada correctamente', 'success');
        this.showAdvanceModal = false;
        this.loadAdvances();
        this.isRequestingAdvance.set(false);
      },
      error: (e) => {
        this.notificationService.show(e.error?.message || 'Error al solicitar anticipo', 'error');
        this.isRequestingAdvance.set(false);
      },
    });
  }

  loadReport() {
    this.isLoading = true;
    this.expenseReportsService.findOne(this.id).subscribe({
      next: (data) => {
        this.report = data;
        this.calculateTotals();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching report detail', err);
        this.isLoading = false;
      }
    });
  }

  calculateTotals() {
    if (!this.report) return;

    // TODO: in a real scenario we'd query the Expense objects to sum their 'montos'.
    // Here we'll map the populated expenseIds if they contain the real amounts,
    // or simulate if the backend just returns IDs.
    this.totalGastado = 0;
    
    // For now, assume expenseIds returns full objects due to mongoose populate
    if (this.report.expenseIds && this.report.expenseIds.length > 0) {
      this.totalGastado = this.report.expenseIds.reduce((sum, exp: any) => sum + (exp.total || 0), 0);
    }
    
  }

  goBack() {
    this.router.navigate(['/mis-rendiciones']);
  }

  submitReport() {
    this.expenseReportsService.update(this.id, { status: 'submitted' }).subscribe({
      next: (res) => {
        this.report = res;
        this.calculateTotals();
        // Maybe show notification
      }
    });
  }

  // Admin approval / rejection
  showAdminApproveModal = signal(false);
  isApprovingReport = signal(false);
  showAdminRejectModal = signal(false);
  adminRejectionReason = signal('');

  get isAdminView(): boolean {
    return this.userStateService.isAdmin() || this.userStateService.isSuperAdmin();
  }

  /** Colaborador puede agregar gastos y enviar (abierta o rechazada para corrección). */
  get collaboratorCanEdit(): boolean {
    if (!this.report || this.isAdminView) return false;
    return this.report.status === 'open' || this.report.status === 'rejected';
  }

  openAdminApproveModal(): void {
    this.showAdminApproveModal.set(true);
  }

  closeAdminApproveModal(): void {
    if (this.isApprovingReport()) return;
    this.showAdminApproveModal.set(false);
  }

  confirmApproveReport(): void {
    this.isApprovingReport.set(true);
    this.expenseReportsService.update(this.id, { status: 'approved' }).subscribe({
      next: (res) => {
        this.report = res;
        this.calculateTotals();
        this.showAdminApproveModal.set(false);
        this.isApprovingReport.set(false);
        this.notificationService.show('Rendición aprobada correctamente', 'success');
      },
      error: () => {
        this.isApprovingReport.set(false);
        this.notificationService.show('Error al aprobar la rendición', 'error');
      },
    });
  }

  openAdminRejectModal() {
    this.adminRejectionReason.set('');
    this.showAdminRejectModal.set(true);
  }

  submitAdminRejection() {
    if (!this.adminRejectionReason()) {
      this.notificationService.show('Debe ingresar un motivo de rechazo', 'error');
      return;
    }
    this.expenseReportsService
      .update(this.id, {
        status: 'rejected',
        rejectionReason: this.adminRejectionReason().trim(),
      })
      .subscribe({
      next: (res) => {
        this.report = res;
        this.showAdminRejectModal.set(false);
        this.notificationService.show('Rendición rechazada', 'success');
      },
      error: (err) => {
        const raw = err?.error?.message;
        const msg = Array.isArray(raw) ? raw.join(', ') : raw;
        this.notificationService.show(
          msg || 'Error al rechazar la rendición',
          'error'
        );
      },
    });
  }

  showTypeModal = false;
  showSubmitModal = false;
  isSubmitting = signal(false);
  deletingExpenseId = signal<string | null>(null);
  isExportingExcel = signal(false);
  isExportingPdf = signal(false);

  openSubmitModal() {
    this.showSubmitModal = true;
  }

  closeSubmitModal() {
    this.showSubmitModal = false;
  }

  confirmSubmitReport() {
    const wasRejected = this.report?.status === 'rejected';
    this.isSubmitting.set(true);
    this.expenseReportsService.update(this.id, { status: 'submitted' }).subscribe({
      next: (res) => {
        this.report = res;
        this.calculateTotals();
        this.showSubmitModal = false;
        this.isSubmitting.set(false);
        this.notificationService.show(
          wasRejected
            ? 'Rendición reenviada correctamente'
            : 'Rendición enviada correctamente',
          'success'
        );
      },
      error: () => {
        this.isSubmitting.set(false);
        this.notificationService.show('Error al enviar la rendición', 'error');
      }
    });
  }

  openAddExpenseModal() {
    this.showTypeModal = true;
  }

  closeTypeModal() {
    this.showTypeModal = false;
  }

  selectExpenseType(tipo: string) {
    this.showTypeModal = false;
    this.router.navigate(['/invoices/add'], { queryParams: { rendicionId: this.id, tipo } });
  }

  getExpenseTypeLabel(expense: any): string {
    const type = expense?.expenseType;
    if (type === 'planilla_movilidad') return 'Planilla Movilidad';
    if (type === 'otros_gastos') return 'Otros Gastos';
    return 'Factura';
  }

  getExpenseDate(expense: any): string {
    const type = expense?.expenseType;
    if (type === 'planilla_movilidad') {
      const rows: any[] = expense?.mobilityRows || [];
      if (rows.length === 0) return '-';
      const dates = rows.map((r: any) => r.fecha).filter(Boolean);
      if (dates.length === 0) return '-';
      if (dates.length === 1) return dates[0];
      // If multiple rows, show range
      const sorted = [...dates].sort();
      return sorted[0] === sorted[sorted.length - 1] ? sorted[0] : `${sorted[0]} – ${sorted[sorted.length - 1]}`;
    }
    if (type === 'otros_gastos') {
      const raw = expense?.createdAt;
      if (!raw) return '-';
      const d = new Date(raw);
      if (isNaN(d.getTime())) return '-';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()}`;
    }
    return expense?.fechaEmision || '-';
  }

  getExpenseDescription(expense: any): string {
    const type = expense?.expenseType;
    if (type === 'planilla_movilidad') {
      const rows = expense?.mobilityRows?.length || 0;
      return `${rows} fila${rows !== 1 ? 's' : ''}`;
    }
    if (type === 'otros_gastos') {
      return expense?.description || 'DJ firmada';
    }
    try {
      const data = typeof expense?.data === 'string' ? JSON.parse(expense.data) : expense?.data || {};
      return data.razonSocial || 'N/A';
    } catch { return 'N/A'; }
  }

  parseData(data: string) {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  trackByExpenseId(_index: number, expense: { _id?: string }): string {
    return expense._id ?? `idx-${_index}`;
  }

  /** Solo el colaborador dueño puede editar/eliminar comprobantes pendientes en rendición abierta o rechazada. */
  canMutateOwnExpense(expense: { createdBy?: string; status?: string }): boolean {
    if (!this.collaboratorCanEdit) return false;
    const uid = this.userStateService.getUser()?._id;
    if (!uid) return false;
    if (String(expense.createdBy ?? '') !== String(uid)) return false;
    const st = expense.status ?? 'pending';
    if (st === 'approved' || st === 'rejected') return false;
    return true;
  }

  goEditExpense(expenseId: string): void {
    this.router.navigate(['/invoices/edit', expenseId], {
      queryParams: { rendicionId: this.id },
    });
  }

  getReportStatusLabel(): string {
    if (!this.report) return '';
    const labels: Record<IExpenseReport['status'], string> = {
      open: 'Abierta',
      submitted: 'Enviada',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      closed: 'Cerrada',
    };
    return labels[this.report.status] ?? this.report.status;
  }

  getCollaboratorDisplayName(): string {
    const u = this.report?.userId;
    if (u == null) return '—';
    if (typeof u === 'object' && u !== null && 'name' in u) {
      const name = (u as { name?: string }).name;
      if (name) return name;
    }
    return '—';
  }

  private mapExpenseStatusExport(status?: string): string {
    const s = String(status || 'pending').toLowerCase();
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      sunat_valid: 'Validado SUNAT',
      sunat_valid_not_ours: 'SUNAT (no propio)',
      sunat_not_found: 'SUNAT no encontrado',
      sunat_error: 'Error SUNAT',
    };
    return labels[s] || status || '—';
  }

  private getSettlementForExport(): RendicionExportData['settlement'] | undefined {
    const s = this.settlement as {
      advanceTotal?: number;
      expenseTotal?: number;
      difference?: number;
      type?: string;
    } | null;
    if (!s || typeof s !== 'object') return undefined;
    let typeLabel = 'Diferencia (S/)';
    if (s.type === 'devolucion') typeLabel = 'A devolver (S/)';
    else if (s.type === 'reembolso') typeLabel = 'A reembolsar (S/)';
    const diff = Number(s.difference) || 0;
    const displayAmount = s.type === 'reembolso' ? -diff : diff;
    return {
      advanceTotal: Number(s.advanceTotal) || 0,
      expenseTotal: Number(s.expenseTotal) || 0,
      difference: displayAmount,
      typeLabel,
    };
  }

  buildExportData(): RendicionExportData | null {
    if (!this.report) return null;
    const safeName = (this.report.title || 'rendicion')
      .replace(/[^\w\sáéíóúÁÉÍÓÚñÑ-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);
    const comprobantes = (this.report.expenseIds || []).map((exp: Record<string, unknown>) => ({
      tipo: this.getExpenseTypeLabel(exp),
      fecha: this.getExpenseDate(exp),
      descripcion: this.getExpenseDescription(exp),
      monto: Number(exp['total']) || 0,
      estadoComprobante: this.mapExpenseStatusExport(
        typeof exp['status'] === 'string' ? exp['status'] : undefined,
      ),
    }));
    const anticipos = this.advances.map((a) => ({
      descripcion: a.description,
      monto: a.amount,
      estado: this.ADVANCE_STATUS_LABELS[a.status] ?? a.status,
      fechaSolicitud: a.createdAt
        ? new Date(a.createdAt).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '—',
    }));
    return {
      fileBaseName: `rendicion_${this.id}_${safeName}`.replace(/_+/g, '_'),
      titulo: this.report.title || 'Sin título',
      estado: this.getReportStatusLabel(),
      descripcionRendicion: this.report.description || undefined,
      colaborador: this.getCollaboratorDisplayName(),
      presupuesto: this.report.budget ?? 0,
      totalGastado: this.totalGastado,
      totalAnticipado: this.totalAnticipado,
      saldoLibre: this.saldoLibre,
      fechaGeneracion: new Date().toLocaleString('es-PE', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
      rejectionReason: this.report.rejectionReason,
      comprobantes,
      anticipos,
      settlement: this.getSettlementForExport(),
    };
  }

  async exportRendicionExcel(): Promise<void> {
    const data = this.buildExportData();
    if (!data) {
      this.notificationService.show('No hay datos para exportar', 'error');
      return;
    }
    this.isExportingExcel.set(true);
    try {
      await this.rendicionExportService.exportToExcel(data);
      this.notificationService.show('Excel descargado correctamente', 'success');
    } catch {
      this.notificationService.show('No se pudo generar el Excel', 'error');
    } finally {
      this.isExportingExcel.set(false);
    }
  }

  exportRendicionPdf(): void {
    const data = this.buildExportData();
    if (!data) {
      this.notificationService.show('No hay datos para exportar', 'error');
      return;
    }
    this.isExportingPdf.set(true);
    try {
      this.rendicionExportService.exportToPdf(data);
      this.notificationService.show('PDF descargado correctamente', 'success');
    } catch {
      this.notificationService.show('No se pudo generar el PDF', 'error');
    } finally {
      this.isExportingPdf.set(false);
    }
  }

  confirmDeleteExpense(expense: Record<string, unknown> & { _id?: string }): void {
    const id = expense._id;
    if (!id) return;
    const label = this.getExpenseDescription(expense).slice(0, 60) || 'este comprobante';
    if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    this.deletingExpenseId.set(id);
    this.invoicesService.deleteInvoice(id).subscribe({
      next: () => {
        this.notificationService.show('Comprobante eliminado', 'success');
        this.deletingExpenseId.set(null);
        this.loadReport();
      },
      error: (e) => {
        const msg = e?.error?.message;
        this.notificationService.show(
          typeof msg === 'string' ? msg : 'No se pudo eliminar el comprobante',
          'error',
        );
        this.deletingExpenseId.set(null);
      },
    });
  }
}
