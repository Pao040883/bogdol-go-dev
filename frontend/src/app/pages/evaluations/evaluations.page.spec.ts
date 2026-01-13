import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EvaluationsPage } from './evaluations.page';

describe('EvaluationsPage', () => {
  let component: EvaluationsPage;
  let fixture: ComponentFixture<EvaluationsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EvaluationsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
