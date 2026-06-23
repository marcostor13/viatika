import { Directive, Input, TemplateRef } from '@angular/core';

/**
 * Define una columna para `<app-data-table>`. Es una directiva estructural: el
 * contenido marcado con `*appColumn` se captura como plantilla y la tabla lo
 * reutiliza tanto en la vista de tabla (>=1600px) como en la de cards (<1600px),
 * de modo que el renderizado de cada celda vive en un solo lugar.
 *
 * Uso:
 *   <ng-container *appColumn="'fecha'; header: 'Fecha'; align: 'left'; let row">
 *     {{ row.createdAt | date }}
 *   </ng-container>
 *
 * El contexto implícito (`let row`) es la fila actual; `let i = index` da el índice.
 */
@Directive({
  selector: '[appColumn]',
  standalone: true,
})
export class ColumnDirective {
  /** Clave única de la columna (también usada como track). */
  @Input('appColumn') key = '';

  /** Texto de cabecera (tabla) y etiqueta por defecto en card. */
  @Input('appColumnHeader') header = '';

  /** Alineación del contenido. */
  @Input('appColumnAlign') align: 'left' | 'center' | 'right' = 'left';

  /** Clases extra para la celda (td) y el contenedor en card. */
  @Input('appColumnCellClass') cellClass = '';

  /** Clases extra solo para la cabecera (th). */
  @Input('appColumnHeaderClass') headerClass = '';

  /**
   * Clases de visibilidad responsiva aplicadas SOLO en la vista de tabla,
   * p.ej. 'hidden md:table-cell' para ocultar en anchos intermedios.
   */
  @Input('appColumnHideOn') hideOn = '';

  /** Si la columna aparece en la vista de card (<1600px). */
  @Input('appColumnInCard') inCard = true;

  /** Etiqueta a mostrar en la card; si está vacía se usa `header`. */
  @Input('appColumnCardLabel') cardLabel = '';

  /**
   * En card, ocupa todo el ancho sin etiqueta (útil para acciones, títulos
   * principales o descripciones largas).
   */
  @Input('appColumnCardFull') cardFull = false;

  constructor(public tpl: TemplateRef<{ $implicit: any; index: number }>) {}

  // Permite el tipado del contexto de la plantilla en modo estricto.
  static ngTemplateContextGuard(
    _dir: ColumnDirective,
    _ctx: unknown,
  ): _ctx is { $implicit: any; index: number } {
    return true;
  }
}
