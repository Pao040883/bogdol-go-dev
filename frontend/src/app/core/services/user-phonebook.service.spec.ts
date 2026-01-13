import { TestBed } from '@angular/core/testing';

import { UserPhonebookService } from './user-phonebook.service';

describe('UserPhonebookService', () => {
  let service: UserPhonebookService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserPhonebookService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
