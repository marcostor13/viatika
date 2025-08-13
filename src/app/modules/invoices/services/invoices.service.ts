import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IInvoiceResponse,
  InvoicePayload,
  ApprovalPayload,
  SunatValidationInfo,
} from '../interfaces/invoices.interface';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ICategory } from '../interfaces/category.interface';
import { IProject } from '../interfaces/project.interface';
import { ICompanyConfig } from '../../../interfaces/company-config.interface';
import {
  ISunatConfig,
  ISunatCredentials,
} from '../../../interfaces/sunat-config.interface';

@Injectable({
  providedIn: 'root',
})
export class InvoicesService {
  url: string = `${environment.api}/expense`;
  categoryUrl: string = `${environment.api}/category`;
  projectUrl: string = `${environment.api}/project`;
  companyConfigUrl: string = `${environment.api}/client`;
  sunatConfigUrl: string = `${environment.api}/sunat-config`;

  private http = inject(HttpClient);

  analyzeInvoice(invoice: InvoicePayload): Observable<IInvoiceResponse> {
    return this.http.post<IInvoiceResponse>(
      `${this.url}/analyze-image`,
      invoice
    );
  }

  getInvoices(
    filters?: any,
    sortBy: string = 'fechaEmision',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Observable<IInvoiceResponse[]> {
    let params = new HttpParams();

    params = params.set('sortBy', sortBy);
    params = params.set('sortOrder', sortOrder);

    if (filters) {
      Object.keys(filters).forEach((key) => {
        if (
          filters[key] !== undefined &&
          filters[key] !== null &&
          filters[key] !== ''
        ) {
          params = params.set(key, filters[key]);
        }
      });
    }
    return this.http.get<IInvoiceResponse[]>(`${this.url}`, {
      params,
    });
  }

  getInvoiceById(id: string): Observable<IInvoiceResponse> {
    return this.http.get<IInvoiceResponse>(`${this.url}/invoice/${id}`);
  }

  uploadInvoice(formData: FormData): Observable<IInvoiceResponse> {
    return this.http.post<IInvoiceResponse>(`${this.url}/upload`, formData);
  }

  deleteInvoice(id: string): Observable<any> {
    return this.http.delete(`${this.url}/invoice/${id}`);
  }

  approveInvoice(
    id: string,
    payload: ApprovalPayload
  ): Observable<IInvoiceResponse> {
    return this.http.patch<IInvoiceResponse>(
      `${this.url}/invoice/${id}/approve`,
      payload
    );
  }

  rejectInvoice(
    id: string,
    payload: ApprovalPayload
  ): Observable<IInvoiceResponse> {
    return this.http.patch<IInvoiceResponse>(
      `${this.url}/invoice/${id}/reject`,
      payload
    );
  }

  getCategories(): Observable<ICategory[]> {
    return this.http.get<ICategory[]>(`${this.categoryUrl}`);
  }

  getCategoryById(id: string): Observable<ICategory> {
    return this.http.get<ICategory>(`${this.categoryUrl}/${id}`);
  }

  createCategory(category: ICategory): Observable<ICategory> {
    return this.http.post<ICategory>(`${this.categoryUrl}`, category);
  }

  updateCategory(
    id: string,
    category: Partial<ICategory>
  ): Observable<ICategory> {
    return this.http.patch<ICategory>(`${this.categoryUrl}/${id}`, category);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.categoryUrl}/${id}`);
  }

  getProjects(): Observable<IProject[]> {
    return this.http.get<IProject[]>(`${this.projectUrl}`);
  }

  getProjectById(id: string): Observable<IProject> {
    return this.http.get<IProject>(`${this.projectUrl}/${id}`);
  }

  createProject(project: IProject): Observable<IProject> {
    return this.http.post<IProject>(`${this.projectUrl}`, project);
  }

  updateProject(id: string, project: Partial<IProject>): Observable<IProject> {
    return this.http.patch<IProject>(`${this.projectUrl}/${id}`, project);
  }

  deleteProject(id: string): Observable<any> {
    return this.http.delete(`${this.projectUrl}/${id}`);
  }

  updateInvoice(id: string, payload: any) {
    return this.http.patch(`${this.url}/invoice/${id}`, payload);
  }

  // Métodos para validación SUNAT
  getSunatValidation(
    id: string,
    companyId: string
  ): Observable<SunatValidationInfo> {
    return this.http.get<SunatValidationInfo>(
      `${this.url}/invoice/${id}/${companyId}/sunat-validation`
    );
  }

  // Métodos para configuración de empresa
  getCompanyConfig(): Observable<ICompanyConfig> {
    return this.http.get<ICompanyConfig>(`${this.companyConfigUrl}`);
  }

  updateCompanyConfig(
    id: string,
    config: Partial<ICompanyConfig>
  ): Observable<ICompanyConfig> {
    return this.http.patch<ICompanyConfig>(
      `${this.companyConfigUrl}/${id}`,
      config
    );
  }

  getSunatConfig(): Observable<ISunatConfig> {
    return this.http.get<ISunatConfig>(this.sunatConfigUrl);
  }

  createSunatConfig(config: Partial<ISunatConfig>): Observable<ISunatConfig> {
    return this.http.post<ISunatConfig>(this.sunatConfigUrl, config);
  }

  updateSunatConfig(config: Partial<ISunatConfig>): Observable<ISunatConfig> {
    return this.http.patch<ISunatConfig>(
      `${this.sunatConfigUrl}/${config._id}`,
      config
    );
  }

  deleteSunatConfig(): Observable<any> {
    return this.http.delete(this.sunatConfigUrl);
  }

  getSunatCredentials(): Observable<ISunatCredentials> {
    return this.http.get<ISunatCredentials>(
      `${this.sunatConfigUrl}/credentials`
    );
  }

  testSunatCredentials(): Observable<any> {
    return this.http.get(`${this.url}/test-sunat-credentials`);
  }
}
