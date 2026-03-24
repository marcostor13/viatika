export interface IExpenseReportBudgetItem {
  description: string;
  amount: number;
  peopleCount: number;
  fuelAmount: number;
  daysCount: number;
  total: number;
}

export interface IExpenseReport {
  _id: string;
  title: string;
  description?: string;
  budget: number;
  userId: any; // Ideally IUserResponse or string ID
  clientId: string;
  status: 'solicited' | 'open' | 'submitted' | 'approved' | 'rejected' | 'closed';
  /** Motivo indicado por el administrador al rechazar */
  rejectionReason?: string;
  expenseIds: any[];
  createdBy: any; // User who created it
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
}

export interface ICreateExpenseReport {
  title: string;
  description?: string;
  budget?: number;
  userId: string;
  clientId: string;
  projectId?: string;
  // New fields
  accountNumber?: string;
  idDocument?: string;
  peopleNames?: string[];
  location?: string;
  startDate?: string;
  endDate?: string;
  items?: IExpenseReportBudgetItem[];
}

export interface IUpdateExpenseReport {
  title?: string;
  description?: string;
  budget?: number;
  status?: 'solicited' | 'open' | 'submitted' | 'approved' | 'rejected' | 'closed';
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
