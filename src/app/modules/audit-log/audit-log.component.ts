import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogService, IAuditLog } from '../../services/audit-log.service';

const ACTION_LABELS: Record<string, string> = {
  login: 'Inicio de sesión',
  create_invoice: 'Subió factura',
  approve_invoice: 'Aprobó factura',
  reject_invoice: 'Rechazó factura',
  delete_invoice: 'Eliminó factura',
  create_mobility_sheet: 'Creó planilla de movilidad',
  create_other_expense: 'Registró otro gasto',
  create_rendicion: 'Creó rendición',
  delete_rendicion: 'Eliminó rendición',
  update_rendicion_status: 'Cambió estado rendición',
  approve_advance_l1: 'Aprobó anticipo (L1)',
  approve_advance_l2: 'Aprobó anticipo (L2)',
  reject_advance: 'Rechazó anticipo',
  resubmit_advance: 'Reenvió solicitud de viáticos corregida',
  pay_advance: 'Registró pago anticipo',
  settle_advance: 'Liquidó anticipo',
  create_user: 'Creó usuario',
  update_user: 'Actualizó usuario',
  update_permissions: 'Modificó permisos',
};

const MODULE_LABELS: Record<string, string> = {
  facturas: 'Facturas',
  invoices: 'Facturas',
  rendiciones: 'Rendiciones',
  tesoreria: 'Tesorería',
  usuarios: 'Usuarios',
};

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log.component.html',
})
export class AuditLogComponent implements OnInit {
  private auditLogService = inject(AuditLogService);

  logs: IAuditLog[] = [];
  filteredLogs: IAuditLog[] = [];
  isLoading = signal(false);
  searchText = '';
  filterModule = '';

  readonly modules = ['facturas', 'rendiciones', 'tesoreria', 'usuarios'];
  readonly MODULE_LABELS = MODULE_LABELS;

  ngOnInit() {
    this.loadLogs();
  }

  loadLogs() {
    this.isLoading.set(true);
    this.auditLogService.findAll(500).subscribe({
      next: (logs) => {
        this.logs = logs;
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  applyFilters() {
    let result = this.logs;
    if (this.filterModule) {
      result = result.filter((l) => l.module === this.filterModule);
    }
    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase();
      result = result.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.details?.toLowerCase().includes(q)
      );
    }
    this.filteredLogs = result;
  }

  getActionLabel(action: string): string {
    return ACTION_LABELS[action] || action;
  }

  getModuleLabel(module: string): string {
    return MODULE_LABELS[module] || module;
  }

  getActionColor(action: string): string {
    if (action.startsWith('delete') || action.includes('reject')) return 'bg-red-100 text-red-700';
    if (action.startsWith('approve') || action.includes('settle') || action.includes('pay')) return 'bg-green-100 text-green-700';
    if (action.includes('update') || action.includes('change')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
  }
}
