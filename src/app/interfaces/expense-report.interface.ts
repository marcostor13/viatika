export interface IExpenseReport {
  _id: string;
  title: string;
  description?: string;
  budget: number;
  userId: any; // Ideally IUserResponse or string ID
  clientId: string;
  status: 'open' | 'submitted' | 'approved' | 'rejected' | 'closed';
  /** Motivo indicado por el administrador al rechazar */
  rejectionReason?: string;
  expenseIds: any[];
  createdBy: any; // User who created it
  projectId?: any;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateExpenseReport {
  title: string;
  description?: string;
  budget?: number;
  userId: string;
  clientId: string;
  projectId?: string;
}

export interface IUpdateExpenseReport {
  title?: string;
  description?: string;
  budget?: number;
  status?: 'open' | 'submitted' | 'approved' | 'rejected' | 'closed';
  rejectionReason?: string;
  expenseIds?: string[];
}
