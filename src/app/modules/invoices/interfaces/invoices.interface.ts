import { IProject } from './project.interface';
import { ICategory } from './category.interface';
export interface IInvoice {
  proyect: string;
  category: string;
  file: string;
  createdAt: string;
  updatedAt: string;
  total: string | number;
}

export type InvoiceStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'pending'
  | 'approved'
  | 'rejected';

export interface IInvoiceResponse {
  _id: string;
  proyect: string;
  proyectId: IProject;
  categoryId: ICategory;
  projectName?: string;
  category: string;
  file: string;
  data: any;
  total: string;
  date: string;
  createdAt: string;
  updatedAt: string;

  status?: InvoiceStatus;
  statusDate?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;

  provider?: string;
  ruc?: string;
  address?: string;
  tipo?: string;
  correlativo?: string;
  serie?: string;
  montoTotal?: number;
  moneda?: string;
}

export interface InvoicePayload {
  proyectId: string;
  categoryId: string;
  imageUrl: string;
  status?: InvoiceStatus;
}

export interface ApprovalPayload {
  status: InvoiceStatus;
  userId?: string;
  reason?: string;
}

export interface InvoiceData {
  rucEmisor?: string;
  tipoComprobante?: string;
  serie?: string;
  correlativo?: string;
  fechaEmision?: string;
  moneda?: string;
  montoTotal?: number;
  razonSocial?: string;
  direccionEmisor?: string;
}

export interface SunatValidationResult {
  status:
  | 'VALIDO_ACEPTADO'
  | 'VALIDO_NO_PERTENECE'
  | 'NO_ENCONTRADO'
  | 'ERROR_SUNAT';
  details: any;
  message: string;
}

export interface SunatValidationInfo {
  expenseId: string;
  status: InvoiceStatus;
  sunatValidation: SunatValidationResult | null;
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
