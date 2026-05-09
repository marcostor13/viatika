import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminUsersService } from '../services/admin-users.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../design-system/button/button.component';
import {
  IRoleResponse,
  IUserResponse,
  IUser,
} from '../../../interfaces/user.interface';
import { NotificationService } from '../../../services/notification.service';
import { UserStateService } from '../../../services/user-state.service';
import { ERoles } from '../interfaces/roles.enum';

@Component({
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent],
  selector: 'app-create-user',
  templateUrl: './create-user.component.html',
  styleUrls: ['./create-user.component.scss'],
  standalone: true,
})
export class CreateUserComponent implements OnInit {
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
    dni: [''],
    employeeCode: [''],
    area: [''],
    cargo: [''],
    address: [''],
    phone: [''],
    coordinatorId: [''],
  });
  roles: IRoleResponse[] = [];
  enumRoles = ERoles;
  coordinatorCandidates: IUserResponse[] = [];
  temporaryPassword: string = '';
  showPasswordModal: boolean = false;
  passwordCopied: boolean = false;

  ngOnInit() {
    this.loadCoordinatorCandidates();
    if (this.id) {
      this.getUser();
    }
    this.getRoles();
  }

  loadCoordinatorCandidates(): void {
    this.adminUsersService.getUsers().subscribe({
      next: (users) => {
        const exclude = this.id;
        this.coordinatorCandidates = users.filter((u) => {
          if (!u.isActive) return false;
          if (exclude && u._id === exclude) return false;
          const roleName = u.role?.name;
          return (
            roleName === 'Administrador' ||
            roleName === 'Coordinador' ||
            u.permissions?.canApproveL1 === true ||
            u.permissions?.canApproveL2 === true
          );
        });
      },
      error: () => {
        this.coordinatorCandidates = [];
      },
    });
  }

  get selectedRoleIsCollaborador(): boolean {
    const rid = this.form.get('roleId')?.value;
    const r = this.roles.find((x) => x._id === rid);
    return r?.name === 'Colaborador';
  }

  private coordinatorIdFromUser(user: IUserResponse): string {
    const c = user.coordinatorId;
    if (!c) return '';
    return typeof c === 'object' && c !== null && '_id' in c ? c._id : String(c);
  }

  getRoleName(roleId: string) {
    return this.enumRoles[
      this.roles.find((role) => role._id === roleId)
        ?.name as keyof typeof ERoles
    ];
  }

  readonly allowedRoles = ['Administrador', 'Colaborador', 'Contabilidad', 'Coordinador'];

  getRoles() {
    this.adminUsersService.getRoles().subscribe((roles) => {
      this.roles = roles.filter((r) => this.allowedRoles.includes(r.name));
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
      dni: user.dni || '',
      employeeCode: user.employeeCode || '',
      area: user.area || '',
      cargo: user.cargo || '',
      address: user.address || '',
      phone: user.phone || '',
      coordinatorId: this.coordinatorIdFromUser(user),
    });
  }

  getUser() {
    this.adminUsersService.getUser(this.id).subscribe((user) => {
      this.assignUser(user);
    });
  }

  createUser() {
    if (this.form.valid) {
      const raw = this.form.value as IUser & { coordinatorId?: string };
      const payload = { ...raw } as IUser & { coordinatorId?: string };
      if (!this.selectedRoleIsCollaborador || !raw.coordinatorId?.trim()) {
        delete payload.coordinatorId;
      }
      this.adminUsersService.createUser(payload).subscribe((res) => {
        this.temporaryPassword = res.temporaryPassword;
        this.showPasswordModal = true;
      });
    }
  }

  copyPassword() {
    navigator.clipboard.writeText(this.temporaryPassword).then(() => {
      this.passwordCopied = true;
      setTimeout(() => (this.passwordCopied = false), 2000);
    });
  }

  closePasswordModal() {
    this.showPasswordModal = false;
    this.router.navigate(['/admin-users']);
  }

  updateUser() {
    if (this.form.valid) {
      const updateData = { ...this.form.value } as Record<string, unknown>;
      delete updateData['password'];

      if (!this.selectedRoleIsCollaborador) {
        delete updateData['coordinatorId'];
      } else if (!updateData['coordinatorId']) {
        updateData['coordinatorId'] = null;
      }

      this.adminUsersService
        .updateUser(this.id, updateData as Partial<IUser>)
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
}
