import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DirectReimbursementService } from './direct-reimbursement.service';
import { UserStateService } from './user-state.service';
import { environment } from '../../environments/environment';

describe('DirectReimbursementService', () => {
  let service: DirectReimbursementService;
  let httpMock: HttpTestingController;
  let userState: jasmine.SpyObj<UserStateService>;

  const BASE = `${environment.api}/direct-reimbursement`;

  beforeEach(() => {
    userState = jasmine.createSpyObj('UserStateService', ['getUser']);
    userState.getUser.and.returnValue({ companyId: 'c1' } as any);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        DirectReimbursementService,
        { provide: UserStateService, useValue: userState },
      ],
    });
    service = TestBed.inject(DirectReimbursementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('create sends POST', () => {
    service.create({ collaboratorId: 'u1' } as any).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('findAllByClient sends GET with clientId', () => {
    service.findAllByClient().subscribe();
    httpMock.expectOne(`${BASE}/client/c1`).flush([]);
  });

  it('findMy sends GET', () => {
    service.findMy().subscribe();
    httpMock.expectOne(`${BASE}/my/client/c1`).flush([]);
  });

  it('findPendingPayments sends GET', () => {
    service.findPendingPayments().subscribe();
    httpMock.expectOne(`${BASE}/pending-payments/client/c1`).flush([]);
  });

  it('findOne sends GET by id', () => {
    service.findOne('dr1').subscribe();
    httpMock.expectOne(`${BASE}/dr1`).flush({});
  });

  it('addExpense sends PATCH with expenseId', () => {
    service.addExpense('dr1', 'e1').subscribe();
    const req = httpMock.expectOne(`${BASE}/dr1/add-expense`);
    expect(req.request.body).toEqual({ expenseId: 'e1' });
    req.flush({});
  });

  it('removeExpense sends PATCH with expenseId', () => {
    service.removeExpense('dr1', 'e1').subscribe();
    const req = httpMock.expectOne(`${BASE}/dr1/remove-expense`);
    expect(req.request.body).toEqual({ expenseId: 'e1' });
    req.flush({});
  });

  it('coordinatorApprove sends PATCH', () => {
    service.coordinatorApprove('dr1').subscribe();
    httpMock.expectOne(`${BASE}/dr1/coordinator-approve`).flush({});
  });

  it('accountingApprove sends PATCH', () => {
    service.accountingApprove('dr1').subscribe();
    httpMock.expectOne(`${BASE}/dr1/accounting-approve`).flush({});
  });

  it('accountingReject sends PATCH with reason', () => {
    service.accountingReject('dr1', 'insufficient docs').subscribe();
    const req = httpMock.expectOne(`${BASE}/dr1/accounting-reject`);
    expect(req.request.body).toEqual({ reason: 'insufficient docs' });
    req.flush({});
  });

  it('registerPayment sends PATCH', () => {
    service.registerPayment('dr1', { amount: 500 } as any).subscribe();
    httpMock.expectOne(`${BASE}/dr1/register-payment`).flush({});
  });

  it('close sends PATCH', () => {
    service.close('dr1').subscribe();
    httpMock.expectOne(`${BASE}/dr1/close`).flush({});
  });

  it('addOverrunJustification sends PATCH with justification', () => {
    service.addOverrunJustification('dr1', 'justified reason').subscribe();
    const req = httpMock.expectOne(`${BASE}/dr1/overrun-justification`);
    expect(req.request.body).toEqual({ justification: 'justified reason' });
    req.flush({});
  });
});
