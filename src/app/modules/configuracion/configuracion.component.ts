import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoicesService } from '../invoices/services/invoices.service';
import { NotificationService } from '../../services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { MaskPipe } from '../../pipes/mask.pipe';
import { ICompanyConfig } from '../../interfaces/company-config.interface';
import { ISunatConfig } from '../../interfaces/sunat-config.interface';
import { CompanyConfigService } from '../../services/company-config.service';
import { UserStateService } from '../../services/user-state.service';
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
  private userStateService = inject(UserStateService);
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

  private getClientId(): string {
    const user = this.userStateService.getUser();
    return (
      (user as { companyId?: string })?.companyId ||
      (user as { client?: { _id: string } })?.client?._id ||
      ''
    );
  }

  loadSunatConfig() {
    const clientId = this.getClientId();
    if (!clientId) return;

    this.invoicesService.getSunatConfig(clientId).subscribe({
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
      this.invoicesService
        .updateSunatConfig({ ...this.sunatForm, _id: this.sunatConfig._id })
        .subscribe({
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
      const clientId = this.getClientId();
      if (!clientId) {
        this.notificationService.show(
          'No se encontró companyId. Inicia sesión nuevamente.',
          'error'
        );
        return;
      }
      this.invoicesService.createSunatConfig(clientId, this.sunatForm).subscribe({
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
      const configId = this.sunatConfig?._id;
      if (!configId) return;

      this.invoicesService.deleteSunatConfig(configId).subscribe({
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
    const clientId = this.getClientId();
    if (!clientId) {
      this.notificationService.show(
        'No se encontró companyId. Inicia sesión nuevamente.',
        'error'
      );
      return;
    }
    this.invoicesService.testSunatCredentials(clientId).subscribe({
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
