import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ExpenseReportsService } from './expense-reports.service';
import { environment } from '../../environments/environment';

const API = `${environment.api}/expense-report`;
const REPORT_ID = '674000000000000000000001';

describe('ExpenseReportsService — Fase 5', () => {
  let service: ExpenseReportsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ExpenseReportsService],
    });
    service = TestBed.inject(ExpenseReportsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('createAffidavit POST /expense-report/:id/affidavit', () => {
    const payload = {
      type: 'viaticos_nacionales' as const,
      expenseIds: ['e1', 'e2'],
    };
    const mockResp = {
      reportId: REPORT_ID,
      type: payload.type,
      expenseIds: payload.expenseIds,
      generatedBy: 'admin-id',
      generatedAt: new Date().toISOString(),
    };

    service.createAffidavit(REPORT_ID, payload).subscribe((res) => {
      expect(res).toEqual(mockResp);
    });

    const req = http.expectOne(`${API}/${REPORT_ID}/affidavit`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResp);
  });
});
