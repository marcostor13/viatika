import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserStateService } from './user-state.service';
import {
  IBalanceItem,
  IBolsa,
  WalletEntryType,
} from '../interfaces/bolsa.interface';

@Injectable({ providedIn: 'root' })
export class BolsaService {
  private readonly url = `${environment.api}/bolsa`;
  private http = inject(HttpClient);
  private userStateService = inject(UserStateService);

  private get clientId(): string {
    const user = this.userStateService.getUser() as any;
    return (
      user?.companyId ||
      user?.client?._id ||
      user?.clientId?._id ||
      user?.clientId ||
      ''
    );
  }

  /** Saldos consumibles del colaborador para un destino dado (BOLSA-3). */
  getAvailable(
    targetType: WalletEntryType,
    projectId?: string
  ): Observable<IBalanceItem[]> {
    let params = new HttpParams().set('targetType', targetType);
    if (projectId) params = params.set('projectId', projectId);
    return this.http.get<IBalanceItem[]>(
      `${this.url}/available/my/client/${this.clientId}`,
      { params }
    );
  }

  /** Bolsa completa del colaborador (saldos + total disponible). */
  getMyBolsa(): Observable<IBolsa> {
    return this.http.get<IBolsa>(`${this.url}/my/client/${this.clientId}`);
  }
}
