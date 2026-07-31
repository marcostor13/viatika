import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdvanceService } from '../../../services/advance.service';
import { UserStateService } from '../../../services/user-state.service';
import { NotificationService } from '../../../services/notification.service';
import {
  IViaticoSolicitudExportData,
  ViaticoSolicitudExportService,
} from '../../../services/viatico-solicitud-export.service';
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
  private exportService = inject(ViaticoSolicitudExportService);

  readonly STATUS_LABELS = ADVANCE_STATUS_LABELS;
  readonly STATUS_COLORS = ADVANCE_STATUS_COLORS;

  isLoading = signal(true);
  isActing = signal(false);
  isDownloading = signal(false);
  advance = signal<IAdvance | null>(null);

  showRejectModal = signal(false);
  showCancelModal = signal(false);
  isCancelling = signal(false);
  rejectForm!: FormGroup;

  get canApproveL1() { return this.userState.canApproveL1(); }
  get canApproveL2() { return this.userState.canApproveL2(); }

  private get currentUserId(): string {
    return (this.userState.getUser() as any)?._id ?? '';
  }

  private get advanceOwnerId(): string {
    const u = this.advance()?.userId;
    return u && typeof u === 'object' ? (u as any)._id : (u ?? '');
  }

  get canCancelAction(): boolean {
    const a = this.advance();
    return !!a && a.status === 'pending_l1' && this.currentUserId === this.advanceOwnerId;
  }

  ngOnInit() {
    this.rejectForm = this.fb.group({
      rejectionReason: ['', [Validators.required, Validators.minLength(10)]],
    });
    const id = this.route.snapshot.paramMap.get('id')!;
    this.advanceService.findOne(id).subscribe({
      next: (a) => { this.advance.set(a); this.isLoading.set(false); },
      error: () => { this.notifications.show('No se pudo cargar la solicitud', 'error'); this.router.navigate(['/rendiciones']); },
    });
  }

  back() { this.router.navigate(['/rendiciones']); }

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

  doCancel() {
    const a = this.advance();
    if (!a) return;
    this.isCancelling.set(true);
    this.advanceService.cancelAdvance(a._id).subscribe({
      next: (updated) => {
        this.advance.set(updated);
        this.showCancelModal.set(false);
        this.isCancelling.set(false);
        this.notifications.show('Solicitud cancelada.', 'success');
      },
      error: (e) => {
        this.isCancelling.set(false);
        this.notifications.show(e?.error?.message || 'Error al cancelar la solicitud.', 'error');
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

  pipelineSteps(): Array<{
    label: string;
    state: 'completed' | 'active' | 'upcoming' | 'rejected';
    date?: string;
    description?: string;
    notes?: string;
  }> {
    const a = this.advance();
    if (!a) return [];

    const isTwoLevel = a.requiredLevels >= 2;
    const status = a.status;
    const history = a.approvalHistory;

    const ACTIVE_STEP: Partial<Record<string, number>> = isTwoLevel
      ? { pending_l1: 1, pending_l2: 2, approved: 3, paid: 4, settled: 5 }
      : { pending_l1: 1, approved: 2, paid: 3, settled: 4 };

    const activeStep = ACTIVE_STEP[status] ?? 0;

    const stateFor = (pos: number): 'completed' | 'active' | 'upcoming' | 'rejected' => {
      if (status === 'rejected') {
        const rejEntry = [...history].reverse().find(h => h.action === 'rejected');
        const rejPos = (rejEntry?.level ?? 1) === 1 ? 1 : 2;
        if (pos < rejPos) return 'completed';
        if (pos === rejPos) return 'rejected';
        return 'upcoming';
      }
      if (pos < activeStep) return 'completed';
      if (pos === activeStep) return 'active';
      return 'upcoming';
    };

    const fmt = (d?: string) =>
      d ? new Date(d).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined;

    const l1Entry = history.find(h => h.level === 1 && h.action === 'approved');
    const l2Entry = history.find(h => h.level === 2 && h.action === 'approved');

    const ACTIVE_DESC: Record<number, string> = isTwoLevel
      ? {
          1: 'Pendiente de aprobacion del coordinador',
          2: 'Aprobado por coordinador — pendiente de aprobacion de contabilidad y deposito',
          3: 'Pendiente de registro de pago',
        }
      : {
          1: 'Pendiente de aprobacion del coordinador',
          2: 'Pendiente de registro de pago',
        };

    const l1S = stateFor(1);
    const payPos = isTwoLevel ? 3 : 2;
    const payS = stateFor(payPos);

    const steps: Array<{ label: string; state: ReturnType<typeof stateFor>; date?: string; description?: string; notes?: string }> = [
      { label: 'Solicitud enviada', state: 'completed', date: fmt(a.createdAt) },
      {
        label: 'Aprobado por coordinador',
        state: l1S,
        date: fmt(l1Entry?.date),
        description: l1S === 'active' ? ACTIVE_DESC[1] : undefined,
        notes: l1Entry?.notes,
      },
    ];

    if (isTwoLevel) {
      const l2S = stateFor(2);
      steps.push({
        label: 'Aprobado por contabilidad',
        state: l2S,
        date: fmt(l2Entry?.date),
        description: l2S === 'active' ? ACTIVE_DESC[2] : undefined,
        notes: l2Entry?.notes,
      });
    }

    steps.push({
      label: 'Pago registrado',
      state: payS,
      date: fmt(a.paymentInfo?.transferDate),
      description: payS === 'active' ? ACTIVE_DESC[payPos] : undefined,
    });

    return steps;
  }

  // ── Descarga del documento de la solicitud ───────────────────────────────

  /** Formato "SOLICITUD DE VIÁTICOS" a partir del anticipo (mismo doc que el popup). */
  private exportData(): IViaticoSolicitudExportData {
    const a = this.advance()!;
    const user = a.userId as any;
    const project = a.projectId as any;
    const bank = user?.bankAccount;

    const nroCuenta = bank?.accountNumber ?? '';
    const cci = bank?.cci ?? '';
    const fmt = (d?: string) =>
      d ? new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const catName = (ln: IAdvanceLine) =>
      typeof ln.categoryId === 'object' && 'name' in (ln.categoryId as any)
        ? (ln.categoryId as any).name
        : '—';

    return {
      id: a._id,
      responsable: user?.name ?? '—',
      cuenta: [nroCuenta, cci ? `CCI: ${cci}` : ''].filter(Boolean).join('  /  ') || '—',
      dni: user?.dni ?? '—',
      lugar: a.place ?? '—',
      desde: fmt(a.startDate),
      hasta: fmt(a.endDate),
      proyecto: project && typeof project === 'object' ? project.name : '—',
      lines: (a.lines ?? []).map(ln => ({
        categoria: catName(ln),
        detalle: ln.detalle ?? '',
        importe: ln.importe,
        peopleCount: ln.peopleCount,
        glpPerDay: ln.glpPerDay,
        days: ln.days,
        lineTotal: ln.lineTotal,
      })),
      total: a.amount,
      saldoAnterior: a.pendingBalanceAmount ?? undefined,
    };
  }

  async downloadPdf(): Promise<void> {
    if (!this.advance() || this.isDownloading()) return;
    this.isDownloading.set(true);
    try {
      await this.exportService.downloadPdf(this.exportData());
    } catch {
      this.notifications.show('No se pudo generar el PDF de la solicitud', 'error');
    } finally {
      this.isDownloading.set(false);
    }
  }

  async downloadExcel(): Promise<void> {
    if (!this.advance() || this.isDownloading()) return;
    this.isDownloading.set(true);
    try {
      await this.exportService.downloadExcel(this.exportData());
    } catch {
      this.notifications.show('No se pudo generar el Excel de la solicitud', 'error');
    } finally {
      this.isDownloading.set(false);
    }
  }
}
