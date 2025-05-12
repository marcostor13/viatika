import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { IInvoiceResponse } from '../interfaces/invoices.interface';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InvoicesService {
  url: string = 'https://fact-back.marcostorresalarcon.com/api/expense';
  // url: string = 'http://localhost:3015/api/expense';

  private http = inject(HttpClient);

  getInvoices(): Observable<IInvoiceResponse[]> {
    return this.http.get<IInvoiceResponse[]>(`${this.url}`);
  }

  getInvoiceById(id: string): Observable<IInvoiceResponse> {
    return this.http.get<IInvoiceResponse>(`${this.url}/${id}`);
  }

  uploadInvoice(formData: FormData): Observable<IInvoiceResponse> {
    return this.http.post<IInvoiceResponse>(`${this.url}/upload`, formData);
  }

  deleteInvoice(id: string): Observable<any> {
    return this.http.delete(`${this.url}/${id}`);
  }
}
