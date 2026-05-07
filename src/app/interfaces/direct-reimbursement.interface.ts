export type DirectReimbursementStatus =
  | 'open'
  | 'expenses_loaded'
  | 'coordinator_approved'
  | 'accounting_approved'
  | 'paid'
  | 'closed'
  | 'rejected';

export interface IDirectReimbursementPaymentInfo {
  transferDate: string;
  amount: number;
  operationNumber: string;
  receiptUrl: string;
  receiptFileName?: string;
  paidBy: string;
  paidAt: string;
}

export interface IDirectReimbursement {
  _id: string;
  code: string;
  collaboratorId: { _id: string; name: string; email: string } | string;
  coordinatorId: { _id: string; name: string; email: string } | string;
  clientId: string;
  status: DirectReimbursementStatus;
  justification: string;
  estimatedAmount: number;
  overrunJustification?: string;
  expenseIds: Array<{ _id: string; total: number; status?: string } | string>;
  paymentInfo?: IDirectReimbursementPaymentInfo;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  closedAt?: string;
  closedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateDirectReimbursementPayload {
  collaboratorId?: string;
  coordinatorId?: string;
  clientId?: string;
  justification: string;
  estimatedAmount: number;
}

export interface IRegisterDirectReimbursementPaymentPayload {
  transferDate: string;
  amount: number;
  operationNumber: string;
  receiptUrl: string;
  receiptFileName?: string;
}

export const DIRECT_REIMBURSEMENT_STATUS_LABELS: Record<DirectReimbursementStatus, string> = {
  open: 'Abierto',
  expenses_loaded: 'Gastos cargados',
  coordinator_approved: 'Aprobado coordinador',
  accounting_approved: 'Aprobado contabilidad',
  paid: 'Pagado',
  closed: 'Cerrado',
  rejected: 'Rechazado',
};

export const DIRECT_REIMBURSEMENT_STATUS_COLORS: Record<DirectReimbursementStatus, string> = {
  open: 'bg-gray-100 text-gray-600',
  expenses_loaded: 'bg-yellow-100 text-yellow-700',
  coordinator_approved: 'bg-blue-100 text-blue-700',
  accounting_approved: 'bg-indigo-100 text-indigo-700',
  paid: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};
