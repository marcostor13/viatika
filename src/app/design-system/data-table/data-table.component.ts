import {
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  Output,
  QueryList,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColumnDirective } from './column.directive';

/**
 * Tabla reutilizable.
 *
 * Por defecto la tabla SE AJUSTA al ancho disponible (sin `minWidth`): al
 * reducir la pantalla las columnas no se ocultan, el texto de cada celda se
 * envuelve (wrap) según sus clases y toda la tabla queda visible sin scroll.
 * Si se necesita un ancho mínimo (p.ej. para forzar scroll en tablas muy
 * densas) puede pasarse `minWidth`.
 *
 * Las columnas se declaran con la directiva `*appColumn` (ver ColumnDirective).
 * Los estados de carga/vacío los maneja el componente padre; aquí solo se pinta
 * la colección de `items`.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.component.html',
})
export class DataTableComponent {
  /** Filas a renderizar. */
  @Input() items: any[] = [];

  /** Propiedad usada como identidad de fila para el `track`. */
  @Input() trackKey = '_id';

  /** Si la fila/card es clickeable (cursor + emite rowClick). */
  @Input() rowClickable = false;

  /**
   * Ancho mínimo opcional. Vacío (por defecto) = la tabla se ajusta al
   * contenedor y se ve completa. Si se define (p.ej. '900px'), por debajo de
   * ese ancho aparece scroll horizontal.
   */
  @Input() minWidth = '';

  /** Emitido al hacer click en una fila/card (cuando rowClickable). */
  @Output() rowClick = new EventEmitter<{ row: any; event: Event }>();

  @ContentChildren(ColumnDirective) private columns!: QueryList<ColumnDirective>;

  get cols(): ColumnDirective[] {
    return this.columns ? this.columns.toArray() : [];
  }

  trackRow = (index: number, row: any): unknown => row?.[this.trackKey] ?? index;

  onRowClick(row: any, event: Event): void {
    if (this.rowClickable) this.rowClick.emit({ row, event });
  }

  alignClass(align: ColumnDirective['align']): string {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
  }
}
