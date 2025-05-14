export interface IInvoice {
  proyect: string;
  category: string;
  file: string;
  createdAt: string;
  updatedAt: string;
  total: string | number;
}

export interface IInvoiceResponse {
  _id: string;
  proyect: string;
  category: string;
  file: string;
  data: any;
  total: string;
  date: string;
  createdAt: string;
  updatedAt: string;

  // Campos adicionales para visualización
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
  category: string;
  imageUrl: string;
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
