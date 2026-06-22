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
 * Tabla reutilizable y responsiva.
 *
 * - A >=1600px (`tbl:` en Tailwind) se renderiza como tabla clásica.
 * - A <1600px cada fila se convierte en una card apilada con pares
 *   etiqueta/valor, reutilizando las mismas plantillas de celda.
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

  /** Ancho mínimo de la tabla antes de hacer scroll horizontal. */
  @Input() minWidth = '700px';

  /** Emitido al hacer click en una fila/card (cuando rowClickable). */
  @Output() rowClick = new EventEmitter<{ row: any; event: Event }>();

  @ContentChildren(ColumnDirective) private columns!: QueryList<ColumnDirective>;

  get cols(): ColumnDirective[] {
    return this.columns ? this.columns.toArray() : [];
  }

  get cardCols(): ColumnDirective[] {
    return this.cols.filter((c) => c.inCard);
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
