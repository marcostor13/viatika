import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import { environment } from '../../../environments/environment';
import { InvoicesService } from '../invoices/services/invoices.service';
import { UploadService } from '../../services/upload.service';
import { NotificationService } from '../../services/notification.service';
import { ISunatConfig } from '../../interfaces/sunat-config.interface';

interface IClientRow {
  _id: string;
  comercialName: string;
  businessName: string;
  businessId: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  // ui
  expanded: boolean;
  sunatConfig: ISunatConfig | null;
  sunatLoaded: boolean;
  sunatLoading: boolean;
  editing: boolean;
  editForm: { comercialName: string; businessName: string; businessId: string; address: string; phone: string; email: string };
  logoFile: File | null;
  logoPreview: string | null;
  uploadingLogo: boolean;
  saving: boolean;
  showSunatForm: boolean;
  sunatForm: { ruc: string; clientIdSunat: string; clientSecret: string; isActive: boolean };
  savingSunat: boolean;
  testingConnection: boolean;
}

@Component({
  selector: 'app-clients-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clients-admin.component.html',
  styleUrl: './clients-admin.component.scss',
})
export class ClientsAdminComponent implements OnInit {
  private http = inject(HttpClient);
  private location = inject(Location);
  private invoicesService = inject(InvoicesService);
  private uploadService = inject(UploadService);
  private notificationService = inject(NotificationService);

  clients: IClientRow[] = [];
  loading = false;

  ngOnInit(): void {
    this.loadClients();
  }

  goBack(): void {
    this.location.back();
  }

  loadClients(): void {
    this.loading = true;
    this.http.get<any[]>(`${environment.api}/client`).subscribe({
      next: (clients) => {
        this.loading = false;
        this.clients = (clients || []).map((c) => this.toRow(c));
      },
      error: () => {
        this.loading = false;
        this.notificationService.show('Error al cargar empresas', 'error');
      },
    });
  }

  private toRow(c: any): IClientRow {
    return {
      _id: c._id,
      comercialName: c.comercialName || '',
      businessName: c.businessName || '',
      businessId: c.businessId || '',
      address: c.address || '',
      phone: c.phone || '',
      email: c.email || '',
      logo: c.logo || '',
      expanded: false,
      sunatConfig: null,
      sunatLoaded: false,
      sunatLoading: false,
      editing: false,
      editForm: { comercialName: '', businessName: '', businessId: '', address: '', phone: '', email: '' },
      logoFile: null,
      logoPreview: null,
      uploadingLogo: false,
      saving: false,
      showSunatForm: false,
      sunatForm: { ruc: '', clientIdSunat: '', clientSecret: '', isActive: true },
      savingSunat: false,
      testingConnection: false,
    };
  }

  toggleExpand(row: IClientRow): void {
    row.expanded = !row.expanded;
    if (row.expanded && !row.sunatLoaded) {
      this.loadSunat(row);
    }
  }

  private loadSunat(row: IClientRow): void {
    row.sunatLoading = true;
    this.invoicesService.getSunatConfig(row._id).subscribe({
      next: (config) => {
        row.sunatConfig = config;
        row.sunatLoaded = true;
        row.sunatLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        row.sunatConfig = null;
        row.sunatLoaded = true;
        row.sunatLoading = false;
        if (err.status !== 404) {
          this.notificationService.show('Error al cargar configuración SUNAT', 'error');
        }
      },
    });
  }

  // --- Company data editing ---

  startEdit(row: IClientRow): void {
    row.editForm = {
      comercialName: row.comercialName,
      businessName: row.businessName,
      businessId: row.businessId,
      address: row.address,
      phone: row.phone,
      email: row.email,
    };
    row.logoFile = null;
    row.logoPreview = null;
    row.editing = true;
  }

  cancelEdit(row: IClientRow): void {
    row.editing = false;
    row.logoFile = null;
    row.logoPreview = null;
  }

  onLogoSelected(row: IClientRow, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    row.logoFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => { row.logoPreview = e.target.result; };
    reader.readAsDataURL(file);
  }

  saveEdit(row: IClientRow): void {
    if (!row.editForm.comercialName.trim()) {
      this.notificationService.show('El nombre comercial es obligatorio', 'error');
      return;
    }
    row.saving = true;
    this.http.patch<any>(`${environment.api}/client/${row._id}`, row.editForm).subscribe({
      next: (updated) => {
        row.comercialName = updated.comercialName || row.editForm.comercialName;
        row.businessName = updated.businessName || row.editForm.businessName;
        row.businessId = updated.businessId || row.editForm.businessId;
        row.address = updated.address || row.editForm.address;
        row.phone = updated.phone || row.editForm.phone;
        row.email = updated.email || row.editForm.email;
        if (row.logoFile) {
          this.uploadLogo(row);
        } else {
          row.saving = false;
          row.editing = false;
          this.notificationService.show('Empresa actualizada', 'success');
        }
      },
      error: () => {
        row.saving = false;
        this.notificationService.show('Error al actualizar empresa', 'error');
      },
    });
  }

  private uploadLogo(row: IClientRow): void {
    row.uploadingLogo = true;
    const path = `company-logos/${row._id}`;
    const { downloadUrl$ } = this.uploadService.uploadFile(row.logoFile!, path);
    downloadUrl$.subscribe({
      next: (url) => {
        this.http.patch<any>(`${environment.api}/client/${row._id}`, { logo: url }).subscribe({
          next: (updated) => {
            row.logo = updated.logo || url;
            row.uploadingLogo = false;
            row.saving = false;
            row.editing = false;
            row.logoFile = null;
            row.logoPreview = null;
            this.notificationService.show('Empresa actualizada', 'success');
          },
          error: () => {
            row.uploadingLogo = false;
            row.saving = false;
            this.notificationService.show('Error al guardar logo', 'error');
          },
        });
      },
      error: () => {
        row.uploadingLogo = false;
        row.saving = false;
        this.notificationService.show('Error al subir logo', 'error');
      },
    });
  }

  // --- SUNAT config ---

  openSunatForm(row: IClientRow): void {
    if (row.sunatConfig) {
      row.sunatForm = {
        ruc: row.sunatConfig.ruc || '',
        clientIdSunat: row.sunatConfig.clientIdSunat || '',
        clientSecret: row.sunatConfig.clientSecret || '',
        isActive: row.sunatConfig.isActive ?? true,
      };
    } else {
      row.sunatForm = { ruc: '', clientIdSunat: '', clientSecret: '', isActive: true };
    }
    row.showSunatForm = true;
  }

  cancelSunatForm(row: IClientRow): void {
    row.showSunatForm = false;
  }

  saveSunat(row: IClientRow): void {
    if (!row.sunatForm.clientIdSunat.trim() || !row.sunatForm.clientSecret.trim()) {
      this.notificationService.show('Client ID y Client Secret son obligatorios', 'error');
      return;
    }
    row.savingSunat = true;
    if (row.sunatConfig?._id) {
      this.invoicesService.updateSunatConfig({ ...row.sunatForm, _id: row.sunatConfig._id }).subscribe({
        next: (config) => {
          row.sunatConfig = config;
          row.showSunatForm = false;
          row.savingSunat = false;
          this.notificationService.show('Configuración SUNAT actualizada', 'success');
        },
        error: () => {
          row.savingSunat = false;
          this.notificationService.show('Error al actualizar SUNAT', 'error');
        },
      });
    } else {
      this.invoicesService.createSunatConfig(row._id, row.sunatForm).subscribe({
        next: (config) => {
          row.sunatConfig = config;
          row.showSunatForm = false;
          row.savingSunat = false;
          this.notificationService.show('Configuración SUNAT creada', 'success');
        },
        error: () => {
          row.savingSunat = false;
          this.notificationService.show('Error al crear SUNAT', 'error');
        },
      });
    }
  }

  deleteSunat(row: IClientRow): void {
    if (!row.sunatConfig?._id) return;
    if (!confirm('¿Eliminar la configuración SUNAT de esta empresa?')) return;
    this.invoicesService.deleteSunatConfig(row.sunatConfig._id).subscribe({
      next: () => {
        row.sunatConfig = null;
        this.notificationService.show('Configuración SUNAT eliminada', 'success');
      },
      error: () => this.notificationService.show('Error al eliminar SUNAT', 'error'),
    });
  }

  testSunat(row: IClientRow): void {
    row.testingConnection = true;
    this.invoicesService.testSunatCredentials(row._id).subscribe({
      next: (result) => {
        row.testingConnection = false;
        this.loadSunat(row);
        if (result.success) {
          this.notificationService.show('Conexión SUNAT exitosa: ' + result.message, 'success');
        } else {
          this.notificationService.show('Error SUNAT: ' + result.message, 'error');
        }
      },
      error: (err: HttpErrorResponse) => {
        row.testingConnection = false;
        this.notificationService.show('Error al probar conexión SUNAT: ' + err.message, 'error');
      },
    });
  }
}
