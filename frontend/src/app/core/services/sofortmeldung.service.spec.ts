import { TestBed } from '@angular/core/testing';

import { SofortmeldungService } from './sofortmeldung.service';

describe('SofortmeldungService', () => {
  let service: SofortmeldungService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SofortmeldungService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
