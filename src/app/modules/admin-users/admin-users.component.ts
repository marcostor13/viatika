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
} from '../../interfaces/user.interface';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';
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
    { header: 'Rol', value: 'role' },
    { header: 'Acciones', value: 'actions', options: ['edit', 'delete'] },
  ];
  data: IUserResponse[] = [];

  panelMode: 'none' | 'create' | 'edit' = 'none';
  tempUser: Partial<IUser> = {};
  isLoading = signal(false);

  constructor(
    private adminUsersService: AdminUsersService,
    private notification: NotificationService
  ) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.isLoading.set(true);

    this.adminUsersService
      .getUsers()
      .pipe(
        catchError((error) => {
          this.notification.show(
            'Error al cargar usuarios: ' + error.message,
            'error'
          );
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe((users) => {
        this.data = users.map((user) => {
          const displayUser = {
            ...user,
            name: user.name || `${user.firstName} ${user.lastName}`,
            isVisible: false,
          };
          return displayUser;
        });

        console.log('Usuarios cargados:', this.data);
      });
  }

  showCreatePanel() {
    this.panelMode = 'create';
    const currentUser = this.adminUsersService['userStateService'].getUser();

    this.tempUser = {
      firstName: '',
      lastName: '',
      email: '',
      role: '',
      password: '',
      isActive: true,
      companyId: currentUser?.companyId,
    };

    console.log(
      'Creando nuevo usuario para companyId:',
      currentUser?.companyId
    );
  }

  showEditPanel(user: IUserResponse) {
    this.panelMode = 'edit';
    this.tempUser = {
      ...user,
      firstName: user.firstName || user.name?.split(' ')[0] || '',
      lastName: user.lastName || user.name?.split(' ')[1] || '',
      password: '', // No mostrar la contraseña existente
    };
  }

  closePanel() {
    this.panelMode = 'none';
    this.tempUser = {};
  }

  saveUser() {
    if (
      !this.tempUser.firstName ||
      !this.tempUser.email ||
      !this.tempUser.role
    ) {
      this.notification.show(
        'Por favor completa todos los campos obligatorios',
        'error'
      );
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.tempUser.email)) {
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
      const newUser: IUserCreate = {
        firstName: this.tempUser.firstName.trim(),
        lastName: this.tempUser.lastName?.trim() || '',
        email: this.tempUser.email.trim().toLowerCase(),
        password: this.tempUser.password || 'Temporal123',
        role: this.tempUser.role,
        companyId: this.tempUser.companyId,
      };

      console.log('Creando usuario con datos:', newUser);

      this.adminUsersService
        .createUser(newUser as IUser)
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

      // Solo agregar password si se proporcionó una nueva
      if (this.tempUser.password && this.tempUser.password.trim()) {
        (updatedUser as any).password = this.tempUser.password.trim();
      }

      console.log('Actualizando usuario con datos:', updatedUser);

      this.adminUsersService
        .updateUser(this.tempUser._id, updatedUser as Partial<IUser>)
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
    const user = this.data.find((u) => u._id === event._id);

    if (event.option === 'edit' && user) {
      this.showEditPanel(user);
    } else if (event.option === 'delete') {
      this.deleteUser(event._id);
    }
  }
}
