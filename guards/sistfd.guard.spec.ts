import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { sistfdGuard } from './sistfd.guard';

describe('sistfdGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => sistfdGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
