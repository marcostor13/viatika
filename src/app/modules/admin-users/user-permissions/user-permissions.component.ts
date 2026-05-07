import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminUsersService } from '../services/admin-users.service';
import { NotificationService } from '../../../services/notification.service';
import { IUserResponse, IUserPermissions } from '../../../interfaces/user.interface';

interface ModuleOption {
  key: string;
  label: string;
  description: string;
}

@Component({
  selector: 'app-user-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-permissions.component.html',
  styleUrls: ['./user-permissions.component.scss'],
})
export class UserPermissionsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminUsersService = inject(AdminUsersService);
  private notification = inject(NotificationService);

  id: string = this.route.snapshot.params['id'];
  user: IUserResponse | null = null;
  saving = false;

  readonly availableModules: ModuleOption[] = [
    { key: 'invoices', label: 'Facturas', description: 'Registrar y gestionar facturas de gastos' },
    { key: 'mis-rendiciones', label: 'Mis Rendiciones', description: 'Ver y gestionar rendiciones propias' },
    { key: 'invoice-approval', label: 'Aprobación de Facturas', description: 'Revisar y aprobar facturas de colaboradores' },
    { key: 'consolidated-invoices', label: 'Consolidado', description: 'Ver reportes consolidados de gastos' },
    { key: 'tesoreria', label: 'Pagos', description: 'Registrar comprobantes de pago y liquidar anticipos' },
    { key: 'contabilidad', label: 'Contabilidad', description: 'Recibir alertas de viáticos aprobados y flujos contables asociados' },
    { key: 'configuracion', label: 'Configuración', description: 'Configurar parámetros de la empresa' },
    { key: 'audit-log', label: 'Actividad', description: 'Ver el registro de actividad de la empresa' },
  ];

  permissions: IUserPermissions = {
    modules: [],
    canApproveL1: false,
    canApproveL2: false,
  };

  ngOnInit(): void {
    this.loadUser();
  }

  loadUser() {
    this.adminUsersService.getUser(this.id).subscribe({
      next: (user) => {
        this.user = user;
        this.permissions = {
          modules: user.permissions?.modules ?? [],
          canApproveL1: user.permissions?.canApproveL1 ?? false,
          canApproveL2: user.permissions?.canApproveL2 ?? false,
        };
      },
      error: () => this.notification.show('Error al cargar el usuario', 'error'),
    });
  }

  hasModule(key: string): boolean {
    return this.permissions.modules.includes(key);
  }

  toggleModule(key: string, checked: boolean) {
    if (checked) {
      if (!this.permissions.modules.includes(key)) {
        this.permissions.modules = [...this.permissions.modules, key];
      }
    } else {
      this.permissions.modules = this.permissions.modules.filter((m) => m !== key);
    }
  }

  save() {
    this.saving = true;
    this.adminUsersService.updatePermissions(this.id, this.permissions).subscribe({
      next: () => {
        this.notification.show('Permisos actualizados correctamente', 'success');
        this.saving = false;
      },
      error: () => {
        this.notification.show('Error al actualizar los permisos', 'error');
        this.saving = false;
      },
    });
  }

  goBack() {
    this.router.navigate([`/admin-users/${this.id}/details`]);
  }
}
