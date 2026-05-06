import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdvanceService } from '../../services/advance.service';
import { UserStateService } from '../../services/user-state.service';
import { NotificationService } from '../../services/notification.service';
import {
  IAdvance,
  IAdvanceStats,
  ADVANCE_STATUS_LABELS,
  ADVANCE_STATUS_COLORS,
} from '../../interfaces/advance.interface';
type Tab = 'pendientes' | 'aprobados' | 'historial';

@Component({
  selector: 'app-tesoreria',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tesoreria.component.html',
})
export class TesoreriaComponent implements OnInit {
  private advanceService = inject(AdvanceService);
  private userStateService = inject(UserStateService);
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);

  activeTab = signal<Tab>('pendientes');
  isLoading = signal(false);
  isActing = signal(false);

  stats: IAdvanceStats | null = null;
  allAdvances: IAdvance[] = [];
  pendingAdvances: IAdvance[] = [];

  selectedAdvance: IAdvance | null = null;
  showPaymentModal = false;
  showRejectModal = false;
  showReturnModal = false;
  showHistoryModal = false;

  paymentForm!: FormGroup;
  rejectForm!: FormGroup;
  returnForm!: FormGroup;

  readonly STATUS_LABELS = ADVANCE_STATUS_LABELS;
  readonly STATUS_COLORS = ADVANCE_STATUS_COLORS;

  get isSuperAdmin() { return this.userStateService.isSuperAdmin(); }
  get isAdmin() { return this.userStateService.isAdmin(); }
  get canPayAndSettle() { return this.userStateService.canApproveL2(); }

  ngOnInit() {
    this.initForms();
    this.loadData();
  }

  initForms() {
    this.paymentForm = this.fb.group({
      method: ['transferencia_bancaria', Validators.required],
      bankName: [''],
      accountNumber: [''],
      cci: [''],
      transferDate: [new Date().toISOString().split('T')[0], Validators.required],
      reference: [''],
    });
    this.rejectForm = this.fb.group({
      rejectionReason: [
        '',
        [Validators.required, Validators.minLength(10)],
      ],
    });
    this.returnForm = this.fb.group({
      returnedAmount: [null, [Validators.required, Validators.min(0.01)]],
    });
  }

  loadData() {
    this.isLoading.set(true);
    this.advanceService.getStats().subscribe({
      next: (s) => { this.stats = s; },
      error: () => {},
    });
    this.advanceService.findAll().subscribe({
      next: (advances) => {
        this.allAdvances = advances;
        this.pendingAdvances = advances.filter(a =>
          ['pending_l1', 'pending_l2', 'approved'].includes(a.status)
        );
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); },
    });
  }

  get filteredAdvances(): IAdvance[] {
    switch (this.activeTab()) {
      case 'pendientes':
        return this.allAdvances.filter(a => ['pending_l1', 'pending_l2'].includes(a.status));
      case 'aprobados':
        return this.allAdvances.filter(a => ['approved', 'paid'].includes(a.status));
      case 'historial':
        return this.allAdvances.filter(a => ['settled', 'rejected', 'returned'].includes(a.status));
      default:
        return this.allAdvances;
    }
  }

  approveL1(advance: IAdvance) {
    this.isActing.set(true);
    this.advanceService.approveL1(advance._id, {}).subscribe({
      next: () => {
        this.notificationService.show('Anticipo aprobado (Nivel 1)', 'success');
        this.loadData();
        this.isActing.set(false);
      },
      error: (e) => {
        this.notificationService.show(e.error?.message || 'Error al aprobar', 'error');
        this.isActing.set(false);
      },
    });
  }

  approveL2(advance: IAdvance) {
    this.isActing.set(true);
    this.advanceService.approveL2(advance._id, {}).subscribe({
      next: () => {
        this.notificationService.show('Anticipo aprobado (Nivel 2 — Tesorería)', 'success');
        this.loadData();
        this.isActing.set(false);
      },
      error: (e) => {
        this.notificationService.show(e.error?.message || 'Error al aprobar', 'error');
        this.isActing.set(false);
      },
    });
  }

  openRejectModal(advance: IAdvance) {
    this.selectedAdvance = advance;
    this.rejectForm.reset();
    this.showRejectModal = true;
  }

  confirmReject() {
    if (!this.selectedAdvance || this.rejectForm.invalid) return;
    this.isActing.set(true);
    this.advanceService.reject(this.selectedAdvance._id, this.rejectForm.value).subscribe({
      next: () => {
        this.notificationService.show('Anticipo rechazado', 'success');
        this.showRejectModal = false;
        this.loadData();
        this.isActing.set(false);
      },
      error: (e) => {
        this.notificationService.show(e.error?.message || 'Error', 'error');
        this.isActing.set(false);
      },
    });
  }

  openPaymentModal(advance: IAdvance) {
    this.selectedAdvance = advance;
    const user = typeof advance.userId === 'object' ? advance.userId : null;
    if (user?.bankAccount) {
      this.paymentForm.patchValue({
        bankName: user.bankAccount.bankName,
        accountNumber: user.bankAccount.accountNumber,
        cci: user.bankAccount.cci,
      });
    }
    this.showPaymentModal = true;
  }

  confirmPayment() {
    if (!this.selectedAdvance || this.paymentForm.invalid) return;
    this.isActing.set(true);
    this.advanceService.registerPayment(this.selectedAdvance._id, this.paymentForm.value).subscribe({
      next: () => {
        this.notificationService.show('Pago registrado correctamente', 'success');
        this.showPaymentModal = false;
        this.loadData();
        this.isActing.set(false);
      },
      error: (e) => {
        this.notificationService.show(e.error?.message || 'Error al registrar pago', 'error');
        this.isActing.set(false);
      },
    });
  }

  settle(advance: IAdvance) {
    this.isActing.set(true);
    this.advanceService.settle(advance._id).subscribe({
      next: (settled) => {
        this.notificationService.show(
          `Liquidación: ${settled.settlement?.type === 'reembolso' ? 'Reembolso S/. ' + Math.abs(settled.settlement.difference).toFixed(2) : settled.settlement?.type === 'devolucion' ? 'Devolución S/. ' + settled.settlement.difference.toFixed(2) : 'Equilibrado'}`,
          'success'
        );
        this.loadData();
        this.isActing.set(false);
      },
      error: (e) => {
        this.notificationService.show(e.error?.message || 'Error en liquidación', 'error');
        this.isActing.set(false);
      },
    });
  }

  openReturnModal(advance: IAdvance) {
    this.selectedAdvance = advance;
    this.returnForm.reset({ returnedAmount: advance.settlement?.difference || advance.amount });
    this.showReturnModal = true;
  }

  confirmReturn() {
    if (!this.selectedAdvance || this.returnForm.invalid) return;
    this.isActing.set(true);
    this.advanceService.registerReturn(this.selectedAdvance._id, this.returnForm.value.returnedAmount).subscribe({
      next: () => {
        this.notificationService.show('Devolución registrada correctamente', 'success');
        this.showReturnModal = false;
        this.loadData();
        this.isActing.set(false);
      },
      error: (e) => {
        this.notificationService.show(e.error?.message || 'Error', 'error');
        this.isActing.set(false);
      },
    });
  }

  getUserName(advance: IAdvance): string {
    if (typeof advance.userId === 'object') return advance.userId.name;
    return '—';
  }

  getReportTitle(advance: IAdvance): string {
    if (typeof advance.expenseReportId === 'object' && advance.expenseReportId) {
      return advance.expenseReportId.title;
    }
    return '—';
  }

  getLevelsBadge(advance: IAdvance): string {
    return `L${advance.requiredLevels}`;
  }

  openHistoryModal(advance: IAdvance) {
    this.selectedAdvance = advance;
    this.showHistoryModal = true;
  }

  closeHistoryModal() {
    this.showHistoryModal = false;
  }

  approvalActionLabel(action: string): string {
    const map: Record<string, string> = {
      approved: 'Aprobación',
      rejected: 'Rechazo',
      resubmitted: 'Reenvío',
    };
    return map[action] ?? action;
  }

  formatHistoryDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es-PE');
  }
}
