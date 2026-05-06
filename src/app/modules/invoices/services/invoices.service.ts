import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IInvoiceResponse,
  InvoicePayload,
  ApprovalPayload,
  SunatValidationInfo,
  ICreateMobilitySheetPayload,
  ICreateOtherExpensePayload,
  ICreateCashReceiptPayload,
  ICreateCashVoucherPayload,
} from '../interfaces/invoices.interface';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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

  analyzePdf(formData: FormData): Observable<IInvoiceResponse> {
    return this.http.post<IInvoiceResponse>(
      `${this.url}/analize-pdf`,
      formData
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

  getCategories(companyId?: string): Observable<ICategory[]> {
    const url = companyId
      ? `${this.categoryUrl}/${companyId}/flat`
      : `${this.categoryUrl}/flat`;
    return this.http.get<ICategory[]>(url);
  }

  getCategoryById(id: string): Observable<ICategory> {
    return this.http.get<ICategory>(`${this.categoryUrl}/${id}`);
  }

  createCategory(category: ICategory): Observable<ICategory> {
    return this.http.post<ICategory>(`${this.categoryUrl}`, category);
  }

  updateCategory(
    id: string,
    clientId: string,
    category: Partial<ICategory>
  ): Observable<ICategory> {
    return this.http.patch<ICategory>(`${this.categoryUrl}/${id}/${clientId}`, category);
  }

  deleteCategory(id: string, clientId: string): Observable<any> {
    return this.http.delete(`${this.categoryUrl}/${id}/${clientId}`);
  }

  getProjects(companyId?: string): Observable<IProject[]> {
    const url = companyId ? `${this.projectUrl}/${companyId}` : this.projectUrl;
    return this.http.get<IProject[]>(url);
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

  deleteProject(id: string, companyId: string): Observable<any> {
    return this.http.delete(`${this.projectUrl}/${id}/${companyId}`);
  }

  updateInvoice(id: string, payload: any) {
    return this.http.patch(`${this.url}/invoice/${id}`, payload);
  }

  createMobilitySheet(payload: ICreateMobilitySheetPayload): Observable<IInvoiceResponse> {
    return this.http.post<IInvoiceResponse>(`${this.url}/mobility-sheet`, payload);
  }

  createOtherExpense(payload: ICreateOtherExpensePayload): Observable<IInvoiceResponse> {
    return this.http.post<IInvoiceResponse>(`${this.url}/other-expense`, payload);
  }

  createCashReceipt(payload: ICreateCashReceiptPayload): Observable<IInvoiceResponse> {
    return this.http.post<IInvoiceResponse>(`${this.url}/cash-receipt`, payload);
  }

  createCashVoucher(payload: ICreateCashVoucherPayload): Observable<IInvoiceResponse> {
    return this.http.post<IInvoiceResponse>(`${this.url}/cash-voucher`, payload);
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
    return this.http.get<any>(
      `${this.companyConfigUrl}/${companyId}`
    ).pipe(
      map(client => ({
        _id: client._id,
        companyId: client._id,
        name: client.comercialName || client.businessName,
        logo: client.logo
      }))
    );
  }

  updateCompanyConfig(
    companyId: string,
    config: Partial<ICompanyConfig>
  ): Observable<ICompanyConfig> {
    const payload: Record<string, unknown> = {};
    if (config.name) payload['comercialName'] = config.name;
    if (config.logo) payload['logo'] = config.logo;

    return this.http.patch<any>(
      `${this.companyConfigUrl}/${companyId}`,
      payload
    ).pipe(
      map(client => ({
        _id: client._id,
        companyId: client._id,
        name: client.comercialName || client.businessName,
        logo: client.logo
      }))
    );
  }

  getSunatConfig(clientId: string): Observable<ISunatConfig> {
    return this.http.get<ISunatConfig>(`${this.sunatConfigUrl}/${clientId}`);
  }

  createSunatConfig(
    clientId: string,
    config: Partial<ISunatConfig>
  ): Observable<ISunatConfig> {
    return this.http.post<ISunatConfig>(this.sunatConfigUrl, {
      ...config,
      clientId,
    });
  }

  updateSunatConfig(config: Partial<ISunatConfig>): Observable<ISunatConfig> {
    if (!config._id) {
      throw new Error('Se requiere _id para actualizar la configuración SUNAT');
    }
    return this.http.patch<ISunatConfig>(
      `${this.sunatConfigUrl}/${config._id}`,
      config
    );
  }

  deleteSunatConfig(id: string): Observable<any> {
    return this.http.delete(`${this.sunatConfigUrl}/${id}`);
  }

  getSunatCredentials(clientId: string): Observable<ISunatCredentials> {
    return this.http.get<ISunatCredentials>(
      `${this.sunatConfigUrl}/credentials/${clientId}`
    );
  }

  testSunatCredentials(clientId: string): Observable<any> {
    return this.http.get(`${this.url}/test-sunat-credentials/${clientId}`);
  }

  validateWithSunatData(
    id: string,
    data: {
      rucEmisor: string;
      serie: string;
      correlativo: string;
      fechaEmision: string;
      montoTotal?: number;
      clientId?: string;
      tipoComprobante?: string;
    }
  ): Observable<any> {
    return this.http.post(`${this.url}/invoice/${id}/validate-sunat`, data);
  }
}
