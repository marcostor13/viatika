import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-list-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './list-table.component.html',
  styleUrl: './list-table.component.scss',
})
export class ListTableComponent {
  @Input() headers!: IHeaderList[];
  @Input() data!: any[];
  @Output() clickOptionsEvent = new EventEmitter<{
    option: string;
    _id: string;
  }>();

  toggleDetails(index: number) {
    this.data[index].isVisible = !this.data[index].isVisible;
  }

  clickOptions(option: string, _id: string) {
    this.clickOptionsEvent.emit({ option, _id });
  }

  isDateField(fieldName: string): boolean {
    const dateFields = [
      'date',
      'fecha',
      'createdAt',
      'updatedAt',
      'fechaCreacion',
      'fechaModificacion',
      'fechaEmision',
      'fechaVencimiento',
    ];
    return dateFields.some((field) => fieldName.toLowerCase().includes(field));
  }

  isTotalField(fieldName: string): boolean {
    const totalFields = ['total', 'monto', 'amount', 'precio', 'price'];
    return totalFields.some((field) => fieldName.toLowerCase().includes(field));
  }
}
