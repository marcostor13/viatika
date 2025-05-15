export interface IInvoice {
  proyect: string;
  category: string;
  file: string;
  createdAt: string;
  updatedAt: string;
  total: string | number;
}

export type InvoiceStatus = 'pending' | 'approved' | 'rejected';

export interface IInvoiceResponse {
  _id: string;
  proyect: string;
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
  proyect: string;
  projectName?: string;
  category: string;
  imageUrl: string;
  status?: InvoiceStatus;
}

export interface ApprovalPayload {
  status: InvoiceStatus;
  userId: string;
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
