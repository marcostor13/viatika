import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SunatValidationInfo {
  expenseId: string;
  status: string;
  sunatValidation: any;
  hasValidation: boolean;
  message: string;
  extractedData?: {
    rucEmisor?: string;
    serie?: string;
    correlativo?: string;
    fechaEmision?: string;
    montoTotal?: number;
  };
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private http = inject(HttpClient);
  private url = `${environment.api}/expense`;

  getExpenses(companyId: string, filters?: any): Observable<any[]> {
    let params = new HttpParams();
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
    return this.http.get<any[]>(`${this.url}/${companyId}`, { params });
  }

  analyzeExpense(expenseData: any): Observable<any> {
    return this.http.post<any>(`${this.url}/analyze-image`, expenseData);
  }

  getSunatValidation(
    id: string,
    companyId: string
  ): Observable<SunatValidationInfo> {
    return this.http.get<SunatValidationInfo>(
      `${this.url}/${id}/${companyId}/sunat-validation`
    );
  }

  updateExpense(id: string, companyId: string, payload: any): Observable<any> {
    return this.http.patch<any>(`${this.url}/${id}/${companyId}`, payload);
  }

  deleteExpense(id: string, companyId: string): Observable<any> {
    return this.http.delete<any>(`${this.url}/${id}/${companyId}`);
  }
}
