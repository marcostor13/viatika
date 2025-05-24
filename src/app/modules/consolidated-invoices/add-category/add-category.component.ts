import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '../../../services/notification.service';
import { InvoicesService } from '../../invoices/services/invoices.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ICategory } from '../../invoices/interfaces/category.interface';
import { UserStateService } from '../../../services/user-state.service';

@Component({
  selector: 'app-add-category',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-category.component.html',
})
export class AddCategoryComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private notificationService = inject(NotificationService);
  private invoicesService = inject(InvoicesService);
  private userStateService = inject(UserStateService);

  category: ICategory = {
    name: '',
  };

  categoryId: string | null = null;
  isEditing = false;

  ngOnInit() {
    this.categoryId = this.route.snapshot.paramMap.get('id');
    if (this.categoryId) {
      this.isEditing = true;
      this.loadCategory(this.categoryId);
    }
  }

  loadCategory(id: string) {
    const companyId = this.userStateService.getUser()?.companyId;
    if (companyId) {
      this.invoicesService.getCategoryById(id, companyId).subscribe({
        next: (category: ICategory) => {
          this.category = category;
        },
        error: (error: HttpErrorResponse) => {
          this.notificationService.show(
            'Error al cargar la categoría: ' + error.message,
            'error'
          );
          this.router.navigate(['/consolidated-invoices']);
        },
      });
    }
  }

  back() {
    this.router.navigate(['/consolidated-invoices']);
  }

  saveCategory() {
    if (!this.category.name) {
      this.notificationService.show(
        'El nombre de la categoría es obligatorio',
        'error'
      );
      return;
    }

    const companyId = this.userStateService.getUser()?.companyId;
    if (!companyId) {
      this.notificationService.show(
        'No se encontró companyId en el usuario',
        'error'
      );
      return;
    }
    this.category.companyId = companyId;

    if (!this.isEditing) {
      this.invoicesService.createCategory(this.category).subscribe({
        next: () => {
          this.notificationService.show(
            'Categoría creada exitosamente',
            'success'
          );
          this.router.navigate(['/consolidated-invoices']);
        },
        error: (error: HttpErrorResponse) => {
          this.notificationService.show(
            'Error al crear categoría: ' + error.message,
            'error'
          );
        },
      });
    } else {
      const updateData: Partial<ICategory> = {
        name: this.category.name,
      };

      this.invoicesService
        .updateCategory(this.categoryId!, updateData)
        .subscribe({
          next: () => {
            this.notificationService.show(
              'Categoría actualizada exitosamente',
              'success'
            );
            this.router.navigate(['/consolidated-invoices']);
          },
          error: (error: HttpErrorResponse) => {
            this.notificationService.show(
              'Error al actualizar categoría: ' + error.message,
              'error'
            );
          },
        });
    }
  }
}
