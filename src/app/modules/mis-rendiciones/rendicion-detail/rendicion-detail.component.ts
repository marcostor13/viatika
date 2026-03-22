import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpenseReportsService } from '../../../services/expense-reports.service';
import { AdvanceService } from '../../../services/advance.service';
import { NotificationService } from '../../../services/notification.service';
import { UserStateService } from '../../../services/user-state.service';
import { IExpenseReport } from '../../../interfaces/expense-report.interface';
import { IAdvance, ADVANCE_STATUS_LABELS, ADVANCE_STATUS_COLORS } from '../../../interfaces/advance.interface';
import { ButtonComponent } from '../../../design-system/button/button.component';

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

  // Admin approval
  showAdminRejectModal = signal(false);
  adminRejectionReason = signal('');

  get isAdminView(): boolean {
    return this.userStateService.isAdmin() || this.userStateService.isSuperAdmin();
  }

  approveReport() {
    this.expenseReportsService.update(this.id, { status: 'approved' }).subscribe({
      next: (res) => {
        this.report = res;
        this.notificationService.show('Rendición aprobada correctamente', 'success');
      },
      error: () => {
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
    this.expenseReportsService.update(this.id, { status: 'rejected' }).subscribe({
      next: (res) => {
        this.report = res;
        this.showAdminRejectModal.set(false);
        this.notificationService.show('Rendición rechazada', 'success');
      },
      error: () => this.notificationService.show('Error al rechazar la rendición', 'error'),
    });
  }

  showTypeModal = false;
  showSubmitModal = false;
  isSubmitting = signal(false);

  openSubmitModal() {
    this.showSubmitModal = true;
  }

  closeSubmitModal() {
    this.showSubmitModal = false;
  }

  confirmSubmitReport() {
    this.isSubmitting.set(true);
    this.expenseReportsService.update(this.id, { status: 'submitted' }).subscribe({
      next: (res) => {
        this.report = res;
        this.calculateTotals();
        this.showSubmitModal = false;
        this.isSubmitting.set(false);
        this.notificationService.show('Rendición enviada correctamente', 'success');
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
}
