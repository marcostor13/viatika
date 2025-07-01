import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { ICompanyConfig } from '../interfaces/company-config.interface';
import { InvoicesService } from '../modules/invoices/services/invoices.service';
import { UserStateService } from './user-state.service';
import {
  Storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from '@angular/fire/storage';
import { environment } from '../../environments/environment';

interface UploadProgress {
  config?: ICompanyConfig;
  progress?: number;
  type: 'progress' | 'complete' | 'error';
}

@Injectable({
  providedIn: 'root',
})
export class CompanyConfigService {
  private invoicesService = inject(InvoicesService);
  private userStateService = inject(UserStateService);
  private readonly storage: Storage = inject(Storage);

  private companyConfigSubject = new BehaviorSubject<ICompanyConfig | null>(
    null
  );
  public companyConfig$ = this.companyConfigSubject.asObservable();

  constructor() {
    this.loadCompanyConfig();
  }

  private loadCompanyConfig() {
    const companyId = this.userStateService.getUser()?.companyId;
    if (companyId) {
      this.invoicesService.getCompanyConfig(companyId).subscribe({
        next: (config) => {
          this.companyConfigSubject.next(config);
        },
        error: (error) => {
          console.error('Error loading company config:', error);
          // Si no existe configuración, crear una por defecto
          const defaultConfig: ICompanyConfig = {
            companyId: companyId,
            name: 'Mi Empresa',
            logo: '',
          };
          this.companyConfigSubject.next(defaultConfig);
        },
      });
    }
  }

  getCompanyConfig(): ICompanyConfig | null {
    return this.companyConfigSubject.value;
  }

  updateCompanyName(name: string): Observable<ICompanyConfig> {
    const companyId = this.userStateService.getUser()?.companyId;
    if (!companyId) {
      throw new Error('No se encontró companyId');
    }

    return new Observable((observer) => {
      this.invoicesService.updateCompanyConfig(companyId, { name }).subscribe({
        next: (config) => {
          this.companyConfigSubject.next(config);
          observer.next(config);
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
        },
      });
    });
  }

  uploadCompanyLogo(file: File): Observable<UploadProgress> {
    const companyId = this.userStateService.getUser()?.companyId;
    if (!companyId) {
      throw new Error('No se encontró companyId');
    }

    return new Observable((observer) => {
      // Subir archivo a Firebase Storage
      const filePath = `company-logos/${companyId}/${Date.now()}_${file.name}`;
      const storageRef = ref(this.storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          observer.next({ progress, type: 'progress' });
        },
        (error) => {
          console.error('Error al subir logo:', error);
          observer.next({ type: 'error' });
          observer.error(error);
        },
        async () => {
          try {
            // Obtener URL de descarga
            const downloadURL = await getDownloadURL(storageRef);

            // Actualizar configuración de empresa con la nueva URL
            this.invoicesService
              .updateCompanyConfig(companyId, { logo: downloadURL })
              .subscribe({
                next: (config) => {
                  this.companyConfigSubject.next(config);
                  observer.next({ config, progress: 100, type: 'complete' });
                  observer.complete();
                },
                error: (error) => {
                  observer.next({ type: 'error' });
                  observer.error(error);
                },
              });
          } catch (error) {
            observer.next({ type: 'error' });
            observer.error(error);
          }
        }
      );
    });
  }

  refreshConfig() {
    this.loadCompanyConfig();
  }
}
