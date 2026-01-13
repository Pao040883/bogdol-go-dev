import { Pipe, PipeTransform } from '@angular/core';
import { Specialty } from '../../models/organization.model';

@Pipe({
  name: 'filterByDepartment',
  standalone: true
})
export class FilterByDepartmentPipe implements PipeTransform {
  transform(specialties: Specialty[], departmentId: number): Specialty[] {
    if (!specialties || !departmentId) {
      return [];
    }
    return specialties.filter(s => s.department === departmentId);
  }
}
