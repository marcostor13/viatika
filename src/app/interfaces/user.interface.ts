export interface IUser {
  name: string;
  email: string;
  password: string;
  roleId: string;
  roleName?: string;
  roleKey?: string;
  clientId: string;
  isActive?: boolean;
}

export interface IClientResponse {
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

export interface IRoleResponse {
  _id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserResponse {
  _id: string;
  name: string;
  access_token: string;
  client: IClientResponse;
  role: IRoleResponse;
  roleId: string;
  roleName?: string;
  roleKey?: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}


