export type IReopeningStatus = 'none' | 'requested' | 'approved';

export interface IClosureRecord {
  closedAt: string;
  closedBy: string;
  documentHashes?: string[];
  reopeningStatus: IReopeningStatus;
  reopeningRequestedBy?: string;
  reopeningRequestedAt?: string;
  reopeningReason?: string;
  reopeningApprovedBy?: string;
  reopeningApprovedAt?: string;
  reopenedAt?: string;
}

export interface IExpenseReportBudgetItem {
  description: string;
  amount: number;
  peopleCount: number;
  fuelAmount: number;
  daysCount: number;
  total: number;
}

export interface IExpenseReportSettlement {
  advanceTotal: number;
  expenseTotal: number;
  difference: number;
  type: 'reembolso' | 'devolucion' | 'equilibrado';
  settledAt?: string;
}

export interface IReimbursementPaymentInfo {
  method: 'transferencia_bancaria' | 'efectivo' | 'cheque';
  bankName?: string;
  accountNumber?: string;
  cci?: string;
  transferDate: string;
  reference?: string;
  paymentReceiptUrl?: string;
  paymentReceiptFileName?: string;
  paymentReceiptMimeType?: string;
  paymentReceiptSizeBytes?: number;
  /** Datos extraídos del comprobante por OCR/visión (informativos). */
  scannedAmount?: number;
  operationNumber?: string;
  operationDate?: string;
  operationTime?: string;
  titular?: string;
}

export interface IExpenseReport {
  _id: string;
  title: string;
  description?: string;
  budget: number;
  userId: any; // Ideally IUserResponse or string ID
  clientId: string;
  status: 'solicited' | 'open' | 'submitted' | 'pending_accounting' | 'approved' | 'rejected' | 'reimbursed' | 'closed' | 'cancelled';
  /** Motivo indicado por el administrador al rechazar */
  rejectionReason?: string;
  /** Quién rechazó: coordinador (revisión inicial) o contabilidad (aprobación final). */
  rejectedByRole?: 'coordinador' | 'contabilidad';
  expenseIds: any[];
  createdBy: any; // User who created it
  approvedBy?: any; // Admin who approved it
  projectId?: any;
  createdAt: string;
  updatedAt: string;
  // New fields
  accountNumber?: string;
  idDocument?: string;
  peopleNames?: string[];
  location?: string;
  startDate?: string;
  endDate?: string;
  items?: IExpenseReportBudgetItem[];
  settlement?: IExpenseReportSettlement;
  reimbursementPaymentInfo?: IReimbursementPaymentInfo;
  reimbursedAt?: string;
  returnVoucher?: {
    url: string;
    fileName?: string;
    depositDate: string;
    bankOrigin?: string;
    operationNumber?: string;
    /** Datos extraídos del comprobante por OCR/visión (informativos). */
    scannedAmount?: number;
    operationDate?: string;
    operationTime?: string;
    titular?: string;
    uploadedAt: string;
  };
  closureRecord?: IClosureRecord;
  coordinatorApprovedAt?: string;
  coordinatorApprovedBy?: any;
  contabilidadApprovedAt?: string;
  contabilidadApprovedBy?: any;
  /**
   * Derivado en backend: algún comprobante de la solicitud ya fue aprobado
   * (coordinador o contabilidad). Si es true, el colaborador ya no puede
   * eliminar la solicitud.
   */
  hasApprovedExpense?: boolean;
  /**
   * Derivado en backend: la solicitud la creó alguien distinto del dueño (ej.
   * Contabilidad creó la rendición directa para el colaborador). Si es true, el
   * dueño no puede eliminarla; solo Contabilidad.
   */
  createdByOther?: boolean;
  /**
   * Derivado en backend: la rendición directa se creó con saldo heredado de otra
   * rendición. Si es true, el dueño no puede eliminarla (rompería la cadena del
   * saldo); solo Contabilidad.
   */
  inheritedBalance?: boolean;
  /**
   * Derivado en backend: la caja chica ya fue incluida (jalada) por Contabilidad
   * en un reporte (borrador o finalizado). Si es true, el colaborador ya no puede
   * eliminarla; solo Contabilidad.
   */
  referencedByCajaChica?: boolean;
  reopenHistory?: Array<{ reason: string; reopenedBy: string; reopenedAt: string; fromStatus: string }>;
  motivo?: string;
  /** Código autoincremental único de la rendición directa (ej. RD-0001). */
  codigo?: string;
  /** Gestión que el colaborador realizará para estos gastos. */
  gestion?: string;
  isDirecta?: boolean;
  isCajaChica?: boolean;
  /**
   * Derivado en backend: la caja chica que incluye esta rendición ya fue
   * finalizada por Contabilidad, por lo que el colaborador no puede subir más gastos.
   */
  lockedByCajaChica?: boolean;
  /** Depósito inicial cuando la rendición directa fue iniciada por Contabilidad. */
  directaDeposit?: IDirectaDepositInfo;
  /** ID de la rendición directa de la que proviene el saldo heredado. */
  pendingBalanceFromReportId?: string;
  /** Monto heredado desde la rendición directa de origen. */
  pendingBalanceAmount?: number;
  /** ID de la rendición directa que consumió el saldo de esta. */
  pendingBalanceUsedInRendicionId?: string;
}

export interface IDirectaDepositInfo {
  amount: number;
  scannedAmount?: number;
  receiptUrl: string;
  receiptFileName?: string;
  receiptMimeType?: string;
  receiptSizeBytes?: number;
  depositDate?: string;
  operationNumber?: string;
  operationDate?: string;
  operationTime?: string;
  titular?: string;
  createdBy?: any;
  createdAt?: string;
}

export interface ICreateExpenseReport {
  title?: string;
  description?: string;
  budget?: number;
  userId: string;
  clientId: string;
  projectId?: string;
  motivo?: string;
  gestion?: string;
  isDirecta?: boolean;
  isCajaChica?: boolean;
  pendingBalanceFromReportId?: string;
  pendingBalanceAmount?: number;
  // New fields
  accountNumber?: string;
  idDocument?: string;
  peopleNames?: string[];
  location?: string;
  startDate?: string;
  endDate?: string;
  items?: IExpenseReportBudgetItem[];
}

export interface IRegisterReimbursementPaymentPayload {
  method: 'transferencia_bancaria' | 'efectivo' | 'cheque';
  bankName?: string;
  accountNumber?: string;
  cci?: string;
  transferDate: string;
  reference?: string;
  paymentReceiptUrl?: string;
  paymentReceiptFileName?: string;
  paymentReceiptMimeType?: string;
  paymentReceiptSizeBytes?: number;
  /** Datos extraídos del comprobante por OCR/visión (informativos). */
  scannedAmount?: number;
  operationNumber?: string;
  operationDate?: string;
  operationTime?: string;
  titular?: string;
}

export interface IMisDocumentoItem {
  kind: 'viatico_pago' | 'reembolso_rendicion';
  title: string;
  receiptUrl: string;
  receiptFileName?: string;
  date?: string;
  expenseReportId?: string;
  advanceId?: string;
  amountFormatted?: string;
  detailUrl?: string;
}

export interface IUpdateExpenseReport {
  title?: string;
  description?: string;
  budget?: number;
  status?:
    | 'solicited'
    | 'open'
    | 'submitted'
    | 'pending_accounting'
    | 'approved'
    | 'rejected'
    | 'reimbursed'
    | 'closed'
    | 'cancelled';
  rejectionReason?: string;
  expenseIds?: string[];
  // New fields
  accountNumber?: string;
  idDocument?: string;
  peopleNames?: string[];
  location?: string;
  startDate?: string;
  endDate?: string;
  items?: IExpenseReportBudgetItem[];
}
