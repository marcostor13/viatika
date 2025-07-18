import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IHeaderList } from '../../interfaces/header-list.interface';

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [],
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss',
})
export class TableComponent {
  @Input() headers: IHeaderList[] = [];
  @Input() data: any[] = [];
  @Output() clickOptionsEvent = new EventEmitter<{ option: string; _id: string }>();

  options(option: string, _id: string) {
    this.clickOptionsEvent.emit({ option, _id });
  }
}
