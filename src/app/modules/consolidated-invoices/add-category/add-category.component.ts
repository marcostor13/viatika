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
    this.invoicesService.getCategoryById(id).subscribe((category: ICategory) => {
      this.category = category;
      this.router.navigate(['/consolidated-invoices']);
    });
  }

  back() {
    this.router.navigate(['/consolidated-invoices']);
  }

  save() {
    if (this.isEditing) {
      this.updateCategory();
    } else {
      this.saveCategory();
    }
  }

  validateName() {
    if (!this.category.name) {
      this.notificationService.show(
        'El nombre de la categoría es obligatorio',
        'error'
      );
      return false;
    }
    return true;
  }

  saveCategory() {
    if (!this.validateName()) {
      return;
    }
    const createData: ICategory = {
      name: this.category.name,
    };
    this.invoicesService.createCategory(createData).subscribe(() => {
      this.notificationService.show(
        'Categoría creada exitosamente',
        'success'
      );
      this.router.navigate(['/consolidated-invoices']);
    });
  }

  updateCategory() {
    if (!this.validateName()) {
      return;
    }
    const updateData: Partial<ICategory> = {
      name: this.category.name,
    };
    this.invoicesService.updateCategory(this.categoryId!, updateData).subscribe(() => {
      this.notificationService.show('Categoría actualizada exitosamente', 'success');
      this.router.navigate(['/consolidated-invoices']);
    });
  }
}
