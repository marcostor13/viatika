import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { IInvoiceResponse, InvoicePayload } from '../interfaces/invoices.interface';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
@Injectable({
  providedIn: 'root',
})
export class InvoicesService {

  url: string = `${environment.api}/expense`;

  private http = inject(HttpClient);

  analyzeInvoice(invoice: InvoicePayload): Observable<IInvoiceResponse> {
    return this.http.post<IInvoiceResponse>(`${this.url}/analyze-image`, invoice);
  }

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
