import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbsencesPage } from './absences.page';

describe('AbsencesPage', () => {
  let component: AbsencesPage;
  let fixture: ComponentFixture<AbsencesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AbsencesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
