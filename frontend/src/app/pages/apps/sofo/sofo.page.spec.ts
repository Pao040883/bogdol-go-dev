import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SofoPage } from './sofo.page';

describe('SofoPage', () => {
  let component: SofoPage;
  let fixture: ComponentFixture<SofoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SofoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
