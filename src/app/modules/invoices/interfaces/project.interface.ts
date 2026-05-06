export interface IProject {
  _id?: string;
  name: string;
  code?: string;
  isActive?: boolean;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
