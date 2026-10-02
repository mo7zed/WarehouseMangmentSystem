import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { ReturnsService } from './returns.service';
describe('Return pagination', () => {
  let api: jasmine.SpyObj<BaseApiService>;
  let service: ReturnsService;
  beforeEach(() => {
    api = jasmine.createSpyObj('BaseApiService', ['get']);
    TestBed.configureTestingModule({ providers: [{ provide: BaseApiService, useValue: api }] });
    service = TestBed.inject(ReturnsService);
  });
  it('requests the selected server page and respects total counts', () => {
    api.get.and.returnValue(of({ items: [{ id: 'return-26' }], totalCount: 26 }));
    service.getReturns('warehouse-a', 2, 25).subscribe(page => {
      expect(page.items[0].id).toBe('return-26'); expect(page.total).toBe(26); expect(page.hasNext).toBeFalse();
    });
    expect(api.get).toHaveBeenCalledWith('returns', { warehouseId: 'warehouse-a', page: 2, pageSize: 25 });
  });
  it('allows another page for an array response that fills the page', () => {
    api.get.and.returnValue(of(Array.from({ length: 25 }, (_, i) => ({ id: String(i) }))));
    service.getReturns('warehouse-a').subscribe(page => { expect(page.hasNext).toBeTrue(); expect(page.total).toBeNull(); });
  });
});
