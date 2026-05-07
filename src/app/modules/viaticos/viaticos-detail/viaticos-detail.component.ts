import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdvanceService } from '../../../services/advance.service';
import { UserStateService } from '../../../services/user-state.service';
import { NotificationService } from '../../../services/notification.service';
import {
  IAdvance,
  IAdvanceLine,
  ADVANCE_STATUS_LABELS,
  ADVANCE_STATUS_COLORS,
} from '../../../interfaces/advance.interface';

@Component({
  selector: 'app-viaticos-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './viaticos-detail.component.html',
})
export class ViaticosDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private advanceService = inject(AdvanceService);
  private userState = inject(UserStateService);
  private notifications = inject(NotificationService);
  private fb = inject(FormBuilder);

  readonly STATUS_LABELS = ADVANCE_STATUS_LABELS;
  readonly STATUS_COLORS = ADVANCE_STATUS_COLORS;

  isLoading = signal(true);
  isActing = signal(false);
  advance = signal<IAdvance | null>(null);

  showRejectModal = signal(false);
  rejectForm!: FormGroup;

  get canApproveL1() { return this.userState.canApproveL1(); }
  get canApproveL2() { return this.userState.canApproveL2(); }

  ngOnInit() {
    this.rejectForm = this.fb.group({
      rejectionReason: ['', [Validators.required, Validators.minLength(10)]],
    });
    const id = this.route.snapshot.paramMap.get('id')!;
    this.advanceService.findOne(id).subscribe({
      next: (a) => { this.advance.set(a); this.isLoading.set(false); },
      error: () => { this.notifications.show('No se pudo cargar la solicitud', 'error'); this.router.navigate(['/viaticos']); },
    });
  }

  back() { this.router.navigate(['/viaticos']); }

  get canApproveL1Action(): boolean {
    const a = this.advance();
    return !!a && a.status === 'pending_l1' && this.canApproveL1;
  }

  get canApproveL2Action(): boolean {
    const a = this.advance();
    return !!a && a.status === 'pending_l2' && this.canApproveL2;
  }

  get canRejectAction(): boolean {
    const a = this.advance();
    return !!a && ['pending_l1', 'pending_l2'].includes(a.status) && (this.canApproveL1 || this.canApproveL2);
  }

  approveL1() {
    const a = this.advance();
    if (!a) return;
    this.isActing.set(true);
    this.advanceService.approveL1(a._id, {}).subscribe({
      next: (updated) => {
        this.advance.set(updated);
        this.notifications.show('Solicitud aprobada (Nivel 1)', 'success');
        this.isActing.set(false);
      },
      error: (e) => {
        this.notifications.show(e?.error?.message || 'Error al aprobar', 'error');
        this.isActing.set(false);
      },
    });
  }

  approveL2() {
    const a = this.advance();
    if (!a) return;
    this.isActing.set(true);
    this.advanceService.approveL2(a._id, {}).subscribe({
      next: (updated) => {
        this.advance.set(updated);
        this.notifications.show('Solicitud aprobada (Nivel 2)', 'success');
        this.isActing.set(false);
      },
      error: (e) => {
        this.notifications.show(e?.error?.message || 'Error al aprobar', 'error');
        this.isActing.set(false);
      },
    });
  }

  confirmReject() {
    const a = this.advance();
    if (!a || this.rejectForm.invalid) return;
    this.isActing.set(true);
    this.advanceService.reject(a._id, this.rejectForm.value).subscribe({
      next: (updated) => {
        this.advance.set(updated);
        this.notifications.show('Solicitud rechazada', 'success');
        this.showRejectModal.set(false);
        this.isActing.set(false);
      },
      error: (e) => {
        this.notifications.show(e?.error?.message || 'Error al rechazar', 'error');
        this.isActing.set(false);
      },
    });
  }

  collaboratorName(): string {
    const u = this.advance()?.userId;
    return u && typeof u === 'object' ? u.name : '—';
  }

  collaboratorEmail(): string {
    const u = this.advance()?.userId;
    return u && typeof u === 'object' ? u.email : '';
  }

  projectLabel(): string {
    const p = this.advance()?.projectId;
    if (!p || typeof p === 'string') return '—';
    return p.code ? `${p.code} — ${p.name}` : p.name;
  }

  dateRange(): string {
    const a = this.advance();
    if (!a) return '—';
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
    if (a.startDate && a.endDate) return `${fmt(a.startDate)} al ${fmt(a.endDate)}`;
    if (a.startDate) return fmt(a.startDate);
    return '—';
  }

  createdAt(): string {
    const c = this.advance()?.createdAt;
    if (!c) return '—';
    return new Date(c).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  lines(): IAdvanceLine[] {
    return this.advance()?.lines ?? [];
  }

  categoryName(line: IAdvanceLine): string {
    const c = line.categoryId;
    if (c && typeof c === 'object' && 'name' in c) return (c as { name: string }).name;
    return '—';
  }

  historyActionLabel(action: string): string {
    const map: Record<string, string> = {
      approved: 'Aprobado',
      rejected: 'Rechazado',
      resubmitted: 'Reenviado',
    };
    return map[action] ?? action;
  }
}
