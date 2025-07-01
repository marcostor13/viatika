export interface ISunatConfig {
  _id?: string;
  companyId: string;
  clientId: string;
  clientSecret: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISunatCredentials {
  clientId: string;
  clientSecret: string;
}
