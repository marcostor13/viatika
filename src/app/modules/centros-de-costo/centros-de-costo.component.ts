import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoicesService } from '../invoices/services/invoices.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { UserStateService } from '../../services/user-state.service';
import { IProject } from '../invoices/interfaces/project.interface';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonComponent } from '../../design-system/button/button.component';

interface ProjectForm {
  name: string;
  code: string;
  isActive: boolean;
}

@Component({
  selector: 'app-centros-de-costo',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './centros-de-costo.component.html',
})
export class CentrosDeCostoComponent implements OnInit {
  private invoicesService = inject(InvoicesService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private userStateService = inject(UserStateService);

  projects: IProject[] = [];
  editingProject: IProject | null = null;
  showForm = false;
  loading = false;
  form: ProjectForm = { name: '', code: '', isActive: true };

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    const companyId = this.userStateService.getUser()?.companyId;
    this.invoicesService.getProjects(companyId).subscribe({
      next: (projects) => {
        this.projects = projects;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.notificationService.show('Error al cargar centros de costo: ' + error.message, 'error');
        this.loading = false;
      },
    });
  }

  add() {
    this.showForm = true;
    this.editingProject = null;
    this.form = { name: '', code: '', isActive: true };
  }

  edit(project: IProject) {
    this.showForm = true;
    this.editingProject = project;
    this.form = {
      name: project.name,
      code: project.code ?? '',
      isActive: project.isActive ?? true,
    };
  }

  cancel() {
    this.showForm = false;
    this.editingProject = null;
    this.form = { name: '', code: '', isActive: true };
  }

  save() {
    if (!this.form.name.trim()) {
      this.notificationService.show('El nombre es obligatorio', 'error');
      return;
    }
    const companyId = this.userStateService.getUser()?.companyId || '';
    const payload: Partial<IProject> = {
      name: this.form.name.trim(),
      code: this.form.code.trim() || undefined,
      isActive: this.form.isActive,
    };

    if (this.editingProject) {
      this.invoicesService.updateProject(this.editingProject._id!, payload, companyId).subscribe({
        next: () => {
          this.notificationService.show('Centro de costo actualizado', 'success');
          this.load();
          this.cancel();
        },
        error: (error: HttpErrorResponse) => {
          this.notificationService.show('Error al actualizar: ' + error.message, 'error');
        },
      });
    } else {
      this.invoicesService.createProject({ ...payload, name: this.form.name.trim() } as IProject).subscribe({
        next: () => {
          this.notificationService.show('Centro de costo creado', 'success');
          this.load();
          this.cancel();
        },
        error: (error: HttpErrorResponse) => {
          this.notificationService.show('Error al crear: ' + error.message, 'error');
        },
      });
    }
  }

  delete(project: IProject) {
    this.confirmationService.confirm({
      title: 'Eliminar Centro de Costo',
      message: `¿Eliminar "${project.name}"?`,
      accept: () => {
        const companyId = this.userStateService.getUser()?.companyId || '';
        this.invoicesService.deleteProject(project._id!, companyId).subscribe({
          next: () => {
            this.notificationService.show('Centro de costo eliminado', 'success');
            this.load();
          },
          error: (error: HttpErrorResponse) => {
            this.notificationService.show('Error al eliminar: ' + error.message, 'error');
          },
        });
      },
    });
  }
}
