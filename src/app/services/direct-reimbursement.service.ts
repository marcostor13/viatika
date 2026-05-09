import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserStateService } from './user-state.service';
import {
  IDirectReimbursement,
  ICreateDirectReimbursementPayload,
  IRegisterDirectReimbursementPaymentPayload,
} from '../interfaces/direct-reimbursement.interface';

@Injectable({ providedIn: 'root' })
export class DirectReimbursementService {
  private readonly url = `${environment.api}/direct-reimbursement`;
  private http = inject(HttpClient);
  private userStateService = inject(UserStateService);

  private get clientId(): string {
    const user = this.userStateService.getUser() as any;
    return user?.companyId || user?.client?._id || user?.clientId?._id || user?.clientId || '';
  }

  create(payload: ICreateDirectReimbursementPayload): Observable<IDirectReimbursement> {
    return this.http.post<IDirectReimbursement>(this.url, payload);
  }

  findAllByClient(): Observable<IDirectReimbursement[]> {
    return this.http.get<IDirectReimbursement[]>(`${this.url}/client/${this.clientId}`);
  }

  findMy(): Observable<IDirectReimbursement[]> {
    return this.http.get<IDirectReimbursement[]>(`${this.url}/my/client/${this.clientId}`);
  }

  findPendingPayments(): Observable<IDirectReimbursement[]> {
    return this.http.get<IDirectReimbursement[]>(`${this.url}/pending-payments/client/${this.clientId}`);
  }

  findOne(id: string): Observable<IDirectReimbursement> {
    return this.http.get<IDirectReimbursement>(`${this.url}/${id}`);
  }

  addExpense(id: string, expenseId: string): Observable<IDirectReimbursement> {
    return this.http.patch<IDirectReimbursement>(`${this.url}/${id}/add-expense`, { expenseId });
  }

  removeExpense(id: string, expenseId: string): Observable<IDirectReimbursement> {
    return this.http.patch<IDirectReimbursement>(`${this.url}/${id}/remove-expense`, { expenseId });
  }

  coordinatorApprove(id: string): Observable<IDirectReimbursement> {
    return this.http.patch<IDirectReimbursement>(`${this.url}/${id}/coordinator-approve`, {});
  }

  accountingApprove(id: string): Observable<IDirectReimbursement> {
    return this.http.patch<IDirectReimbursement>(`${this.url}/${id}/accounting-approve`, {});
  }

  accountingReject(id: string, reason: string): Observable<IDirectReimbursement> {
    return this.http.patch<IDirectReimbursement>(`${this.url}/${id}/accounting-reject`, { reason });
  }

  registerPayment(id: string, payload: IRegisterDirectReimbursementPaymentPayload): Observable<IDirectReimbursement> {
    return this.http.patch<IDirectReimbursement>(`${this.url}/${id}/register-payment`, payload);
  }

  close(id: string): Observable<IDirectReimbursement> {
    return this.http.patch<IDirectReimbursement>(`${this.url}/${id}/close`, {});
  }

  addOverrunJustification(id: string, justification: string): Observable<IDirectReimbursement> {
    return this.http.patch<IDirectReimbursement>(`${this.url}/${id}/overrun-justification`, { justification });
  }
}
