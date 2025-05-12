import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-list-table',
  imports: [
    CommonModule
  ],
  templateUrl: './list-table.component.html',
  styleUrl: './list-table.component.scss'
})
export class ListTableComponent {
  @Input() headers!: IHeaderList[];
  @Input() data!: any[];
  @Output() clickOptionsEvent = new EventEmitter<{ option: string, _id: string }>();


  toggleDetails(index: number) {
    this.data[index].isVisible = !this.data[index].isVisible;
  }

  clickOptions(option: string, _id: string) {
    this.clickOptionsEvent.emit({ option, _id });
  }
}
