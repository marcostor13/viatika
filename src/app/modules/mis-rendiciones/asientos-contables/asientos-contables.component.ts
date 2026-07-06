import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpenseReportsService } from '../../../services/expense-reports.service';
import { UserStateService } from '../../../services/user-state.service';
import { NotificationService } from '../../../services/notification.service';
import {
  AccountingEntriesService,
  AsientoTipo,
  IAccountingEntryStatus,
} from '../../../services/accounting-entries.service';
import { IExpenseReport } from '../../../interfaces/expense-report.interface';

@Component({
  selector: 'app-asientos-contables',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './asientos-contables.component.html',
})
export class AsientosContablesComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private expenseReportsService = inject(ExpenseReportsService);
  private userStateService = inject(UserStateService);
  private notificationService = inject(NotificationService);
  private accountingEntriesService = inject(AccountingEntriesService);

  id: string = this.route.snapshot.params['id'];
  report = signal<IExpenseReport | null>(null);
  loadingReport = signal(true);

  files = signal<IAccountingEntryStatus[]>([]);
  loadingStatus = signal(false);
  globalError = signal<string | null>(null);
  triggering = signal<Set<AsientoTipo>>(new Set());
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private readonly tipoLabels: Record<AsientoTipo, string> = {
    solicitud: 'Solicitud',
    compra: 'Compra',
    aplicacion: 'Aplicación',
    devolucion: 'Devolución',
    reembolso: 'Reembolso',
  };

  tipoLabel(tipo: AsientoTipo): string {
    return this.tipoLabels[tipo] ?? tipo;
  }

  get canAccess(): boolean {
    return this.userStateService.isContabilidad();
  }

  ngOnInit(): void {
    if (!this.canAccess) {
      this.router.navigate(['/mis-rendiciones', this.id, 'detalle']);
      return;
    }
    this.expenseReportsService.findOne(this.id).subscribe({
      next: (data) => {
        this.report.set(data);
        this.loadingReport.set(false);
        this.fetchStatus();
      },
      error: () => {
        this.loadingReport.set(false);
        this.globalError.set('No se pudo cargar la rendición.');
      },
    });
  }

  ngOnDestroy(): void {
    this.clearPoll();
  }

  goBack(): void {
    this.router.navigate(['/mis-rendiciones', this.id, 'detalle']);
  }

  /**
   * Tipos de asiento que pueden producir salida para esta rendición.
   * Evita pedir al backend trabajo innecesario (devolución/reembolso solo
   * aplican si el tipo de liquidación coincide). `solicitud` se mantiene
   * siempre porque depende de anticipos no visibles en este modelo; el
   * backend la descarta si no hay anticipos.
   */
  private applicableTipos(): AsientoTipo[] {
    const report = this.report();
    const tipos: AsientoTipo[] = ['solicitud'];
    if (report?.expenseIds?.length) {
      tipos.push('compra', 'aplicacion');
    }
    const settlementType = report?.settlement?.type;
    if (settlementType === 'devolucion') tipos.push('devolucion');
    if (settlementType === 'reembolso') tipos.push('reembolso');
    return tipos;
  }

  isTriggering(tipo: AsientoTipo): boolean {
    return this.triggering().has(tipo);
  }

  private clearPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  fetchStatus(): void {
    this.loadingStatus.set(true);
    this.globalError.set(null);
    this.accountingEntriesService.getStatus(this.id, this.applicableTipos()).subscribe({
      next: (res) => {
        this.loadingStatus.set(false);
        this.files.set(res?.files ?? []);
        this.syncPolling();
      },
      error: (err) => {
        this.loadingStatus.set(false);
        this.globalError.set(
          err?.error?.message || err?.message || 'Error al consultar los asientos.'
        );
      },
    });
  }

  /** Mientras haya algún tipo en 'processing', consulta el estado cada 3s. */
  private syncPolling(): void {
    const hasProcessing = this.files().some((f) => f.status === 'processing');
    if (hasProcessing && !this.pollTimer) {
      this.pollTimer = setInterval(() => this.fetchStatus(), 3000);
    } else if (!hasProcessing) {
      this.clearPoll();
    }
  }

  private mergeStatus(updated: IAccountingEntryStatus[]): void {
    const byTipo = new Map(updated.map((f) => [f.tipo, f]));
    this.files.set(this.files().map((f) => byTipo.get(f.tipo) ?? f));
  }

  /** Genera (o regenera, con `force`) un único tipo de asiento en 2do plano. */
  generate(tipo: AsientoTipo, force = false): void {
    if (this.isTriggering(tipo)) return;
    const triggering = new Set(this.triggering());
    triggering.add(tipo);
    this.triggering.set(triggering);
    this.accountingEntriesService.triggerGenerate(this.id, [tipo], force).subscribe({
      next: (res) => {
        const t = new Set(this.triggering());
        t.delete(tipo);
        this.triggering.set(t);
        this.mergeStatus(res?.files ?? []);
        this.syncPolling();
      },
      error: (err) => {
        const t = new Set(this.triggering());
        t.delete(tipo);
        this.triggering.set(t);
        this.notificationService.show(
          err?.error?.message || err?.message || 'Error al generar el asiento.',
          'error'
        );
      },
    });
  }

  /** Genera todos los tipos aplicables que aún no estén listos y al día. */
  generateAll(): void {
    const tipos = this.applicableTipos();
    if (!tipos.length) return;
    this.accountingEntriesService.triggerGenerate(this.id, tipos).subscribe({
      next: (res) => {
        this.mergeStatus(res?.files ?? []);
        this.syncPolling();
      },
      error: (err) => {
        this.notificationService.show(
          err?.error?.message || err?.message || 'Error al generar los asientos.',
          'error'
        );
      },
    });
  }

  download(file: IAccountingEntryStatus): void {
    this.accountingEntriesService.download(this.id, file);
  }
}
