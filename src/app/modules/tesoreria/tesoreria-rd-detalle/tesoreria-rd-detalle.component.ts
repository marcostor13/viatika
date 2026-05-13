import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DirectReimbursementService } from '../../../services/direct-reimbursement.service';
import { UserStateService } from '../../../services/user-state.service';
import { NotificationService } from '../../../services/notification.service';
import { UploadService } from '../../../services/upload.service';
import {
  IDirectReimbursement,
  DIRECT_REIMBURSEMENT_STATUS_LABELS,
  DIRECT_REIMBURSEMENT_STATUS_COLORS,
} from '../../../interfaces/direct-reimbursement.interface';

@Component({
  selector: 'app-tesoreria-rd-detalle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './tesoreria-rd-detalle.component.html',
})
export class TesoreriaRDDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(DirectReimbursementService);
  private userState = inject(UserStateService);
  private notifications = inject(NotificationService);
  private uploadService = inject(UploadService);
  private fb = inject(FormBuilder);

  readonly STATUS_LABELS = DIRECT_REIMBURSEMENT_STATUS_LABELS;
  readonly STATUS_COLORS = DIRECT_REIMBURSEMENT_STATUS_COLORS;

  isLoading = signal(true);
  isActing = signal(false);
  isUploadingReceipt = signal(false);
  loadError = signal<string | null>(null);
  dr = signal<IDirectReimbursement | null>(null);

  showApproveModal = signal(false);
  showRejectModal = signal(false);
  showPaymentModal = signal(false);

  rejectForm!: FormGroup;
  paymentForm!: FormGroup;

  receiptUrl: string | null = null;
  receiptName: string | null = null;

  get canAct() { return this.userState.canApproveL2(); }

  get canApproveAccounting(): boolean {
    const d = this.dr();
    return !!d && d.status === 'coordinator_approved' && this.canAct;
  }

  get canReject(): boolean {
    const d = this.dr();
    return !!d && d.status === 'coordinator_approved' && this.canAct;
  }

  get canRegisterPayment(): boolean {
    const d = this.dr();
    if (!d || !this.canAct) return false;
    return ['open', 'expenses_loaded', 'coordinator_approved', 'accounting_approved'].includes(d.status);
  }

  ngOnInit() {
    this.rejectForm = this.fb.group({
      reason: ['', [Validators.required, Validators.minLength(50)]],
    });
    this.paymentForm = this.fb.group({
      transferDate: [new Date().toISOString().split('T')[0], Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      operationNumber: ['', Validators.required],
    });

    const id = this.route.snapshot.paramMap.get('id')!;
    this.service.findOne(id).subscribe({
      next: (d) => {
        this.dr.set(d);
        this.isLoading.set(false);
      },
      error: (e) => {
        const msg =
          e?.status === 403
            ? 'Sin permisos para ver este reembolso directo.'
            : e?.error?.message || 'No se pudo cargar el reembolso directo.';
        this.loadError.set(msg);
        this.isLoading.set(false);
      },
    });
  }

  back() { this.router.navigate(['/tesoreria']); }

  getName(field: unknown): string {
    if (field && typeof field === 'object' && 'name' in field) {
      return String((field as { name: string }).name);
    }
    return '—';
  }

  getEmail(field: unknown): string {
    if (field && typeof field === 'object' && 'email' in field) {
      return String((field as { email: string }).email);
    }
    return '';
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  expenseCount(): number {
    return this.dr()?.expenseIds?.length ?? 0;
  }

  totalExpenses(): number {
    const exps = this.dr()?.expenseIds ?? [];
    return exps.reduce((sum, e) => {
      if (typeof e === 'object' && 'total' in e) return sum + (Number((e as any).total) || 0);
      return sum;
    }, 0);
  }

  confirmApprove() {
    const d = this.dr();
    if (!d) return;
    this.isActing.set(true);
    this.service.accountingApprove(d._id).subscribe({
      next: (updated) => {
        this.dr.set(updated);
        this.showApproveModal.set(false);
        this.notifications.show('Reembolso directo aprobado por contabilidad', 'success');
        this.isActing.set(false);
      },
      error: (e) => {
        this.notifications.show(e.error?.message || 'Error al aprobar', 'error');
        this.isActing.set(false);
      },
    });
  }

  confirmReject() {
    if (this.rejectForm.invalid) return;
    const d = this.dr();
    if (!d) return;
    this.isActing.set(true);
    this.service.accountingReject(d._id, this.rejectForm.value.reason).subscribe({
      next: (updated) => {
        this.dr.set(updated);
        this.showRejectModal.set(false);
        this.notifications.show('Reembolso directo rechazado', 'success');
        this.isActing.set(false);
      },
      error: (e) => {
        this.notifications.show(e.error?.message || 'Error al rechazar', 'error');
        this.isActing.set(false);
      },
    });
  }

  onReceiptSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      this.notifications.show('Formato invalido. Usa PDF, JPG o PNG.', 'error');
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.notifications.show('El comprobante no puede superar 10MB.', 'error');
      input.value = '';
      return;
    }
    this.isUploadingReceipt.set(true);
    this.uploadService.upload(file).subscribe({
      next: (res) => {
        this.receiptUrl = res.url;
        this.receiptName = file.name;
        this.notifications.show('Comprobante cargado', 'success');
        this.isUploadingReceipt.set(false);
      },
      error: () => {
        this.notifications.show('No se pudo subir el comprobante', 'error');
        this.isUploadingReceipt.set(false);
      },
    });
  }

  openPaymentModal() {
    this.receiptUrl = null;
    this.receiptName = null;
    this.paymentForm.reset({
      transferDate: new Date().toISOString().split('T')[0],
      amount: this.dr()?.estimatedAmount ?? null,
      operationNumber: '',
    });
    this.showPaymentModal.set(true);
  }

  confirmPayment() {
    if (this.paymentForm.invalid) return;
    if (!this.receiptUrl) {
      this.notifications.show('Debes adjuntar el comprobante de pago.', 'warning');
      return;
    }
    const d = this.dr();
    if (!d) return;
    this.isActing.set(true);
    this.service.registerPayment(d._id, {
      ...this.paymentForm.value,
      receiptUrl: this.receiptUrl,
      receiptFileName: this.receiptName || undefined,
    }).subscribe({
      next: (updated) => {
        this.dr.set(updated);
        this.showPaymentModal.set(false);
        this.notifications.show('Pago registrado correctamente', 'success');
        this.isActing.set(false);
      },
      error: (e) => {
        this.notifications.show(e.error?.message || 'Error al registrar pago', 'error');
        this.isActing.set(false);
      },
    });
  }
}
