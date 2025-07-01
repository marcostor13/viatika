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
  categoryUrl: string = `${environment.api}/categories`;
  projectUrl: string = `${environment.api}/projects`;
  companyConfigUrl: string = `${environment.api}/users/config`;
  sunatConfigUrl: string = `${environment.api}/sunat-config`;

  private http = inject(HttpClient);

  analyzeInvoice(invoice: InvoicePayload): Observable<IInvoiceResponse> {
    return this.http.post<IInvoiceResponse>(
      `${this.url}/analyze-image`,
      invoice
    );
  }

  getInvoices(
    companyId: string,
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
    return this.http.get<IInvoiceResponse[]>(`${this.url}/${companyId}`, {
      params,
    });
  }

  getInvoiceById(id: string, companyId: string): Observable<IInvoiceResponse> {
    return this.http.get<IInvoiceResponse>(`${this.url}/${id}/${companyId}`);
  }

  uploadInvoice(formData: FormData): Observable<IInvoiceResponse> {
    return this.http.post<IInvoiceResponse>(`${this.url}/upload`, formData);
  }

  deleteInvoice(id: string): Observable<any> {
    return this.http.delete(`${this.url}/${id}`);
  }

  approveInvoice(
    id: string,
    companyId: string,
    payload: ApprovalPayload
  ): Observable<IInvoiceResponse> {
    return this.http.patch<IInvoiceResponse>(
      `${this.url}/${id}/${companyId}/approve`,
      payload
    );
  }

  rejectInvoice(
    id: string,
    companyId: string,
    payload: ApprovalPayload
  ): Observable<IInvoiceResponse> {
    return this.http.patch<IInvoiceResponse>(
      `${this.url}/${id}/${companyId}/reject`,
      payload
    );
  }

  getCategories(companyId: string): Observable<ICategory[]> {
    return this.http.get<ICategory[]>(`${this.categoryUrl}/${companyId}`);
  }

  getCategoryById(id: string, companyId: string): Observable<ICategory> {
    return this.http.get<ICategory>(`${this.categoryUrl}/${id}/${companyId}`);
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

  getProjects(companyId: string): Observable<IProject[]> {
    return this.http.get<IProject[]>(`${this.projectUrl}/${companyId}`);
  }

  getProjectById(id: string, companyId: string): Observable<IProject> {
    return this.http.get<IProject>(`${this.projectUrl}/${id}/${companyId}`);
  }

  createProject(project: IProject): Observable<IProject> {
    return this.http.post<IProject>(`${this.projectUrl}`, project);
  }

  updateProject(
    id: string,
    project: Partial<IProject>,
    companyId: string
  ): Observable<IProject> {
    return this.http.patch<IProject>(
      `${this.projectUrl}/${id}/${companyId}`,
      project
    );
  }

  deleteProject(id: string): Observable<any> {
    return this.http.delete(`${this.projectUrl}/${id}`);
  }

  updateInvoice(id: string, companyId: string, payload: any) {
    return this.http.patch(`${this.url}/${id}/${companyId}`, payload);
  }

  // Métodos para validación SUNAT
  getSunatValidation(
    id: string,
    companyId: string
  ): Observable<SunatValidationInfo> {
    return this.http.get<SunatValidationInfo>(
      `${this.url}/${id}/${companyId}/sunat-validation`
    );
  }

  // Métodos para configuración de empresa
  getCompanyConfig(companyId: string): Observable<ICompanyConfig> {
    return this.http.get<ICompanyConfig>(
      `${this.companyConfigUrl}/${companyId}`
    );
  }

  updateCompanyConfig(
    companyId: string,
    config: Partial<ICompanyConfig>
  ): Observable<ICompanyConfig> {
    return this.http.patch<ICompanyConfig>(
      `${this.companyConfigUrl}/${companyId}`,
      config
    );
  }

  uploadCompanyLogo(
    companyId: string,
    formData: FormData
  ): Observable<ICompanyConfig> {
    return this.http.post<ICompanyConfig>(
      `${this.companyConfigUrl}/${companyId}/logo`,
      formData
    );
  }

  // Métodos para configuración de SUNAT
  getSunatConfig(): Observable<ISunatConfig> {
    return this.http.get<ISunatConfig>(this.sunatConfigUrl);
  }

  createSunatConfig(config: Partial<ISunatConfig>): Observable<ISunatConfig> {
    return this.http.post<ISunatConfig>(this.sunatConfigUrl, config);
  }

  updateSunatConfig(config: Partial<ISunatConfig>): Observable<ISunatConfig> {
    return this.http.patch<ISunatConfig>(this.sunatConfigUrl, config);
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
