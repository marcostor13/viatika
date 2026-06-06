export interface IProject {
  _id?: string;
  name: string;
  code?: string;
  isActive?: boolean;
  description?: string;
  /** Centro / empresa cliente cuando el API devuelve populate */
  client?: { _id?: string; comercialName?: string; businessName?: string };
  /** Línea de negocio asignada (id) */
  lineaNegocioId?: string;
  /** Línea de negocio poblada (nombre/código) cuando el API la devuelve */
  lineaNegocio?: { _id?: string; name?: string; code?: string };
  /** Perfil de categoría asignado (id) */
  categoryGroupId?: string;
  /** Perfil de categoría poblado (nombre) cuando el API lo devuelve */
  categoryGroup?: { _id?: string; name?: string };
  createdAt?: Date;
  updatedAt?: Date;
}
