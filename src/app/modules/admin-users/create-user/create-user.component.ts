import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminUsersService } from '../services/admin-users.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import {
  IRoleResponse,
  IUserResponse,
} from '../../../interfaces/user.interface';
import { NotificationService } from '../../../services/notification.service';
import { UserStateService } from '../../../services/user-state.service';
import { ERoles } from '../interfaces/roles.enum';

@Component({
  imports: [CommonModule, ReactiveFormsModule],
  selector: 'app-create-user',
  templateUrl: './create-user.component.html',
  styleUrls: ['./create-user.component.scss'],
  standalone: true,
})
export class CreateUserComponent {
  private router: Router = inject(Router);
  private formBuilder: FormBuilder = inject(FormBuilder);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private adminUsersService: AdminUsersService = inject(AdminUsersService);
  private notificationService: NotificationService =
    inject(NotificationService);
  private userStateService: UserStateService = inject(UserStateService);
  id: string = this.route.snapshot.params['id'];
  form: FormGroup = this.formBuilder.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    roleId: ['', Validators.required],
    password: [''],
  });
  roles: IRoleResponse[] = [];
  enumRoles = ERoles;

  ngOnInit() {
    if (this.id) {
      this.getUser();
    }
    this.getRoles();
  }

  getRoleName(roleId: string) {
    return this.enumRoles[
      this.roles.find((role) => role._id === roleId)
        ?.name as keyof typeof ERoles
    ];
  }

  getRoles() {
    this.adminUsersService.getRoles().subscribe((roles) => {
      this.roles = roles;
    });
  }

  back() {
    this.router.navigate(['/admin-users']);
  }

  assignUser(user: IUserResponse) {
    this.form.patchValue({
      name: user.name,
      email: user.email,
      roleId: user.role._id,
    });
  }

  getUser() {
    this.adminUsersService.getUser(this.id).subscribe((user) => {
      this.assignUser(user);
    });
  }

  createUser() {
    if (this.form.valid) {
      this.adminUsersService.createUser(this.form.value).subscribe((user) => {
        this.notificationService.show(
          'Usuario creado correctamente',
          'success'
        );
        this.router.navigate(['/admin-users']);
      });
    }
  }

  updateUser() {
    if (this.form.valid) {
      const updateData = { ...this.form.value };
      delete updateData.password;

      this.adminUsersService
        .updateUser(this.id, updateData)
        .subscribe((user) => {
          this.notificationService.show(
            'Usuario editado correctamente',
            'success'
          );

          const currentUser = this.userStateService.getUser();
          if (currentUser && currentUser._id === this.id) {
            this.userStateService.setUser({ ...currentUser, name: user.name });
          }
        });
    }
  }

  get name() {
    return this.form.get('name');
  }

  get email() {
    return this.form.get('email');
  }

  get roleId() {
    return this.form.get('roleId');
  }

  get password() {
    return this.form.get('password');
  }
}
