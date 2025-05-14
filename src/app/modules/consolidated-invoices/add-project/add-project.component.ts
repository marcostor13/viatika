import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '../../../services/notification.service';
import { InvoicesService } from '../../invoices/services/invoices.service';
import { HttpErrorResponse } from '@angular/common/http';
import { IProject } from '../../invoices/interfaces/project.interface';

@Component({
  selector: 'app-add-project',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-project.component.html',
})
export class AddProjectComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private notificationService = inject(NotificationService);
  private invoicesService = inject(InvoicesService);

  project: IProject = {
    name: '',
  };

  projectId: string | null = null;
  isEditing = false;

  ngOnInit() {
    // Verificar si estamos en modo edición
    this.projectId = this.route.snapshot.paramMap.get('id');
    if (this.projectId) {
      this.isEditing = true;
      this.loadProject(this.projectId);
    }
  }

  loadProject(id: string) {
    this.invoicesService.getProjectById(id).subscribe({
      next: (project: IProject) => {
        this.project = project;
      },
      error: (error: HttpErrorResponse) => {
        this.notificationService.show(
          'Error al cargar el proyecto: ' + error.message,
          'error'
        );
        this.router.navigate(['/consolidated-invoices']);
      },
    });
  }

  back() {
    this.router.navigate(['/consolidated-invoices']);
  }

  saveProject() {
    if (!this.project.name) {
      this.notificationService.show(
        'El nombre del proyecto es obligatorio',
        'error'
      );
      return;
    }

    if (!this.isEditing) {
      // Crear nuevo proyecto
      const createData: IProject = {
        name: this.project.name,
      };

      this.invoicesService.createProject(createData).subscribe({
        next: () => {
          this.notificationService.show(
            'Proyecto creado exitosamente',
            'success'
          );
          this.router.navigate(['/consolidated-invoices']);
        },
        error: (error: HttpErrorResponse) => {
          this.notificationService.show(
            'Error al crear proyecto: ' + error.message,
            'error'
          );
        },
      });
    } else {
      // Estamos en modo edición
      const updateData: Partial<IProject> = {
        name: this.project.name,
      };

      this.invoicesService
        .updateProject(this.projectId!, updateData)
        .subscribe({
          next: () => {
            this.notificationService.show(
              'Proyecto actualizado exitosamente',
              'success'
            );
            this.router.navigate(['/consolidated-invoices']);
          },
          error: (error: HttpErrorResponse) => {
            this.notificationService.show(
              'Error al actualizar proyecto: ' + error.message,
              'error'
            );
          },
        });
    }
  }
}
