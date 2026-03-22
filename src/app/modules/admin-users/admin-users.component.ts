import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { AdminUsersService } from './services/admin-users.service';
import { IUserResponse } from '../../interfaces/user.interface';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { UserStateService } from '../../services/user-state.service';
import { ERoles } from './interfaces/roles.enum';
import { Router } from '@angular/router';
import { DataComponent } from '../../components/data/data.component';
import { ButtonComponent } from '../../design-system/button/button.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, DataComponent, ButtonComponent],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
})
export default class AdminUsersComponent implements OnInit {
  readonly router = inject(Router);
  private adminUsersService = inject(AdminUsersService);
  private notification = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private userStateService = inject(UserStateService);

  headers: IHeaderList[] = [
    { header: 'Nombre', value: 'name' },
    { header: 'Email', value: 'email' },
    { header: 'Rol', value: 'roleName' },
    { header: 'Estado', value: 'isActive' },
    { header: 'Acciones', value: 'actions', options: ['view', 'edit', 'delete', 'activate'] },
  ];

  allUsers: IUserResponse[] = [];
  filteredUsers: IUserResponse[] = [];

  searchText = '';
  filterRole = '';
  filterStatus = '';

  readonly roleOptions = [
    { value: 'Administrador', label: 'Administrador' },
    { value: 'Colaborador', label: 'Colaborador' },
  ];

  get loggedInUserId(): string {
    return this.userStateService.getUser()?._id || '';
  }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.adminUsersService.getUsers().subscribe((users) => {
      this.allUsers = users.map((user) => ({
        ...user,
        roleName: ERoles[user.role.name as keyof typeof ERoles] ?? user.role.name,
        roleKey: user.role.name,
      }));
      this.applyFilters();
    });
  }

  applyFilters() {
    let result = this.allUsers;

    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase();
      result = result.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }

    if (this.filterRole) {
      result = result.filter((u) => u.role.name === this.filterRole);
    }

    if (this.filterStatus !== '') {
      const active = this.filterStatus === 'active';
      result = result.filter((u) => u.isActive === active);
    }

    this.filteredUsers = result;
  }

  clearFilters() {
    this.searchText = '';
    this.filterRole = '';
    this.filterStatus = '';
    this.applyFilters();
  }

  get hasActiveFilters(): boolean {
    return !!(this.searchText || this.filterRole || this.filterStatus);
  }

  deleteUser(userId: string) {
    if (userId === this.loggedInUserId) {
      this.notification.show('No puedes eliminar tu propio usuario', 'error');
      return;
    }
    this.confirmationService.show('¿Estás seguro de que deseas eliminar este usuario?', () => {
      this.adminUsersService.deleteUser(userId).subscribe({
        next: () => {
          this.notification.show('Usuario eliminado correctamente', 'success');
          this.loadUsers();
        },
        error: () => this.notification.show('Error al eliminar el usuario', 'error'),
      });
    });
  }

  clickOptionsEvent(event: { option: string; _id: string }) {
    switch (event.option) {
      case 'view':   this.router.navigate([`/admin-users/${event._id}/details`]); break;
      case 'edit':   this.redirectToCreateUser(event._id); break;
      case 'delete': this.deleteUser(event._id); break;
      case 'activate': this.toggleUserActive(event._id); break;
    }
  }

  toggleUserActive(userId: string) {
    const user = this.allUsers.find((u) => u._id === userId);
    if (!user) return;
    const newState = !user.isActive;
    this.adminUsersService.updateUser(userId, { isActive: newState }).subscribe({
      next: () => {
        this.notification.show(
          newState ? 'Usuario activado correctamente' : 'Usuario desactivado correctamente',
          'success'
        );
        this.loadUsers();
      },
      error: () => this.notification.show('Error al actualizar el estado del usuario', 'error'),
    });
  }

  redirectToCreateUser(userId = '') {
    const path = userId ? `/${userId}` : '';
    this.router.navigate([`/admin-users/create-user${path}`]);
  }
}
