import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IInvoiceResponse,
  InvoicePayload,
  ApprovalPayload,
} from '../interfaces/invoices.interface';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ICategory } from '../interfaces/category.interface';
import { IProject } from '../interfaces/project.interface';

@Injectable({
  providedIn: 'root',
})
export class InvoicesService {
  url: string = `${environment.api}/expense`;
  categoryUrl: string = `${environment.api}/categories`;
  projectUrl: string = `${environment.api}/projects`;

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
    payload: ApprovalPayload
  ): Observable<IInvoiceResponse> {
    return this.http.patch<IInvoiceResponse>(
      `${this.url}/${id}/approve`,
      payload
    );
  }

  rejectInvoice(
    id: string,
    payload: ApprovalPayload
  ): Observable<IInvoiceResponse> {
    return this.http.patch<IInvoiceResponse>(
      `${this.url}/${id}/reject`,
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

  updateInvoice(id: string, companyId: string, payload: any) {
    return this.http.patch(`${this.url}/${id}/${companyId}`, payload);
  }
}
