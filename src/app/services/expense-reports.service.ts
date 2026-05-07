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
