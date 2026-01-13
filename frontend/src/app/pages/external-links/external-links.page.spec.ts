import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExternalLinksPage } from './external-links.page';

describe('ExternalLinksPage', () => {
  let component: ExternalLinksPage;
  let fixture: ComponentFixture<ExternalLinksPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ExternalLinksPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
