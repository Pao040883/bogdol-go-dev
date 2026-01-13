import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkTicketsPage } from './work-tickets.page';

describe('WorkTicketsPage', () => {
  let component: WorkTicketsPage;
  let fixture: ComponentFixture<WorkTicketsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(WorkTicketsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
