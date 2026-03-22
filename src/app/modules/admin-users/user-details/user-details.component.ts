import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminUsersService } from '../services/admin-users.service';
import { IUserResponse } from '../../../interfaces/user.interface';
import { ERoles } from '../interfaces/roles.enum';
import { CreateRendicionModalComponent } from './create-rendicion-modal/create-rendicion-modal.component';
import { ExpenseReportsService } from '../../../services/expense-reports.service';
import { IExpenseReport } from '../../../interfaces/expense-report.interface';
import { UserStateService } from '../../../services/user-state.service';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmationService } from '../../../services/confirmation.service';

type RendicionStatus = 'open' | 'submitted' | 'approved' | 'rejected' | 'closed';

const STATUS_LABELS: Record<RendicionStatus, string> = {
  open: 'Abierta',
  submitted: 'Enviada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  closed: 'Cerrada',
};

const STATUS_COLORS: Record<RendicionStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-800',
};

@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [CommonModule, FormsModule, CreateRendicionModalComponent],
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.scss']
})
export class UserDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminUsersService = inject(AdminUsersService);
  private expenseReportsService = inject(ExpenseReportsService);
  private userStateService = inject(UserStateService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);

  id: string = this.route.snapshot.params['id'];
  user: IUserResponse | null = null;
  roleName = '';

  expenseReports: IExpenseReport[] = [];
  isLoadingReports = signal(false);
  isCreateModalOpen = false;

  showStatusModal = signal(false);
  selectedReport = signal<IExpenseReport | null>(null);
  newStatus = signal<RendicionStatus>('open');

  readonly STATUS_LABELS = STATUS_LABELS;
  readonly STATUS_COLORS = STATUS_COLORS;
  readonly statuses: RendicionStatus[] = ['open', 'submitted', 'approved', 'rejected', 'closed'];

  ngOnInit(): void {
    if (this.id) this.getUserData();
  }

  getUserData() {
    this.adminUsersService.getUser(this.id).subscribe({
      next: (userData) => {
        this.user = userData;
        this.roleName = userData.role?.name
          ? (ERoles[userData.role.name as keyof typeof ERoles] || userData.role.name)
          : 'Sin Rol';
        this.loadExpenseReports();
      },
      error: () => this.notificationService.show('Error al cargar el usuario', 'error'),
    });
  }

  loadExpenseReports() {
    this.isLoadingReports.set(true);
    const currentUser = this.userStateService.getUser() as any;
    const clientId = currentUser?.companyId || currentUser?.clientId;
    if (!clientId) { this.isLoadingReports.set(false); return; }

    this.expenseReportsService.findAllByUser(this.id, clientId).subscribe({
      next: (reports) => {
        this.expenseReports = reports;
        this.isLoadingReports.set(false);
      },
      error: () => {
        this.notificationService.show('Error al cargar rendiciones', 'error');
        this.isLoadingReports.set(false);
      },
    });
  }

  goBack() {
    this.router.navigate(['/admin-users']);
  }

  goToPermisos() {
    this.router.navigate([`/admin-users/${this.id}/permisos`]);
  }

  goToEdit() {
    this.router.navigate([`/admin-users/create-user/${this.id}`]);
  }

  // ── Crear rendición ──────────────────────────────────────────────
  createRendicion() {
    this.isCreateModalOpen = true;
  }

  onModalClose(success: boolean) {
    this.isCreateModalOpen = false;
    if (success) this.loadExpenseReports();
  }

  // ── Cambiar estado ───────────────────────────────────────────────
  openStatusModal(report: IExpenseReport) {
    this.selectedReport.set(report);
    this.newStatus.set(report.status);
    this.showStatusModal.set(true);
  }

  confirmStatusChange() {
    const report = this.selectedReport();
    if (!report) return;
    this.expenseReportsService.update(report._id, { status: this.newStatus() }).subscribe({
      next: () => {
        this.notificationService.show('Estado actualizado correctamente', 'success');
        this.showStatusModal.set(false);
        this.loadExpenseReports();
      },
      error: () => this.notificationService.show('Error al actualizar el estado', 'error'),
    });
  }

  // ── Eliminar rendición ───────────────────────────────────────────
  deleteReport(report: IExpenseReport) {
    this.confirmationService.show(
      `¿Eliminar la rendición "${report.title}"? Esta acción no se puede deshacer.`,
      () => {
        this.expenseReportsService.delete(report._id).subscribe({
          next: () => {
            this.notificationService.show('Rendición eliminada correctamente', 'success');
            this.loadExpenseReports();
          },
          error: () => this.notificationService.show('Error al eliminar la rendición', 'error'),
        });
      }
    );
  }

  goToRendicionDetail(reportId: string) {
    this.router.navigate([`/mis-rendiciones/${reportId}/detalle`]);
  }

  // ── Helpers ──────────────────────────────────────────────────────
  getStatusLabel(status: string): string {
    return STATUS_LABELS[status as RendicionStatus] || status;
  }

  getStatusColor(status: string): string {
    return STATUS_COLORS[status as RendicionStatus] || 'bg-gray-100 text-gray-800';
  }
}
