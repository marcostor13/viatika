import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ITaxPeriod, TaxPeriodStatus } from '../interfaces/tax-period.interface';

/**
 * Períodos tributarios (SUNAT) de la empresa. El backend los resuelve por el
 * clientId del JWT: no se envía empresa en la URL.
 */
@Injectable({ providedIn: 'root' })
export class TaxPeriodService {
  private http = inject(HttpClient);
  private url = `${environment.api}/tax-period`;

  findAll(): Observable<ITaxPeriod[]> {
    return this.http.get<ITaxPeriod[]>(this.url);
  }

  create(year: number, month: number, notes?: string): Observable<ITaxPeriod> {
    return this.http.post<ITaxPeriod>(this.url, { year, month, notes });
  }

  setStatus(id: string, status: TaxPeriodStatus): Observable<ITaxPeriod> {
    return this.http.patch<ITaxPeriod>(`${this.url}/${id}/status`, { status });
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.url}/${id}`);
  }
}
