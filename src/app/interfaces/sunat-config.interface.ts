export interface ISunatConfig {
  _id?: string;
  clientId: string;
  clientIdSunat: string;
  clientSecret: string;
  ruc: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISunatCredentials {

  clientIdSunat: string;
  clientSecret: string;
}
