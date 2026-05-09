export interface ICategory {
  _id?: string;
  key?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  limit?: number | null;
  parentId?: string | null;
  children?: ICategory[];
  createdAt?: Date;
  updatedAt?: Date;
  companyId?: string;
  clientId?: string;
}
