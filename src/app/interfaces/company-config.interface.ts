export interface ICompanyConfig {
  _id?: string;
  companyId: string;
  name: string;
  logo?: string;
  logoFile?: File;
  businessId?: string;
  businessName?: string;
  comercialName?: string;
  email?: string;
  phone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
