export type WalletEntryType = 'viaticos' | 'directa' | 'caja_chica';
export type WalletEntryOrigin = 'deposito' | 'saldo_sobrante' | 'carga_manual';
export type WalletEntryStatus = 'available' | 'consumed' | 'returned';

/** Un saldo individual de la Bolsa del colaborador (BOLSA-1/3). */
export interface IBalanceItem {
  _id: string;
  userId: string;
  clientId: string;
  projectId?: string | { _id: string; name: string };
  type: WalletEntryType;
  origin: WalletEntryOrigin;
  amount: number;
  remainingAmount: number;
  status: WalletEntryStatus;
  sourceReportId?: string | { _id: string; codigo?: string };
  sourceAdvanceId?: string;
  sourceCodigo?: string;
  operationNumber?: string;
  operationDate?: string;
  depositDate?: string;
  note?: string;
  createdAt?: string;
}

/** Respuesta del detalle de la Bolsa de un colaborador. */
export interface IBolsa {
  userId: string;
  clientId: string;
  totalAvailable: number;
  availableCount: number;
  entries: IBalanceItem[];
}
