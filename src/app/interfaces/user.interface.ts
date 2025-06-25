export interface IUser {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive?: boolean;
  userId?: string;
  companyId?: string;
  status?: string;
  phone?: string;
  password?: string; // Campo opcional para creación de usuarios
  createdAt?: Date;
  updatedAt?: Date;
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
  clientId?: IClient;
  roleId?: IRole;
  name?: string; // Campo para compatibilidad
}

export interface IUserCreate {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  companyId?: string;
}

export interface IUserUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
  companyId?: string;
}
