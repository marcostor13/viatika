import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoicesService } from '../invoices/services/invoices.service';
import { NotificationService } from '../../services/notification.service';
import { ICategory } from '../invoices/interfaces/category.interface';
import { IProject } from '../invoices/interfaces/project.interface';
import { HttpErrorResponse } from '@angular/common/http';
import { MaskPipe } from '../../pipes/mask.pipe';
import { ICompanyConfig } from '../../interfaces/company-config.interface';
import { ISunatConfig } from '../../interfaces/sunat-config.interface';
import { CompanyConfigService } from '../../services/company-config.service';
import { ButtonComponent } from '../../design-system/button/button.component';

@Component({
  selector: 'app-configuracion',
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MaskPipe, ButtonComponent],
})
export class ConfiguracionComponent implements OnInit {
  private invoicesService = inject(InvoicesService);
  private notificationService = inject(NotificationService);
  private companyConfigService = inject(CompanyConfigService);
  categories: ICategory[] = [];
  newCategory: ICategory = { name: '' };
  editingCategory: ICategory | null = null;
  showCategoryForm = false;
  projects: IProject[] = [];
  newProject: IProject = { name: '' };
  editingProject: IProject | null = null;
  showProjectForm = false;
  companyConfig: ICompanyConfig | null = null;
  showCompanyForm = false;
  selectedLogoFile: File | null = null;
  logoPreview: string | null = null;
  companyName: string = '';
  logoUploadProgress: number = 0;
  isUploadingLogo: boolean = false;
  sunatConfig: ISunatConfig | null = null;
  showSunatForm = false;
  sunatForm: Partial<ISunatConfig> = {
    clientId: '',
    clientSecret: '',
    ruc: '',
    isActive: true,
  };

  loading = false;

  ngOnInit() {
    this.loadCategories();
    this.loadProjects();
    this.loadCompanyConfig();
    this.loadSunatConfig();
  }

  loadCompanyConfig() {
    this.companyConfigService.companyConfig$.subscribe(
      (config: ICompanyConfig | null) => {
        this.companyConfig = config;
      }
    );
  }

  editCompanyConfig() {
    this.showCompanyForm = true;
    this.companyName = this.companyConfig?.businessName || '';
  }

  cancelCompanyEdit() {
    this.showCompanyForm = false;
    this.selectedLogoFile = null;
    this.logoPreview = null;
    this.companyName = '';
  }

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedLogoFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.logoPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  saveCompanyConfig() {
    if (!this.companyName?.trim()) {
      this.notificationService.show(
        'El nombre de la empresa es obligatorio',
        'error'
      );
      return;
    }

    this.companyConfigService.updateCompanyName(this.companyName).subscribe({
      next: () => {
        this.notificationService.show(
          'Nombre de empresa actualizado exitosamente',
          'success'
        );
        this.companyConfigService.refreshConfig();
        if (this.selectedLogoFile) {
          this.uploadLogo();
        } else {
          this.cancelCompanyEdit();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.notificationService.show(
          'Error al actualizar nombre de empresa: ' + error.message,
          'error'
        );
      },
    });
  }

  private uploadLogo() {
    if (!this.selectedLogoFile) return;

    this.isUploadingLogo = true;
    this.logoUploadProgress = 0;

    this.companyConfigService
      .uploadCompanyLogo(this.selectedLogoFile, this.companyConfig?._id!)
      .subscribe({
        next: (result) => {
          if (result.type === 'progress' && result.progress !== undefined) {
            this.logoUploadProgress = Math.round(result.progress);
          } else if (result.type === 'complete') {
            this.notificationService.show(
              'Logo de empresa actualizado exitosamente',
              'success'
            );
            this.isUploadingLogo = false;
            this.logoUploadProgress = 0;
            this.cancelCompanyEdit();
            this.companyConfigService.refreshConfig();
          } else if (result.type === 'error') {
            this.notificationService.show('Error al subir logo', 'error');
            this.isUploadingLogo = false;
            this.logoUploadProgress = 0;
          }
        },
        error: (error: HttpErrorResponse) => {
          this.notificationService.show(
            'Error al subir logo: ' + error.message,
            'error'
          );
          this.isUploadingLogo = false;
          this.logoUploadProgress = 0;
        },
      });
  }

  loadCategories() {
    this.invoicesService.getCategories().subscribe((categories) => {
      this.categories = categories;
    });
  }

  addCategory() {
    this.showCategoryForm = true;
    this.editingCategory = null;
    this.newCategory = { name: '' };
  }

  editCategory(category: ICategory) {
    this.showCategoryForm = true;
    this.editingCategory = { ...category };
    this.newCategory = { ...category };
  }

  cancelCategoryEdit() {
    this.showCategoryForm = false;
    this.editingCategory = null;
    this.newCategory = { name: '' };
  }

  validateName() {
    if (!this.newCategory.name) {
      this.notificationService.show(
        'El nombre de la categoría es obligatorio',
        'error'
      );
      return false;
    }
    return true;
  }

  save() {
    if (!this.validateName()) {
      return;
    }
    if (this.editingCategory) {
      this.updateCategory();
    } else {
      this.saveCategory();
    }
  }

  saveCategory() {
    this.invoicesService.createCategory(this.newCategory).subscribe(() => {
      this.notificationService.show('Categoría creada exitosamente', 'success');
      this.loadCategories();
      this.cancelCategoryEdit();
    });
  }

  updateCategory() {
    this.invoicesService
      .updateCategory(this.editingCategory?._id!, {
        name: this.newCategory.name,
      })
      .subscribe(() => {
        this.notificationService.show(
          'Categoría actualizada exitosamente',
          'success'
        );
        this.loadCategories();
        this.cancelCategoryEdit();
      });
  }

  deleteCategory(category: ICategory) {
    if (
      confirm(
        `¿Estás seguro de que quieres eliminar la categoría "${category.name}"?`
      )
    ) {
      this.invoicesService.deleteCategory(category._id!).subscribe(() => {
        this.notificationService.show(
          'Categoría eliminada exitosamente',
          'success'
        );
        this.loadCategories();
      });
    }
  }

  loadProjects() {
    this.invoicesService.getProjects().subscribe((projects) => {
      this.projects = projects;
    });
  }

  addProject() {
    this.showProjectForm = true;
    this.editingProject = null;
    this.newProject = { name: '' };
  }

  editProject(project: IProject) {
    this.showProjectForm = true;
    this.editingProject = { ...project };
    this.newProject = { ...project };
  }

  cancelProjectEdit() {
    this.showProjectForm = false;
    this.editingProject = null;
    this.newProject = { name: '' };
  }

  validateProjectName() {
    if (!this.newProject.name?.trim()) {
      this.notificationService.show(
        'El nombre del proyecto es obligatorio',
        'error'
      );
      return false;
    }
    return true;
  }

  saveProject() {
    if (!this.validateProjectName()) {
      return;
    }

    if (this.editingProject) {
      this.invoicesService
        .updateProject(this.editingProject._id!, { name: this.newProject.name })
        .subscribe(() => {
          this.notificationService.show(
            'Proyecto actualizado exitosamente',
            'success'
          );
          this.loadProjects();
          this.cancelProjectEdit();
        });
    } else {
      this.invoicesService.createProject(this.newProject).subscribe(() => {
        this.notificationService.show(
          'Proyecto creado exitosamente',
          'success'
        );
        this.loadProjects();
        this.cancelProjectEdit();
      });
    }
  }

  deleteProject(project: IProject) {
    if (
      confirm(
        `¿Estás seguro de que quieres eliminar el proyecto "${project.name}"?`
      )
    ) {
      this.invoicesService.deleteProject(project._id!).subscribe(() => {
        this.notificationService.show(
          'Proyecto eliminado exitosamente',
          'success'
        );
        this.loadProjects();
      });
    }
  }

  loadSunatConfig() {
    this.invoicesService.getSunatConfig().subscribe({
      next: (config) => {
        this.sunatConfig = config;
      },
      error: (error: HttpErrorResponse) => {
        if (error.status !== 404) {
          this.notificationService.show(
            'Error al cargar configuración SUNAT: ' + error.message,
            'error'
          );
        }
      },
    });
  }

  editSunatConfig() {
    this.showSunatForm = true;
    if (this.sunatConfig) {
      this.sunatForm = {
        _id: this.sunatConfig._id,
        ruc: this.sunatConfig.ruc,
        clientIdSunat: this.sunatConfig.clientIdSunat,
        clientSecret: this.sunatConfig.clientSecret,
        isActive: this.sunatConfig.isActive,
      };
    } else {
      this.sunatForm = {
        ruc: '',
        clientIdSunat: '',
        clientSecret: '',
        isActive: true,
      };
    }
  }

  cancelSunatEdit() {
    this.showSunatForm = false;
    this.sunatForm = {
      clientIdSunat: '',
      clientSecret: '',
      isActive: true,
    };
  }

  saveSunatConfig() {
    if (
      !this.sunatForm.clientIdSunat?.trim() ||
      !this.sunatForm.clientSecret?.trim()
    ) {
      this.notificationService.show(
        'El Client ID y Client Secret son obligatorios',
        'error'
      );
      return;
    }

    if (this.sunatConfig) {
      this.invoicesService.updateSunatConfig(this.sunatForm).subscribe({
        next: (config) => {
          this.sunatConfig = config;
          this.notificationService.show(
            'Configuración SUNAT actualizada exitosamente',
            'success'
          );
          this.cancelSunatEdit();
        },
        error: (error: HttpErrorResponse) => {
          this.notificationService.show(
            'Error al actualizar configuración SUNAT: ' + error.message,
            'error'
          );
        },
      });
    } else {
      this.invoicesService.createSunatConfig(this.sunatForm).subscribe({
        next: (config) => {
          this.sunatConfig = config;
          this.notificationService.show(
            'Configuración SUNAT creada exitosamente',
            'success'
          );
          this.cancelSunatEdit();
        },
        error: (error: HttpErrorResponse) => {
          this.notificationService.show(
            'Error al crear configuración SUNAT: ' + error.message,
            'error'
          );
        },
      });
    }
  }

  deleteSunatConfig() {
    if (
      confirm(
        '¿Estás seguro de que quieres eliminar la configuración de SUNAT?'
      )
    ) {
      this.invoicesService.deleteSunatConfig().subscribe({
        next: () => {
          this.sunatConfig = null;
          this.notificationService.show(
            'Configuración SUNAT eliminada exitosamente',
            'success'
          );
        },
        error: (error: HttpErrorResponse) => {
          this.notificationService.show(
            'Error al eliminar configuración SUNAT: ' + error.message,
            'error'
          );
        },
      });
    }
  }

  testSunatConnection() {
    this.invoicesService.testSunatCredentials().subscribe({
      next: (result) => {
        this.loadSunatConfig();
        if (result.success) {
          this.notificationService.show(
            'Conexión SUNAT exitosa: ' + result.message,
            'success'
          );
        } else {
          this.notificationService.show(
            'Error en conexión SUNAT: ' + result.message,
            'error'
          );
        }
      },
      error: (error: HttpErrorResponse) => {
        this.notificationService.show(
          'Error al probar conexión SUNAT: ' + error.message,
          'error'
        );
      },
    });
  }
}
