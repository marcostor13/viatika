import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { IHeaderList } from '../../interfaces/header-list.interface';

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [],
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss',
})
export class TableComponent implements OnChanges {
  @Input() headers: IHeaderList[] = [];
  @Input() data: any[] = [];
  @Output() optionsEvent = new EventEmitter<{ option: string; _id: string }>();

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && changes['data'].currentValue) {
      console.log(
        '%c [TABLE] Datos recibidos en la tabla:',
        'background: #673ab7; color: white; padding: 2px 5px; border-radius: 3px;',
        this.data
      );

      // Verificar las propiedades críticas de los primeros elementos
      if (this.data.length > 0) {
        const firstItem = this.data[0];
        console.log(
          '%c [TABLE] Primera fila - propiedades claves:',
          'background: #673ab7; color: white; padding: 2px 5px; border-radius: 3px;',
          {
            serie: firstItem.serie,
            correlativo: firstItem.correlativo,
            ruc: firstItem.ruc,
            tipo: firstItem.tipo,
            provider: firstItem.provider,
          }
        );
      }
    }
  }

  options(option: string, _id: string) {
    this.optionsEvent.emit({ option, _id });
  }
}
