import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlinkUsagePage } from './blink-usage.page';

describe('BlinkUsagePage', () => {
  let component: BlinkUsagePage;
  let fixture: ComponentFixture<BlinkUsagePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BlinkUsagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
