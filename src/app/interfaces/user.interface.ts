export interface IUser {
  email: string;
  name: string;
}

export interface IClient {
  _id: string;
  comercialName: string;
  businessName: string;
  businessId: string; //ruc
  address: string;
  phone: string;
  email: string;
  logo: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRole {
  _id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserResponse extends IUser {
  _id: string;
  access_token: string;
  clientId: IClient;
  roleId: IRole;
  role: string;
}
