import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../../services/notification.service';
import { AdminUsersService } from '../services/admin-users.service';
import { UserStateService } from '../../../services/user-state.service';
import { ButtonComponent } from '../../../design-system/button/button.component';

@Component({
  selector: 'app-admin-users-bulk-import',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './admin-users-bulk-import.component.html',
})
export class AdminUsersBulkImportComponent {
  private router = inject(Router);
  private notification = inject(NotificationService);
  private adminUsersService = inject(AdminUsersService);
  private userStateService = inject(UserStateService);

  file: File | null = null;
  loading = false;
  exporting = false;
  previewing = false;
  showConfirm = false;
  preview: {
    created: number;
    updated: number;
    skipped: string[];
    errors: string[];
  } | null = null;
  result: {
    created: number;
    updated: number;
    skipped: string[];
    errors: string[];
    credentials: { name: string; email: string; temporaryPassword: string }[];
  } | null = null;

  back() {
    this.router.navigate(['/admin-users']);
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
    this.result = null;
  }

  private saveXlsx(res: { file: string; filename: string }) {
    const bytes = Uint8Array.from(atob(res.file), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = res.filename; a.click();
    URL.revokeObjectURL(url);
  }

  downloadTemplate() {
    this.adminUsersService.downloadUserTemplate().subscribe({
      next: (res) => this.saveXlsx(res),
      error: () => this.notification.show('Error al descargar plantilla', 'error'),
    });
  }

  /** Descarga la plantilla precargada con todos los usuarios actuales. */
  downloadUsers() {
    this.exporting = true;
    this.adminUsersService.exportUsers().subscribe({
      next: (res) => {
        this.exporting = false;
        this.saveXlsx(res);
      },
      error: () => {
        this.exporting = false;
        this.notification.show('Error al exportar usuarios', 'error');
      },
    });
  }

  private buildFormData(dryRun: boolean, updateExisting: boolean): FormData {
    const companyId = this.userStateService.getUser()?.companyId || '';
    const fd = new FormData();
    fd.append('file', this.file as File);
    fd.append('clientId', companyId);
    fd.append('dryRun', String(dryRun));
    fd.append('updateExisting', String(updateExisting));
    return fd;
  }

  /** Paso 1: vista previa (no escribe nada) y abre el diálogo de confirmación. */
  import() {
    if (!this.file) {
      this.notification.show('Selecciona un archivo Excel primero', 'error');
      return;
    }
    this.result = null;
    this.previewing = true;
    this.adminUsersService.bulkImportUsers(this.buildFormData(true, true)).subscribe({
      next: (res) => {
        this.previewing = false;
        this.preview = {
          created: res.created,
          updated: res.updated,
          skipped: res.skipped,
          errors: res.errors,
        };
        this.showConfirm = true;
      },
      error: () => {
        this.previewing = false;
        this.notification.show('Error al analizar el archivo', 'error');
      },
    });
  }

  cancelImport() {
    this.showConfirm = false;
    this.preview = null;
  }

  /** Paso 2: aplica la importación. updateExisting decide si edita a los existentes. */
  confirmImport(updateExisting: boolean) {
    if (!this.file) return;
    this.showConfirm = false;
    this.loading = true;
    this.adminUsersService.bulkImportUsers(this.buildFormData(false, updateExisting)).subscribe({
      next: (res) => {
        this.loading = false;
        this.preview = null;
        this.result = res;
        this.notification.show(`Importación completada: ${res.created} creados, ${res.updated} actualizados`, 'success');
      },
      error: () => {
        this.loading = false;
        this.notification.show('Error al importar usuarios', 'error');
      },
    });
  }

  downloadCredentials() {
    const creds = this.result?.credentials ?? [];
    if (!creds.length) return;
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'Nombre,Email,Contraseña temporal';
    const rows = creds.map(
      (c) => `${escape(c.name)},${escape(c.email)},${escape(c.temporaryPassword)}`,
    );
    const csv = '﻿' + [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'credenciales_colaboradores.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
