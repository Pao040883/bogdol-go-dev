import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsListPage } from './contacts-list.page';

describe('ContactsListPage', () => {
  let component: ContactsListPage;
  let fixture: ComponentFixture<ContactsListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ContactsListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
