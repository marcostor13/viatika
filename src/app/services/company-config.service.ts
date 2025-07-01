import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ICompanyConfig } from '../interfaces/company-config.interface';
import { InvoicesService } from '../modules/invoices/services/invoices.service';
import { UserStateService } from './user-state.service';

@Injectable({
  providedIn: 'root',
})
export class CompanyConfigService {
  private invoicesService = inject(InvoicesService);
  private userStateService = inject(UserStateService);

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

  uploadCompanyLogo(file: File): Observable<ICompanyConfig> {
    const companyId = this.userStateService.getUser()?.companyId;
    if (!companyId) {
      throw new Error('No se encontró companyId');
    }

    const formData = new FormData();
    formData.append('logo', file);

    return new Observable((observer) => {
      this.invoicesService.uploadCompanyLogo(companyId, formData).subscribe({
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

  refreshConfig() {
    this.loadCompanyConfig();
  }
}
