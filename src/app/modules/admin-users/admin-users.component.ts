import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListTableComponent } from '../../components/list-table/list-table.component';
import { TableComponent } from '../../components/table/table.component';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { AdminUsersService } from './services/admin-users.service';
import {
  IUserResponse,
  IUser,
  IUserCreate,
  IUserUpdate,
  IRole,
  IClient,
} from '../../interfaces/user.interface';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';
import { UserStateService } from '../../services/user-state.service';
import { finalize, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ListTableComponent, TableComponent, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
})
export default class AdminUsersComponent implements OnInit {
  headers: IHeaderList[] = [
    { header: 'Nombre', value: 'name' },
    { header: 'Email', value: 'email' },
    { header: 'Rol', value: 'roleName' },
    { header: 'Acciones', value: 'actions', options: ['edit', 'delete'] },
  ];
  data: IUserResponse[] = [];

  panelMode: 'none' | 'create' | 'edit' = 'none';
  tempUser: Partial<IUser> = {};
  isLoading = signal(false);
  roles = signal<IRole[]>([]);
  clients = signal<IClient[]>([]);

  constructor(
    private adminUsersService: AdminUsersService,
    private notification: NotificationService,
    public userStateService: UserStateService
  ) { }

  ngOnInit() {
    if (!this.adminUsersService || !this.userStateService) {
      this.notification.show('Error: Servicios no disponibles', 'error');
      return;
    }

    this.data = [];
    this.tempUser = {};

    this.loadRoles();
    this.loadUsers();
    this.loadClients();
  }

  loadClients() {
    if (this.userStateService.isSuperAdmin()) {
      this.adminUsersService.getClients().subscribe({
        next: (clients) => {
          this.clients.set(clients);
        },
        error: (err) => {
          console.error('Error al cargar empresas:', err);
        }
      });
    }
  }

  loadRoles() {
    this.adminUsersService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
      },
      error: (err) => {
        console.error('Error al cargar roles:', err);
      }
    });
  }

  loadUsers() {
    this.isLoading.set(true);

    this.adminUsersService
      .getUsers()
      .pipe(
        catchError((error) => {
          this.notification.show(
            'Error al cargar usuarios: ' +
            (error?.message || 'Error desconocido'),
            'error'
          );
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe((users) => {
        const currentUser = this.userStateService.getUser();
        if (users && Array.isArray(users)) {
          this.data = users.map((user) => {
            const displayUser = {
              ...user,
              name:
                user.name ||
                `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                'Sin nombre',
              roleName: (user as any).role?.name || (user as any).roleId?.name || user.role || 'Sin rol',
              isVisible: false,
              isSelf: currentUser?._id === user._id,
            };
            return displayUser;
          });
        } else {
          this.data = [];
        }

        console.log('Usuarios cargados:', this.data);
      });
  }

  showCreatePanel() {
    this.panelMode = 'create';
    const currentUser = this.userStateService.getUser();

    this.tempUser = {
      firstName: '',
      lastName: '',
      email: '',
      role: '',
      password: '',
      isActive: true,
      companyId: currentUser?.companyId || '',
    };

    console.log(
      'Creando nuevo usuario para companyId:',
      currentUser?.companyId
    );
  }

  showEditPanel(user: IUserResponse) {
    if (!user) {
      this.notification.show('Error: Usuario no encontrado', 'error');
      return;
    }

    this.panelMode = 'edit';
    const nameParts = user.name?.split(' ') || [];

    this.tempUser = {
      ...user,
      firstName: user.firstName || nameParts[0] || '',
      lastName: user.lastName || nameParts.slice(1).join(' ') || '',
      password: '',
      isActive: user.isActive ?? true,
      role: (user as any).role?._id || user.role || '',
      email: user.email || '',
      companyId: user.companyId || (user as any).client?._id || (user as any).clientId?._id || (user as any).clientId || '',
    };
  }

  closePanel() {
    this.panelMode = 'none';
    this.tempUser = {
      firstName: '',
      lastName: '',
      email: '',
      role: '',
      password: '',
      isActive: true,
      companyId: '',
    };
  }

  saveUser() {
    if (
      !this.tempUser?.firstName?.trim() ||
      !this.tempUser?.email?.trim() ||
      !this.tempUser?.role?.trim()
    ) {
      this.notification.show(
        'Por favor completa todos los campos obligatorios',
        'error'
      );
      return;
    }

    if (this.userStateService.isSuperAdmin() && !this.tempUser?.companyId) {
      this.notification.show(
        'Por favor selecciona una empresa',
        'error'
      );
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.tempUser.email.trim())) {
      this.notification.show('Por favor ingresa un email válido', 'error');
      return;
    }

    // Validar contraseña para nuevo usuario
    if (this.panelMode === 'create') {
      if (!this.tempUser.password || this.tempUser.password.length < 6) {
        this.notification.show(
          'La contraseña es obligatoria y debe tener al menos 6 caracteres',
          'error'
        );
        return;
      }
    }

    // Validar contraseña en modo edición (solo si se proporciona)
    if (this.panelMode === 'edit' && this.tempUser.password) {
      if (this.tempUser.password.length < 6) {
        this.notification.show(
          'La nueva contraseña debe tener al menos 6 caracteres',
          'error'
        );
        return;
      }
    }

    this.isLoading.set(true);

    if (this.panelMode === 'create') {
      const newUser: any = {
        firstName: this.tempUser.firstName.trim(),
        lastName: this.tempUser.lastName?.trim() || '',
        name: `${this.tempUser.firstName.trim()} ${this.tempUser.lastName?.trim() || ''
          }`.trim(),
        email: this.tempUser.email.trim().toLowerCase(),
        password: this.tempUser.password || 'Temporal123',
        roleId: this.tempUser.role,
        companyId: this.tempUser.companyId,
        clientId: this.tempUser.companyId,
      };

      console.log('Creando usuario con datos:', newUser);

      this.adminUsersService
        .createUser(newUser)
        .pipe(
          catchError((error) => {
            console.error('Error al crear usuario:', error);
            this.notification.show(
              'Error al crear usuario: ' + error.message,
              'error'
            );
            return EMPTY;
          }),
          finalize(() => this.isLoading.set(false))
        )
        .subscribe({
          next: (response) => {
            console.log('Usuario creado exitosamente:', response);
            this.notification.show('Usuario creado correctamente', 'success');
            this.closePanel();
            this.loadUsers();
          },
        });
    } else if (this.panelMode === 'edit' && this.tempUser._id) {
      const updatedUser: IUserUpdate = {
        firstName: this.tempUser.firstName?.trim(),
        lastName: this.tempUser.lastName?.trim(),
        email: this.tempUser.email?.trim().toLowerCase(),
        role: this.tempUser.role,
        isActive: this.tempUser.isActive,
        companyId: this.tempUser.companyId,
      };

      // Corregir para el backend: el backend espera roleId en el create, pero en el update
      // el DTO de UpdateUserDto tiene 'role'. Vamos a asegurar que enviamos el ID.
      const payload: any = { ...updatedUser, clientId: this.tempUser.companyId };
      if (this.tempUser.role) {
        payload.roleId = this.tempUser.role;
      }

      // Solo agregar password si se proporcionó una nueva
      if (this.tempUser.password && this.tempUser.password.trim()) {
        (updatedUser as any).password = this.tempUser.password.trim();
      }

      console.log('Actualizando usuario con datos:', payload);

      this.adminUsersService
        .updateUser(this.tempUser._id, payload)
        .pipe(
          catchError((error) => {
            console.error('Error al actualizar usuario:', error);
            this.notification.show(
              'Error al actualizar usuario: ' + error.message,
              'error'
            );
            return EMPTY;
          }),
          finalize(() => this.isLoading.set(false))
        )
        .subscribe({
          next: (response) => {
            console.log('Usuario actualizado exitosamente:', response);
            this.notification.show(
              'Usuario actualizado correctamente',
              'success'
            );
            this.closePanel();
            this.loadUsers();
          },
        });
    }
  }

  deleteUser(userId: string) {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      this.isLoading.set(true);

      this.adminUsersService
        .deleteUser(userId)
        .pipe(
          catchError((error) => {
            this.notification.show(
              'Error al eliminar usuario: ' + error.message,
              'error'
            );
            return EMPTY;
          }),
          finalize(() => this.isLoading.set(false))
        )
        .subscribe({
          next: () => {
            this.notification.show(
              'Usuario eliminado correctamente',
              'success'
            );
            this.loadUsers();
          },
        });
    }
  }

  clickOptionsEvent(event: { option: string; _id: string }) {
    this.optionsEvent(event);
  }

  optionsEvent(event: { option: string; _id: string }) {
    if (!event || !event.option || !event._id) {
      this.notification.show('Error: Evento inválido', 'error');
      return;
    }

    const user = this.data.find((u) => u._id === event._id);

    if (event.option === 'edit') {
      if (user) {
        this.showEditPanel(user);
      } else {
        this.notification.show('Error: Usuario no encontrado', 'error');
      }
    } else if (event.option === 'delete') {
      this.deleteUser(event._id);
    }
  }
}
