import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { 
  IExpenseReport, 
  ICreateExpenseReport, 
  IUpdateExpenseReport 
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
}
