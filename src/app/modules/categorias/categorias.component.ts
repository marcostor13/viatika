import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoriaService } from '../../services/categoria.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { ICategory } from '../invoices/interfaces/category.interface';
import { IPaginatedResult } from '../../interfaces/paginated-result.interface';
import { ButtonComponent } from '../../design-system/button/button.component';
import { PaginatorComponent } from '../../design-system/paginator/paginator.component';
import { HttpErrorResponse } from '@angular/common/http';

interface CategoryForm {
  name: string;
  description: string;
  limit: number | null;
  parentId: string | null;
}

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, PaginatorComponent],
  templateUrl: './categorias.component.html',
})
export class CategoriasComponent implements OnInit {
  private categoriaService = inject(CategoriaService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);

  result = signal<IPaginatedResult<ICategory>>({ data: [], total: 0, page: 1, pages: 0, limit: 20 });
  loading = signal(false);
  search = signal('');
  page = signal(1);
  limit = signal(20);

  showForm = signal(false);
  editingId = signal<string | null>(null);
  editingParentId = signal<string | null>(null);
  form: CategoryForm = { name: '', description: '', limit: null, parentId: null };

  expandedIds = signal<Set<string>>(new Set());

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.categoriaService.getAll({
      page: this.page(),
      limit: this.limit(),
      search: this.search() || undefined,
    }).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.notificationService.show('Error al cargar categorías: ' + err.message, 'error');
        this.loading.set(false);
      },
    });
  }

  onSearch(value: string) {
    this.search.set(value);
    this.page.set(1);
    this.load();
  }

  onPageChange(p: number) {
    this.page.set(p);
    this.load();
  }

  onLimitChange(l: number) {
    this.limit.set(l);
    this.page.set(1);
    this.load();
  }

  toggleExpand(id: string) {
    const set = new Set(this.expandedIds());
    if (set.has(id)) set.delete(id); else set.add(id);
    this.expandedIds.set(set);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  openAddCategory() {
    this.form = { name: '', description: '', limit: null, parentId: null };
    this.editingId.set(null);
    this.editingParentId.set(null);
    this.showForm.set(true);
  }

  openAddSubcategory(parentId: string) {
    this.form = { name: '', description: '', limit: null, parentId };
    this.editingId.set(null);
    this.editingParentId.set(parentId);
    this.showForm.set(true);
    const set = new Set(this.expandedIds());
    set.add(parentId);
    this.expandedIds.set(set);
  }

  openEdit(cat: ICategory) {
    this.form = {
      name: cat.name,
      description: cat.description ?? '',
      limit: cat.limit ?? null,
      parentId: cat.parentId ?? null,
    };
    this.editingId.set(cat._id ?? null);
    this.editingParentId.set(cat.parentId ?? null);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingId.set(null);
    this.editingParentId.set(null);
    this.form = { name: '', description: '', limit: null, parentId: null };
  }

  save() {
    if (!this.form.name.trim()) {
      this.notificationService.show('El nombre es obligatorio', 'error');
      return;
    }
    const id = this.editingId();
    if (id) {
      this.categoriaService.update(id, {
        name: this.form.name,
        description: this.form.description || undefined,
        limit: this.form.limit,
      }).subscribe({
        next: () => {
          this.notificationService.show('Categoría actualizada', 'success');
          this.closeForm();
          this.load();
        },
        error: (err: HttpErrorResponse) => this.notificationService.show('Error: ' + err.message, 'error'),
      });
    } else {
      this.categoriaService.create({
        name: this.form.name,
        description: this.form.description || undefined,
        limit: this.form.limit,
        parentId: this.form.parentId,
      }).subscribe({
        next: () => {
          this.notificationService.show(this.form.parentId ? 'Subcategoría creada' : 'Categoría creada', 'success');
          this.closeForm();
          this.load();
        },
        error: (err: HttpErrorResponse) => this.notificationService.show('Error: ' + err.message, 'error'),
      });
    }
  }

  remove(cat: ICategory) {
    const hasChildren = (cat.children?.length ?? 0) > 0;
    const msg = hasChildren
      ? `¿Eliminar "${cat.name}" y sus ${cat.children!.length} subcategoría(s)?`
      : `¿Eliminar "${cat.name}"?`;
    this.confirmationService.confirm({
      title: 'Eliminar categoría',
      message: msg,
      accept: () => {
        this.categoriaService.remove(cat._id!).subscribe({
          next: () => {
            this.notificationService.show('Categoría eliminada', 'success');
            this.load();
          },
          error: (err: HttpErrorResponse) => this.notificationService.show('Error: ' + err.message, 'error'),
        });
      },
    });
  }

  removeSubcategory(sub: ICategory) {
    this.confirmationService.confirm({
      title: 'Eliminar subcategoría',
      message: `¿Eliminar "${sub.name}"?`,
      accept: () => {
        this.categoriaService.remove(sub._id!).subscribe({
          next: () => {
            this.notificationService.show('Subcategoría eliminada', 'success');
            this.load();
          },
          error: (err: HttpErrorResponse) => this.notificationService.show('Error: ' + err.message, 'error'),
        });
      },
    });
  }

  get formTitle(): string {
    if (this.editingId()) return 'Editar categoría';
    return this.editingParentId() ? 'Nueva subcategoría' : 'Nueva categoría';
  }
}
