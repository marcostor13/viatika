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
}

export interface InvoicePayload {
  proyect: string;
  category: string;
  file: string;
}
