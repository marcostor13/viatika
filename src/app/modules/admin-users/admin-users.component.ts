import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { AdminUsersService } from './services/admin-users.service';
import { IUserResponse } from '../../interfaces/user.interface';
import { NotificationService } from '../../services/notification.service';
import { ERoles } from './interfaces/roles.enum';
import { Router } from '@angular/router';
import { DataComponent } from '../../components/data/data.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, DataComponent],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
})
export default class AdminUsersComponent implements OnInit {

  private router: Router = inject(Router);
  private adminUsersService: AdminUsersService = inject(AdminUsersService);
  private notification: NotificationService = inject(NotificationService);

  headers: IHeaderList[] = [
    { header: 'Nombre', value: 'name' },
    { header: 'Email', value: 'email' },
    { header: 'Rol', value: 'roleName' },
    { header: 'Acciones', value: 'actions', options: ['edit', 'delete'] },
  ];
  users: IUserResponse[] = [];
  roles: { key: string, value: string }[] = [
    { key: 'Admin', value: 'Administrador' },
    { key: 'User', value: 'Colaborador' }
  ];

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.adminUsersService.getUsers().subscribe((users) => {
      this.users = this.assignUser(users);
    })
  }

  assignUser(users: IUserResponse[]) {
    return users.map((user) => {
      return {
        ...user,
        roleName: ERoles[user.role.name as keyof typeof ERoles],
        roleKey: user.role.name,
      };
    });
  }

  deleteUser(userId: string) {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {

      this.adminUsersService.deleteUser(userId).subscribe({
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
    if (event.option === 'edit') {
      this.redirectToCreateUser(event._id);
    } else if (event.option === 'delete') {
      this.deleteUser(event._id);
    }
  }

  redirectToCreateUser(userId: string = '') {
    const path = userId ? `/${userId}` : '';
    this.router.navigate([`/admin-users/create-user${path}`]);
  }

}
