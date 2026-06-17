import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ExpenseReportsService } from '../../../services/expense-reports.service';
import { NotificationService } from '../../../services/notification.service';
import { UserStateService } from '../../../services/user-state.service';
import { BolsaService } from '../../../services/bolsa.service';
import { IBalanceItem } from '../../../interfaces/bolsa.interface';

@Component({
  selector: 'app-nueva-rendicion-directa',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './nueva-rendicion-directa.component.html',
})
export class NuevaRendicionDirectaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private expenseReportsService = inject(ExpenseReportsService);
  private notifications = inject(NotificationService);
  private userState = inject(UserStateService);
  private bolsa = inject(BolsaService);

  submitting = signal(false);
  saldos = signal<IBalanceItem[]>([]);
  loadingSaldos = signal(false);
  selectedIds = signal<string[]>([]);

  /** Suma de los saldos de la Bolsa seleccionados (financiará la rendición). */
  selectedTotal = computed(() =>
    this.saldos()
      .filter((s) => this.selectedIds().includes(s._id))
      .reduce((sum, s) => sum + (Number(s.remainingAmount) || 0), 0)
  );

  form: FormGroup = this.fb.group({
    gestion: ['', [Validators.required, Validators.minLength(3)]],
  });

  ngOnInit(): void {
    this.loadingSaldos.set(true);
    // Rendición directa (RN-2): puede combinar saldos de distintos proyectos.
    this.bolsa.getAvailable('directa').subscribe({
      next: (items) => {
        this.saldos.set(items ?? []);
        this.loadingSaldos.set(false);
      },
      error: () => this.loadingSaldos.set(false),
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggleSaldo(id: string): void {
    const cur = this.selectedIds();
    this.selectedIds.set(
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  goBack(): void {
    this.router.navigate(['/mis-rendiciones']);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const user = this.userState.getUser() as any;
    const userId = user?._id ?? '';
    const clientId =
      user?.companyId ||
      user?.client?._id ||
      (typeof user?.clientId === 'string' ? user.clientId : user?.clientId?._id) ||
      '';

    if (!userId || !clientId) {
      this.notifications.show('No se pudo identificar al usuario o empresa.', 'error');
      return;
    }

    this.submitting.set(true);
    this.expenseReportsService
      .create({
        gestion: this.form.value.gestion?.trim(),
        isDirecta: true,
        userId,
        clientId,
        consumedWalletEntryIds: this.selectedIds().length
          ? this.selectedIds()
          : undefined,
      })
      .subscribe({
        next: (report) => {
          this.submitting.set(false);
          this.notifications.show('Rendición creada correctamente.', 'success');
          this.router.navigate(['/mis-rendiciones', report._id, 'detalle']);
        },
        error: (err) => {
          this.submitting.set(false);
          const raw = err?.error?.message;
          const msg = Array.isArray(raw) ? raw.join(', ') : raw;
          this.notifications.show(msg || 'Error al crear la rendición.', 'error');
        },
      });
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!ctrl && ctrl.invalid && ctrl.touched;
  }
}
