import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { TaxPeriodService } from '../../../services/tax-period.service';
import { ITaxPeriod } from '../../../interfaces/tax-period.interface';

@Component({
  selector: 'app-asientos-contables',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asientos-contables.component.html',
})
export class AsientosContablesComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private expenseReportsService = inject(ExpenseReportsService);
  private userStateService = inject(UserStateService);
  private notificationService = inject(NotificationService);
  private accountingEntriesService = inject(AccountingEntriesService);
  private taxPeriodService = inject(TaxPeriodService);

  id: string = this.route.snapshot.params['id'];
  report = signal<IExpenseReport | null>(null);
  loadingReport = signal(true);

  /**
   * Período tributario seleccionado. Gobierna las columnas Ejercicio/Periodo
   * del Excel y, si está cerrado, bloquea generación y descarga (el backend
   * ni siquiera firma la URL).
   */
  taxPeriods = signal<ITaxPeriod[]>([]);
  selectedPeriodId = signal<string>('');
  loadingPeriods = signal(true);

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
    this.loadTaxPeriods();
    this.expenseReportsService.findOne(this.id).subscribe({
      next: (data) => {
        this.report.set(data);
        this.loadingReport.set(false);
        // Con la rendición ya cargada se puede preferir el período de su mes
        // (los períodos pueden haber llegado antes que ella).
        if (this.taxPeriods().length) {
          this.selectedPeriodId.set(this.defaultPeriodId(this.taxPeriods()));
        }
        this.fetchStatus();
      },
      error: () => {
        this.loadingReport.set(false);
        this.globalError.set('No se pudo cargar la rendición.');
      },
    });
  }

  /**
   * Carga los períodos y preselecciona el primer ABIERTO que coincida con el
   * mes de la rendición; si no hay coincidencia, el abierto más reciente.
   * Sin períodos abiertos no se genera ni se descarga nada.
   */
  private loadTaxPeriods(): void {
    this.loadingPeriods.set(true);
    this.taxPeriodService.findAll().subscribe({
      next: (periods) => {
        this.taxPeriods.set(periods ?? []);
        this.loadingPeriods.set(false);
        if (!this.selectedPeriodId()) {
          this.selectedPeriodId.set(this.defaultPeriodId(periods ?? []));
          if (this.selectedPeriodId()) this.fetchStatus();
        }
      },
      error: () => {
        this.loadingPeriods.set(false);
        this.notificationService.show(
          'No se pudieron cargar los períodos tributarios.',
          'error'
        );
      },
    });
  }

  private defaultPeriodId(periods: ITaxPeriod[]): string {
    const open = periods.filter((p) => p.status === 'open');
    if (!open.length) return periods[0]?._id ?? '';
    const ref = this.report()?.startDate || this.report()?.createdAt;
    if (ref) {
      const d = new Date(ref);
      const match = open.find(
        (p) => p.year === d.getFullYear() && p.month === d.getMonth() + 1
      );
      if (match) return match._id;
    }
    return open[0]._id;
  }

  get selectedPeriod(): ITaxPeriod | undefined {
    return this.taxPeriods().find((p) => p._id === this.selectedPeriodId());
  }

  /** Sin período elegido o con el período cerrado no se genera ni se descarga. */
  get periodBlocked(): boolean {
    return !this.selectedPeriodId() || this.selectedPeriod?.status === 'closed';
  }

  onPeriodChange(periodId: string): void {
    this.selectedPeriodId.set(periodId);
    this.fetchStatus();
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
    this.accountingEntriesService
      .getStatus(this.id, this.applicableTipos(), this.selectedPeriodId())
      .subscribe({
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

  /** Un tipo está bloqueado si el backend lo marca o si el período no habilita la operación. */
  isBlocked(tipo: AsientoTipo): boolean {
    if (this.periodBlocked) return true;
    return !!this.files().find((f) => f.tipo === tipo)?.blocked;
  }

  /** Hay al menos un tipo generable (no bloqueado) → tiene sentido "Generar todos". */
  get hasGeneratableTipo(): boolean {
    return !this.periodBlocked && this.files().some((f) => !f.blocked);
  }

  /** La descarga solo procede con un período abierto seleccionado. */
  canDownload(file: IAccountingEntryStatus): boolean {
    return !!file.url && !this.periodBlocked;
  }

  /** Genera (o regenera, con `force`) un único tipo de asiento en 2do plano. */
  generate(tipo: AsientoTipo, force = false): void {
    if (this.isTriggering(tipo) || this.isBlocked(tipo)) return;
    const triggering = new Set(this.triggering());
    triggering.add(tipo);
    this.triggering.set(triggering);
    this.accountingEntriesService
      .triggerGenerate(this.id, [tipo], force, this.selectedPeriodId())
      .subscribe({
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
    if (!tipos.length || this.periodBlocked) return;
    this.accountingEntriesService
      .triggerGenerate(this.id, tipos, false, this.selectedPeriodId())
      .subscribe({
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
    if (!this.canDownload(file)) return;
    this.accountingEntriesService.download(this.id, file, this.selectedPeriodId());
  }
}
