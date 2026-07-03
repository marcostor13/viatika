import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoriaService } from '../../../services/categoria.service';
import { IExpenseReport } from '../../../interfaces/expense-report.interface';

const STATUS_LABELS: Record<string, string> = {
  solicited: 'Solicitada',
  open: 'Registrando gastos',
  submitted: 'Enviada',
  pending_accounting: 'En contabilidad',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  reimbursed: 'Reembolsada',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
  pending_l1: 'En solicitud',
  pending_l2: 'Aprobada por coordinador',
  viatico_approved: 'Aprobada',
  partially_paid: 'Pago parcial',
  settled: 'Liquidada',
  returned: 'Saldo devuelto',
};

const STATUS_COLORS: Record<string, string> = {
  solicited: 'bg-purple-100 text-purple-800',
  open: 'bg-blue-100 text-blue-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  pending_accounting: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  reimbursed: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-gray-100 text-gray-500',
  pending_l1: 'bg-yellow-100 text-yellow-800',
  pending_l2: 'bg-orange-100 text-orange-700',
  viatico_approved: 'bg-blue-100 text-blue-800',
  partially_paid: 'bg-amber-100 text-amber-700',
  settled: 'bg-emerald-100 text-emerald-800',
};

/**
 * Popup con el detalle de una SOLICITUD de viático, para coordinador/contabilidad
 * en las tablas de acciones (Rendiciones y Tesorería). Muestra lo solicitado por el
 * colaborador (lugar, fechas, líneas por categoría, montos y financiamiento) sin
 * salir de la vista. El host controla la visibilidad pasando/limpiando `report`.
 */
@Component({
  selector: 'app-viatico-solicitud-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './viatico-solicitud-detail.component.html',
})
export class ViaticoSolicitudDetailComponent implements OnInit {
  private categoriaService = inject(CategoriaService);

  /** Reporte de viático a mostrar. Si es null, el popup no se renderiza. */
  @Input() report: IExpenseReport | null = null;
  /** Nombre del colaborador (el host ya suele resolverlo). */
  @Input() userName = '';
  /** Nombre del centro de costo (el host ya suele resolverlo). */
  @Input() projectName = '';
  @Output() closed = new EventEmitter<void>();

  /** Nombre de categoría por id, para el detalle de líneas. */
  private categoryNameById = new Map<string, string>();
  expandedLines = signal<Set<number>>(new Set<number>());

  ngOnInit(): void {
    this.categoriaService.getAllFlat().subscribe({
      next: cats => {
        this.categoryNameById.clear();
        for (const c of cats ?? []) this.categoryNameById.set(String(c._id), c.name);
      },
      error: () => {},
    });
  }

  get lines(): any[] {
    return (this.report as any)?.viaticoLines ?? [];
  }

  get statusLabel(): string {
    const s = this.report?.status ?? '';
    return STATUS_LABELS[s] ?? s;
  }

  get statusColor(): string {
    const s = this.report?.status ?? '';
    return STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-700';
  }

  get viaticoAmount(): number {
    return Number((this.report as any)?.viaticoAmount ?? this.report?.budget ?? 0);
  }

  get viaticoPaidAmount(): number {
    return Number((this.report as any)?.viaticoPaidAmount ?? 0);
  }

  get pendienteDeposito(): number {
    const pend = Math.round((this.viaticoAmount - this.viaticoPaidAmount) * 100) / 100;
    return pend > 0.01 ? pend : 0;
  }

  get hasBankData(): boolean {
    const r = this.report as any;
    return !!(r?.viaticoBankName || r?.viaticoAccountNumber || r?.viaticoCci);
  }

  get approvalHistory(): any[] {
    return (this.report as any)?.viaticoApprovalHistory ?? [];
  }

  categoryName(line: any): string {
    const c = line?.categoryId;
    if (c && typeof c === 'object' && 'name' in c) return (c as { name: string }).name;
    return this.categoryNameById.get(String(c)) || '—';
  }

  approvalActionLabel(action: string): string {
    return action === 'approved' ? 'Aprobó' : action === 'rejected' ? 'Rechazó' : action;
  }

  toggleLine(index: number): void {
    const s = new Set(this.expandedLines());
    s.has(index) ? s.delete(index) : s.add(index);
    this.expandedLines.set(s);
  }

  isLineExpanded(index: number): boolean {
    return this.expandedLines().has(index);
  }

  close(): void {
    this.closed.emit();
  }
}
