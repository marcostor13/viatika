import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  IExpenseReport,
  ICreateExpenseReport,
  IUpdateExpenseReport,
  IRegisterReimbursementPaymentPayload,
  IMisDocumentoItem,
} from '../interfaces/expense-report.interface';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ExpenseReportsService {
  private http = inject(HttpClient);
  private apiUrl = environment.api;

  create(data: ICreateExpenseReport): Observable<IExpenseReport> {
    return this.http.post<IExpenseReport>(`${this.apiUrl}/expense-report`, data);
  }

  findAllByClient(clientId: string): Observable<IExpenseReport[]> {
    return this.http.get<IExpenseReport[]>(`${this.apiUrl}/expense-report/client/${clientId}`);
  }

  findAllByUser(userId: string, clientId: string): Observable<IExpenseReport[]> {
    return this.http.get<IExpenseReport[]>(`${this.apiUrl}/expense-report/user/${userId}/client/${clientId}`);
  }

  findOne(id: string): Observable<IExpenseReport> {
    return this.http.get<IExpenseReport>(`${this.apiUrl}/expense-report/${id}`);
  }

  update(id: string, data: IUpdateExpenseReport): Observable<IExpenseReport> {
    return this.http.patch<IExpenseReport>(`${this.apiUrl}/expense-report/${id}`, data);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/expense-report/${id}`);
  }

  findPendingReimbursements(clientId: string): Observable<IExpenseReport[]> {
    return this.http.get<IExpenseReport[]>(
      `${this.apiUrl}/expense-report/pending-reimbursements/client/${clientId}`
    );
  }

  findMyDocuments(): Observable<{ items: IMisDocumentoItem[] }> {
    return this.http.get<{ items: IMisDocumentoItem[] }>(
      `${this.apiUrl}/expense-report/documents/my`
    );
  }

  registerReimbursementPayment(
    reportId: string,
    payload: IRegisterReimbursementPaymentPayload
  ): Observable<IExpenseReport> {
    return this.http.patch<IExpenseReport>(
      `${this.apiUrl}/expense-report/${reportId}/register-reimbursement-payment`,
      payload
    );
  }

  cancelRendicion(id: string, reason?: string): Observable<IExpenseReport> {
    return this.http.patch<IExpenseReport>(
      `${this.apiUrl}/expense-report/${id}/cancel`,
      { reason }
    );
  }

  validateClosure(reportId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/expense-report/${reportId}/close/validate`);
  }

  close(reportId: string): Observable<IExpenseReport> {
    return this.http.patch<IExpenseReport>(`${this.apiUrl}/expense-report/${reportId}/close`, {});
  }

  requestReopening(reportId: string, reason: string): Observable<IExpenseReport> {
    return this.http.post<IExpenseReport>(
      `${this.apiUrl}/expense-report/${reportId}/reopen-request`,
      { reason }
    );
  }

  approveReopening(reportId: string, approve: boolean): Observable<IExpenseReport> {
    return this.http.patch<IExpenseReport>(
      `${this.apiUrl}/expense-report/${reportId}/reopen-approve`,
      { approve }
    );
  }

  registerReturnVoucher(
    reportId: string,
    payload: { depositDate: string; bankOrigin?: string; operationNumber?: string; fileUrl: string; fileName?: string }
  ): Observable<IExpenseReport> {
    return this.http.post<IExpenseReport>(
      `${this.apiUrl}/expense-report/${reportId}/return-voucher`,
      payload
    );
  }

  findExpensesPaginated(
    reportId: string,
    params: { page?: number; limit?: number; type?: string; status?: string; search?: string }
  ): Observable<{ data: any[]; total: number; page: number; limit: number; pages: number }> {
    const qp = new URLSearchParams();
    if (params.page) qp.set('page', String(params.page));
    if (params.limit) qp.set('limit', String(params.limit));
    if (params.type && params.type !== 'all') qp.set('type', params.type);
    if (params.status && params.status !== 'all') qp.set('status', params.status);
    if (params.search?.trim()) qp.set('search', params.search.trim());
    const qs = qp.toString();
    return this.http.get<{ data: any[]; total: number; page: number; limit: number; pages: number }>(
      `${this.apiUrl}/expense-report/${reportId}/expenses${qs ? '?' + qs : ''}`
    );
  }

  createAffidavit(
    reportId: string,
    payload: { type: 'viaticos_nacionales' | 'viajes_exterior'; expenseIds: string[] }
  ): Observable<{
    reportId: string;
    type: 'viaticos_nacionales' | 'viajes_exterior';
    expenseIds: string[];
    generatedBy: string;
    generatedAt: string;
  }> {
    return this.http.post<{
      reportId: string;
      type: 'viaticos_nacionales' | 'viajes_exterior';
      expenseIds: string[];
      generatedBy: string;
      generatedAt: string;
    }>(`${this.apiUrl}/expense-report/${reportId}/affidavit`, payload);
  }
}
