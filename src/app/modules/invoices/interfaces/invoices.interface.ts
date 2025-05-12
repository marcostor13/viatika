export interface IInvoice {
    proyect: string;
    category: string;
    file: string;
    createdAt: string;
    updatedAt: string;
}

export interface IInvoiceResponse {
    _id: string;
    proyect: string;
    category: string;
    file: string;
    data: any;
    total: number;
    createdAt: string;
    updatedAt: string;
}
