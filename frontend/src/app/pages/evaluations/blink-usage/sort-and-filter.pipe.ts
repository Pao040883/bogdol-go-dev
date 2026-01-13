import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sortAndFilter',
  standalone: true, // Pipe als standalone deklarieren
})
export class SortAndFilterPipe implements PipeTransform {
  transform(items: any[], sortField: string, sortDirection: 'asc' | 'desc', filter: string): any[] {
    if (!items || items.length === 0) return [];

    // Filterung
    let filteredItems = items;
    if (filter) {
      const lowerCaseFilter = filter.toLowerCase();
      filteredItems = items.filter((item) =>
        `${item.firstName} ${item.lastName}`.toLowerCase().includes(lowerCaseFilter)
      );
    }

    // Sortierung
    if (sortField) {
      filteredItems.sort((a, b) => {
        const valueA = a[sortField];
        const valueB = b[sortField];

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filteredItems;
  }
}
