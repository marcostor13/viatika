export type TaxPeriodStatus = 'open' | 'closed';

/** Período tributario (SUNAT) de la empresa: mes + año. */
export interface ITaxPeriod {
  _id: string;
  year: number;
  /** Mes 1-12. */
  month: number;
  /** '2026-08'. */
  code: string;
  /** 'Agosto 08 / 2026'. */
  label: string;
  status: TaxPeriodStatus;
  closedAt?: string;
  notes?: string;
}

export const MONTH_OPTIONS: { value: number; label: string; code: string }[] = [
  { value: 1, label: 'Enero', code: '01' },
  { value: 2, label: 'Febrero', code: '02' },
  { value: 3, label: 'Marzo', code: '03' },
  { value: 4, label: 'Abril', code: '04' },
  { value: 5, label: 'Mayo', code: '05' },
  { value: 6, label: 'Junio', code: '06' },
  { value: 7, label: 'Julio', code: '07' },
  { value: 8, label: 'Agosto', code: '08' },
  { value: 9, label: 'Setiembre', code: '09' },
  { value: 10, label: 'Octubre', code: '10' },
  { value: 11, label: 'Noviembre', code: '11' },
  { value: 12, label: 'Diciembre', code: '12' },
];
