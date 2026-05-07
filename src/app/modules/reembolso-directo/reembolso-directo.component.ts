import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DirectReimbursementService } from '../../services/direct-reimbursement.service';
import { UploadService } from '../../services/upload.service';
import { UserStateService } from '../../services/user-state.service';
import { NotificationService } from '../../services/notification.service';
import {
  IDirectReimbursement,
  DIRECT_REIMBURSEMENT_STATUS_LABELS,
  DIRECT_REIMBURSEMENT_STATUS_COLORS,
} from '../../interfaces/direct-reimbursement.interface';

type Tab = 'mis' | 'todos' | 'pagos';

@Component({
  selector: 'app-reembolso-directo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reembolso-directo.component.html',
})
export class ReembolsoDirectoComponent implements OnInit {
  private service = inject(DirectReimbursementService);
  private uploadService = inject(UploadService);
  private userState = inject(UserStateService);
  private notif = inject(NotificationService);
  private fb = inject(FormBuilder);

  activeTab = signal<Tab>('mis');
  isLoading = signal(false);
  isActing = signal(false);

  myReimbursements: IDirectReimbursement[] = [];
  allReimbursements: IDirectReimbursement[] = [];
  pendingPayments: IDirectReimbursement[] = [];

  selectedItem: IDirectReimbursement | null = null;
  showCreateModal = signal(false);
  showDetailModal = signal(false);
  showApproveModal = signal(false);
  showRejectModal = signal(false);
  showPaymentModal = signal(false);

  createForm!: FormGroup;
  rejectForm!: FormGroup;
  paymentForm!: FormGroup;

  isUploadingReceipt = signal(false);
  paymentReceiptUrl: string | null = null;
  paymentReceiptName: string | null = null;

  readonly STATUS_LABELS = DIRECT_REIMBURSEMENT_STATUS_LABELS;
  readonly STATUS_COLORS = DIRECT_REIMBURSEMENT_STATUS_COLORS;

  get isAdmin(): boolean { return this.userState.isAdmin() || this.userState.isSuperAdmin(); }
  get canPay(): boolean { return this.userState.canApproveL2(); }

  ngOnInit(): void {
    this.initForms();
    this.loadData();
  }

  private initForms(): void {
    this.createForm = this.fb.group({
      justification: ['', [Validators.required, Validators.minLength(100)]],
      estimatedAmount: [null, [Validators.required, Validators.min(0.01)]],
    });
    this.rejectForm = this.fb.group({
      reason: ['', [Validators.required, Validators.minLength(50)]],
    });
    this.paymentForm = this.fb.group({
      transferDate: [new Date().toISOString().split('T')[0], Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      operationNumber: ['', Validators.required],
    });
  }

  loadData(): void {
    this.isLoading.set(true);
    this.service.findMy().subscribe({
      next: rows => {
        this.myReimbursements = rows;
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); },
    });
    if (this.isAdmin) {
      this.service.findAllByClient().subscribe({
        next: rows => { this.allReimbursements = rows; },
        error: () => {},
      });
    }
    if (this.canPay) {
      this.service.findPendingPayments().subscribe({
        next: rows => { this.pendingPayments = rows; },
        error: () => {},
      });
    }
  }

  get displayedList(): IDirectReimbursement[] {
    if (this.activeTab() === 'mis') return this.myReimbursements;
    if (this.activeTab() === 'todos') return this.allReimbursements;
    return this.pendingPayments;
  }

  openCreateModal(): void {
    this.createForm.reset({ justification: '', estimatedAmount: null });
    this.showCreateModal.set(true);
  }

  submitCreate(): void {
    if (this.createForm.invalid) return;
    this.isActing.set(true);
    this.service.create(this.createForm.value).subscribe({
      next: () => {
        this.notif.show('Reembolso directo creado', 'success');
        this.showCreateModal.set(false);
        this.isActing.set(false);
        this.loadData();
      },
      error: (e) => {
        const msg = e?.error?.message;
        this.notif.show(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al crear', 'error');
        this.isActing.set(false);
      },
    });
  }

  openDetail(item: IDirectReimbursement): void {
    this.selectedItem = item;
    this.showDetailModal.set(true);
  }

  coordinatorApprove(item: IDirectReimbursement): void {
    this.isActing.set(true);
    this.service.coordinatorApprove(item._id).subscribe({
      next: () => {
        this.notif.show('Aprobacion de coordinador registrada', 'success');
        this.isActing.set(false);
        this.showDetailModal.set(false);
        this.loadData();
      },
      error: (e) => {
        this.notif.show(e?.error?.message || 'Error al aprobar', 'error');
        this.isActing.set(false);
      },
    });
  }

  openAccountingApproveModal(item: IDirectReimbursement): void {
    this.selectedItem = item;
    this.showApproveModal.set(true);
  }

  confirmAccountingApprove(): void {
    if (!this.selectedItem) return;
    this.isActing.set(true);
    this.service.accountingApprove(this.selectedItem._id).subscribe({
      next: () => {
        this.notif.show('Aprobacion de contabilidad registrada', 'success');
        this.showApproveModal.set(false);
        this.isActing.set(false);
        this.loadData();
      },
      error: (e) => {
        this.notif.show(e?.error?.message || 'Error al aprobar', 'error');
        this.isActing.set(false);
      },
    });
  }

  openRejectModal(item: IDirectReimbursement): void {
    this.selectedItem = item;
    this.rejectForm.reset();
    this.showRejectModal.set(true);
  }

  confirmReject(): void {
    if (!this.selectedItem || this.rejectForm.invalid) return;
    this.isActing.set(true);
    this.service.accountingReject(this.selectedItem._id, this.rejectForm.value.reason).subscribe({
      next: () => {
        this.notif.show('Reembolso rechazado', 'success');
        this.showRejectModal.set(false);
        this.isActing.set(false);
        this.loadData();
      },
      error: (e) => {
        this.notif.show(e?.error?.message || 'Error al rechazar', 'error');
        this.isActing.set(false);
      },
    });
  }

  openPaymentModal(item: IDirectReimbursement): void {
    this.selectedItem = item;
    this.paymentForm.reset({
      transferDate: new Date().toISOString().split('T')[0],
      amount: item.estimatedAmount,
      operationNumber: '',
    });
    this.paymentReceiptUrl = null;
    this.paymentReceiptName = null;
    this.showPaymentModal.set(true);
  }

  onPaymentReceiptSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      this.notif.show('Formato invalido. Usa PDF, JPG o PNG.', 'error');
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.notif.show('El archivo no puede superar 10MB.', 'error');
      input.value = '';
      return;
    }
    this.isUploadingReceipt.set(true);
    this.uploadService.upload(file).subscribe({
      next: (res) => {
        this.paymentReceiptUrl = res.url;
        this.paymentReceiptName = file.name;
        this.notif.show('Comprobante subido', 'success');
        this.isUploadingReceipt.set(false);
      },
      error: () => {
        this.notif.show('No se pudo subir el comprobante', 'error');
        this.isUploadingReceipt.set(false);
      },
    });
  }

  confirmPayment(): void {
    if (!this.selectedItem || this.paymentForm.invalid || !this.paymentReceiptUrl) {
      this.notif.show('Completa todos los campos y adjunta el comprobante', 'warning');
      return;
    }
    this.isActing.set(true);
    this.service.registerPayment(this.selectedItem._id, {
      ...this.paymentForm.value,
      receiptUrl: this.paymentReceiptUrl,
      receiptFileName: this.paymentReceiptName || undefined,
    }).subscribe({
      next: () => {
        this.notif.show('Pago registrado correctamente', 'success');
        this.showPaymentModal.set(false);
        this.isActing.set(false);
        this.loadData();
      },
      error: (e) => {
        this.notif.show(e?.error?.message || 'Error al registrar pago', 'error');
        this.isActing.set(false);
      },
    });
  }

  closeItem(item: IDirectReimbursement): void {
    this.isActing.set(true);
    this.service.close(item._id).subscribe({
      next: () => {
        this.notif.show('Expediente cerrado', 'success');
        this.isActing.set(false);
        this.loadData();
      },
      error: (e) => {
        this.notif.show(e?.error?.message || 'Error al cerrar', 'error');
        this.isActing.set(false);
      },
    });
  }

  getName(field: unknown): string {
    if (field && typeof field === 'object' && 'name' in field) {
      return String((field as { name: string }).name);
    }
    return '—';
  }

  expenseCount(item: IDirectReimbursement): number {
    return item.expenseIds?.length ?? 0;
  }

  formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
