import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { IAccountingConfig, ICurrencyConfig } from '../interfaces/accounting-config.interface';

@Injectable({ providedIn: 'root' })
export class AccountingConfigService {
  private http = inject(HttpClient);
  private url = `${environment.api}/accounting-config`;

  /** Devuelve la config contable de la empresa o null si no existe. Solo Admin/SuperAdmin/Contabilidad. */
  getConfig(clientId: string): Observable<IAccountingConfig | null> {
    return this.http.get<IAccountingConfig | null>(`${this.url}/${clientId}`);
  }

  /** Monedas soportadas por la empresa; accesible a cualquier usuario autenticado (para selectores de moneda). */
  getCurrencies(clientId: string): Observable<{ monedaBase: string; supportedCurrencies: ICurrencyConfig[] }> {
    return this.http.get<{ monedaBase: string; supportedCurrencies: ICurrencyConfig[] }>(
      `${this.url}/${clientId}/currencies`
    );
  }

  /** Upsert de la configuración contable (plan de cuentas + bancos). */
  saveConfig(
    clientId: string,
    config: Partial<IAccountingConfig>
  ): Observable<IAccountingConfig> {
    return this.http.put<IAccountingConfig>(`${this.url}/${clientId}`, config);
  }
}