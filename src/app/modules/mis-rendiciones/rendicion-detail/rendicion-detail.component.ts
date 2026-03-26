import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
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
    const ownerId = typeof this.report?.userId === 'object' ? this.report?.userId?._id : this.report?.userId;
    if (this.isAdminView && ownerId) {
      this.router.navigate(['/admin-users', ownerId, 'details']);
    } else {
      this.router.navigate(['/mis-rendiciones']);
    }
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

  /** La rendición está en fase de solicitud inicial (creada por colaborador, aún no aprobada). */
  get isSolicitudPhase(): boolean {
    if (!this.report) return false;
    if (this.report.status === 'solicited') return true;
    // Rechazada en fase de solicitud: no tiene gastos aún
    if (this.report.status === 'rejected' && (this.report.expenseIds?.length ?? 0) === 0) return true;
    return false;
  }

  /** Colaborador puede agregar gastos (rendición ya aprobada/abierta). */
  get canAddExpenses(): boolean {
    if (!this.report || this.isAdminView) return false;
    return this.report.status === 'open';
  }

  /** Colaborador puede re-enviar la solicitud inicial (fue rechazada antes de agregar gastos). */
  get canResendSolicitud(): boolean {
    if (!this.report || this.isAdminView) return false;
    return this.report.status === 'rejected' && (this.report.expenseIds?.length ?? 0) === 0;
  }

  /** Colaborador puede re-enviar la rendición completa (rechazada después de agregar gastos). */
  get canResubmitReport(): boolean {
    if (!this.report || this.isAdminView) return false;
    return this.report.status === 'rejected' && (this.report.expenseIds?.length ?? 0) > 0;
  }

  /** Colaborador puede agregar gastos y enviar (abierta o rechazada en fase de gastos). */
  get collaboratorCanEdit(): boolean {
    return this.canAddExpenses || this.canResubmitReport;
  }

  openAdminApproveModal(): void {
    this.showAdminApproveModal.set(true);
  }

  closeAdminApproveModal(): void {
    if (this.isApprovingReport()) return;
    this.showAdminApproveModal.set(false);
  }

  confirmApproveReport(): void {
    const isSolicitud = this.report?.status === 'solicited';
    const newStatus = isSolicitud ? 'open' : 'approved';
    this.isApprovingReport.set(true);
    this.expenseReportsService.update(this.id, { status: newStatus }).subscribe({
      next: (res) => {
        this.report = res;
        this.calculateTotals();
        this.showAdminApproveModal.set(false);
        this.isApprovingReport.set(false);
        this.notificationService.show(
          isSolicitud ? 'Solicitud aprobada. El colaborador ya puede agregar sus gastos.' : 'Rendición aprobada correctamente',
          'success',
        );
      },
      error: () => {
        this.isApprovingReport.set(false);
        this.notificationService.show('Error al aprobar', 'error');
      },
    });
  }

  // Edit-solicitud form (shown when rejected at solicitud phase)
  showEditSolicitudForm = signal(false);
  editSolicitudForm!: FormGroup;
  isResendingSolicitud = signal(false);

  get peopleNames(): FormArray {
    return this.editSolicitudForm.get('peopleNames') as FormArray;
  }

  addPersonName() {
    this.peopleNames.push(this.fb.control(''));
  }

  removePersonName(index: number) {
    if (this.peopleNames.length > 1) {
      this.peopleNames.removeAt(index);
    } else {
      this.peopleNames.at(0).setValue('');
    }
  }

  openEditSolicitudForm(): void {
    if (!this.report) return;
    const names = Array.isArray(this.report.peopleNames) ? this.report.peopleNames : [this.report.peopleNames || ''];
    this.editSolicitudForm = this.fb.group({
      title: [this.report.title, Validators.required],
      description: [this.report.description ?? ''],
      budget: [{ value: this.report.budget ?? 0, disabled: true }, [Validators.required, Validators.min(0)]], 
      accountNumber: [this.report.accountNumber ?? ''],
      idDocument: [this.report.idDocument ?? ''],
      peopleNames: this.fb.array(names.map(n => this.fb.control(n))),
      location: [this.report.location ?? ''],
      startDate: [this.report.startDate ? new Date(this.report.startDate).toISOString().split('T')[0] : ''],
      endDate: [this.report.endDate ? new Date(this.report.endDate).toISOString().split('T')[0] : ''],
    });
    this.showEditSolicitudForm.set(true);
  }

  resendSolicitud(): void {
    if (!this.editSolicitudForm || this.editSolicitudForm.invalid) return;
    this.isResendingSolicitud.set(true);
    // Use getRawValue() because budget might be disabled
    const val = this.editSolicitudForm.getRawValue();
    this.expenseReportsService.update(this.id, { 
      ...val, 
      status: 'solicited',
      rejectionReason: '' // Clear rejection reason on resubmit
    }).subscribe({
      next: (res) => {
        this.report = res;
        this.calculateTotals();
        this.showEditSolicitudForm.set(false);
        this.isResendingSolicitud.set(false);
        this.notificationService.show('Solicitud reenviada correctamente', 'success');
      },
      error: () => {
        this.isResendingSolicitud.set(false);
        this.notificationService.show('Error al reenviar la solicitud', 'error');
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

  // --- Aprobación documento por documento ---
  approvingExpenseId = signal<string | null>(null);
  rejectingExpenseId = signal<string | null>(null);
  showExpenseRejectModal = signal(false);
  expenseRejectTargetId = signal<string | null>(null);
  expenseRejectReason = signal('');

  /** Todos los comprobantes del reporte tienen status === 'approved'. */
  get allDocumentsApproved(): boolean {
    if (!this.report?.expenseIds || this.report.expenseIds.length === 0) return false;
    return this.report.expenseIds.every((exp: any) => exp.status === 'approved');
  }

  /** El admin puede aprobar la rendición completa solo si:
   *  1. La rendición está en status 'submitted' (colaborador la envió).
   *  2. Todos los documentos están aprobados individualmente.
   */
  get canFinalApprove(): boolean {
    return this.report?.status === 'submitted' && this.allDocumentsApproved;
  }

  /** Cantidad de documentos aprobados individualmente. */
  get approvedDocCount(): number {
    return this.report?.expenseIds?.filter((exp: any) => exp.status === 'approved').length ?? 0;
  }

  /** Cantidad total de documentos. */
  get totalDocCount(): number {
    return this.report?.expenseIds?.length ?? 0;
  }

  approveExpense(expenseId: string): void {
    this.approvingExpenseId.set(expenseId);
    this.invoicesService.approveInvoice(expenseId, { status: 'approved' }).subscribe({
      next: () => {
        this.notificationService.show('Documento aprobado', 'success');
        this.approvingExpenseId.set(null);
        this.loadReport();
      },
      error: (err) => {
        this.approvingExpenseId.set(null);
        const msg = err?.error?.message;
        this.notificationService.show(
          typeof msg === 'string' ? msg : 'Error al aprobar documento',
          'error'
        );
      },
    });
  }

  openExpenseRejectModal(expenseId: string): void {
    this.expenseRejectTargetId.set(expenseId);
    this.expenseRejectReason.set('');
    this.showExpenseRejectModal.set(true);
  }

  closeExpenseRejectModal(): void {
    this.showExpenseRejectModal.set(false);
    this.expenseRejectTargetId.set(null);
  }

  confirmRejectExpense(): void {
    const id = this.expenseRejectTargetId();
    if (!id) return;
    this.rejectingExpenseId.set(id);
    this.invoicesService.rejectInvoice(id, { status: 'rejected', reason: this.expenseRejectReason() }).subscribe({
      next: () => {
        this.notificationService.show('Documento rechazado', 'success');
        this.rejectingExpenseId.set(null);
        this.showExpenseRejectModal.set(false);
        this.loadReport();
      },
      error: (err) => {
        this.rejectingExpenseId.set(null);
        const msg = err?.error?.message;
        this.notificationService.show(
          typeof msg === 'string' ? msg : 'Error al rechazar documento',
          'error'
        );
      },
    });
  }

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

  /** Modal ficha completa del comprobante (documento + datos). */
  showExpenseDetailModal = signal(false);
  selectedExpense = signal<Record<string, unknown> | null>(null);

  openExpenseDetail(expense: Record<string, unknown>): void {
    this.selectedExpense.set(expense);
    this.showExpenseDetailModal.set(true);
  }

  closeExpenseDetail(): void {
    this.showExpenseDetailModal.set(false);
    this.selectedExpense.set(null);
  }

  getExpenseFileUrl(expense: Record<string, unknown> | null | undefined): string | null {
    if (!expense) return null;
    const f = expense['file'];
    if (typeof f !== 'string' || !f.trim()) return null;
    return f.trim();
  }

  hasExpenseFile(expense: Record<string, unknown> | null | undefined): boolean {
    return this.getExpenseFileUrl(expense) !== null;
  }

  openExpenseFile(expense: Record<string, unknown>): void {
    const url = this.getExpenseFileUrl(expense);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      this.notificationService.show('No hay documento adjunto', 'warning');
    }
  }

  isPreviewableImage(expense: Record<string, unknown>): boolean {
    const u = this.getExpenseFileUrl(expense);
    if (!u) return false;
    return /\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(u);
  }

  getExpenseDataObject(expense: Record<string, unknown>): Record<string, unknown> {
    const raw = expense['data'];
    try {
      if (raw == null) return {};
      if (typeof raw === 'string') return JSON.parse(raw) as Record<string, unknown>;
      if (typeof raw === 'object') return { ...(raw as Record<string, unknown>) };
    } catch {
      return {};
    }
    return {};
  }

  /** Valor legible de un campo del JSON `data` de la factura/gasto. */
  dataText(exp: Record<string, unknown>, key: string): string {
    const d = this.getExpenseDataObject(exp);
    const v = d[key];
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  getExpenseStatusForUi(status: unknown): string {
    return this.mapExpenseStatusExport(typeof status === 'string' ? status : undefined);
  }

  getPopulatedName(field: unknown): string {
    if (field && typeof field === 'object' && field !== null && 'name' in field) {
      return String((field as { name: string }).name);
    }
    return '—';
  }

  getExpenseTypeKey(exp: Record<string, unknown>): 'factura' | 'planilla_movilidad' | 'otros_gastos' {
    const t = exp['expenseType'];
    if (t === 'planilla_movilidad') return 'planilla_movilidad';
    if (t === 'otros_gastos') return 'otros_gastos';
    return 'factura';
  }

  mobilityRows(exp: Record<string, unknown>): Record<string, unknown>[] {
    const rows = exp['mobilityRows'];
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  }

  sunatBlock(exp: Record<string, unknown>): Record<string, unknown> | null {
    const d = this.getExpenseDataObject(exp);
    const s = d['sunatValidation'];
    if (s && typeof s === 'object') return s as Record<string, unknown>;
    return null;
  }

  trackMobilityRow(index: number, row: Record<string, unknown>): string {
    return `${index}-${String(row['fecha'] ?? '')}-${String(row['concepto'] ?? '').slice(0, 20)}`;
  }

  /** Acepta `unknown` para usar desde plantillas con `expense` de `@for` sin `unknown` en el pipe `number`. */
  getExpenseTotal(exp: unknown): number {
    if (exp == null || typeof exp !== 'object') return 0;
    const t = (exp as Record<string, unknown>)['total'];
    if (typeof t === 'number' && !Number.isNaN(t)) return t;
    const n = Number(t);
    return Number.isNaN(n) ? 0 : n;
  }

  mobilityRowTotal(row: Record<string, unknown>): number {
    const t = row['total'];
    if (typeof t === 'number' && !Number.isNaN(t)) return t;
    const n = Number(t);
    return Number.isNaN(n) ? 0 : n;
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
      solicited: 'Solicitada',
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

  getCollaboratorSignature(): string | undefined {
    const u = this.report?.userId;
    if (u == null) return undefined;
    if (typeof u === 'object' && u !== null && 'signature' in u) {
      return (u as { signature?: string }).signature;
    }
    return undefined;
  }

  getApprovedByName(): string {
    const u = this.report?.approvedBy;
    if (u == null) return '—';
    if (typeof u === 'object' && u !== null && 'name' in u) {
      return (u as { name?: string }).name || '—';
    }
    return '—';
  }

  getCreatedByName(): string {
    const u = this.report?.createdBy;
    if (u == null) return '—';
    if (typeof u === 'object' && u !== null && 'name' in u) {
      return (u as { name?: string }).name || '—';
    }
    return '—';
  }

  getProjectName(): string {
    const p = this.report?.projectId;
    if (p == null) return '—';
    if (typeof p === 'object' && p !== null && 'name' in p) {
      return (p as { name?: string }).name || '—';
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
    const comprobantes = (this.report.expenseIds || []).map((exp: Record<string, unknown>) => {
      const dataObj = this.getExpenseDataObject(exp);
      let provider = exp['provider'] as string || dataObj['razonSocial'] as string || '';
      if (!provider && this.getExpenseTypeLabel(exp) === 'Planilla movilidad') {
        provider = 'Planilla de Movilidad';
      }
      const numDoc = dataObj['serie'] && dataObj['correlativo'] ? `${dataObj['serie']}-${dataObj['correlativo']}` : '';

      return {
        tipo: this.getExpenseTypeLabel(exp),
        fecha: this.getExpenseDate(exp),
        descripcion: this.getExpenseDescription(exp),
        monto: Number(exp['total']) || 0,
        estadoComprobante: this.mapExpenseStatusExport(
          typeof exp['status'] === 'string' ? exp['status'] : undefined,
        ),
        proveedor: provider,
        numeroDocumento: numDoc
      };
    });
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
      // New fields
      accountNumber: this.report.accountNumber,
      idDocument: this.report.idDocument,
      peopleNames: this.report.peopleNames,
      location: this.report.location,
      startDate: this.report.startDate ? new Date(this.report.startDate).toLocaleDateString('es-PE') : undefined,
      endDate: this.report.endDate ? new Date(this.report.endDate).toLocaleDateString('es-PE') : undefined,
      items: (this.report.items || []).map(i => ({
        descripcion: i.description,
        importe: i.amount,
        personas: i.peopleCount,
        combustible: i.fuelAmount,
        dias: i.daysCount,
        total: i.total
      })),
      signature: this.getCollaboratorSignature(),
      approvedByName: this.getApprovedByName(),
      createdByName: this.getCreatedByName(),
      projectName: this.getProjectName(),
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
