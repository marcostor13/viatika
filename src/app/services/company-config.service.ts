import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ICompanyConfig } from '../interfaces/company-config.interface';
import { InvoicesService } from '../modules/invoices/services/invoices.service';
import { UserStateService } from './user-state.service';
import {
  Storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from '@angular/fire/storage';

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
    this.initCompanyConfig();
    if (this.userStateService.isAuthenticated()) {
      this.loadCompanyConfig();
    }
  }

  initCompanyConfig() {
    const user = this.userStateService.getUser();
    const clientId = user?.client?._id || '';

    const defaultConfig: ICompanyConfig = {
      clientId: clientId,
      name: 'Mi Empresa',
      logo: '',
    };
    this.setCompanyConfig(defaultConfig);
  }

  setCompanyConfig(config: ICompanyConfig) {
    this.companyConfigSubject.next(config);
  }

  private loadCompanyConfig() {
    // Solo hacer la llamada si hay usuario autenticado
    if (!this.userStateService.isAuthenticated()) {
      return;
    }

    this.invoicesService
      .getCompanyConfig()
      .subscribe((config: ICompanyConfig) => {
        this.companyConfigSubject.next(config);
      });
  }

  getCompanyConfig(): ICompanyConfig | null {
    return this.companyConfigSubject.value;
  }

  updateCompanyName(name: string): Observable<ICompanyConfig> {
    return new Observable((observer) => {
      this.invoicesService.updateCompanyConfig({ name }).subscribe((config) => {
        this.companyConfigSubject.next(config);
        observer.next(config);
        observer.complete();
      });
    });
  }

  uploadCompanyLogo(file: File): Observable<UploadProgress> {
    const clientId = this.companyConfigSubject.value?._id!;

    return new Observable((observer) => {
      // Subir archivo a Firebase Storage
      const filePath = `company-logos/${clientId}/${Date.now()}_${file.name}`;
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
              .updateCompanyConfig({ logo: downloadURL })
              .subscribe((config) => {
                this.companyConfigSubject.next(config);
                observer.next({ config, progress: 100, type: 'complete' });
                observer.complete();
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

  // Método para recargar configuración cuando el usuario se autentique
  reloadConfigOnAuth() {
    this.initCompanyConfig();
    this.loadCompanyConfig();
  }
}
