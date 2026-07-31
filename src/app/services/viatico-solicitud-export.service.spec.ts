import { TestBed } from '@angular/core/testing';
import {
  IViaticoSolicitudExportData,
  ViaticoSolicitudExportService,
} from './viatico-solicitud-export.service';
import { CompanyConfigService } from './company-config.service';
import { PlatformFileService } from './platform-file.service';
import ExcelJS from 'exceljs';

const mockCompanyConfigService = jasmine.createSpyObj('CompanyConfigService', ['getCompanyConfig']);

const makeData = (over: Partial<IViaticoSolicitudExportData> = {}): IViaticoSolicitudExportData => ({
  id: '665f1c2d9a4b7e0012345678',
  responsable: 'MAMANI LEON, ALEX YURI',
  cuenta: '19190936076019  /  CCI: 00219119093607601954',
  dni: '71818670',
  lugar: 'Lima, Perú',
  desde: '15/07/2026',
  hasta: '17/07/2026',
  proyecto: '61511 PETROPERÚ - Caracterización, ERSA, PDR',
  lines: [
    { categoria: 'EPPS PROY', detalle: 'ab', importe: 550, peopleCount: 1, glpPerDay: 0, days: 1, lineTotal: 550 },
  ],
  total: 550,
  ...over,
});

describe('ViaticoSolicitudExportService', () => {
  let service: ViaticoSolicitudExportService;
  let platformFile: jasmine.SpyObj<PlatformFileService>;

  beforeEach(() => {
    mockCompanyConfigService.getCompanyConfig.and.returnValue({
      _id: 'c1', companyId: 'c1', name: 'Test Co', businessName: 'Test Co SA', logo: '',
    });
    platformFile = jasmine.createSpyObj('PlatformFileService', ['saveBlob', 'fetchBinary']);
    platformFile.saveBlob.and.returnValue(Promise.resolve());
    platformFile.fetchBinary.and.returnValue(Promise.resolve(null));
    // Sin red en tests: el logo cae al respaldo y el documento igual se genera.
    spyOn(window, 'fetch').and.returnValue(Promise.reject('no network in tests') as any);

    TestBed.configureTestingModule({
      providers: [
        ViaticoSolicitudExportService,
        { provide: CompanyConfigService, useValue: mockCompanyConfigService },
        { provide: PlatformFileService, useValue: platformFile },
      ],
    });
    service = TestBed.inject(ViaticoSolicitudExportService);
  });

  const readWorkbook = async (blob: Blob): Promise<ExcelJS.Worksheet> => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    return wb.worksheets[0];
  };

  const cellText = (ws: ExcelJS.Worksheet, address: string): string => {
    const v = ws.getCell(address).value as any;
    if (v == null) return '';
    if (typeof v === 'object' && 'richText' in v) return v.richText.map((t: any) => t.text).join('');
    return String(v);
  };

  it('genera el PDF de la solicitud', async () => {
    await service.downloadPdf(makeData());
    const [blob, filename] = platformFile.saveBlob.calls.mostRecent().args;
    expect(filename).toBe('solicitud-viaticos-12345678.pdf');
    expect((blob as Blob).size).toBeGreaterThan(0);
  });

  it('el Excel lleva la cabecera de la solicitud y la tabla de líneas', async () => {
    await service.downloadExcel(makeData());

    const [blob, filename] = platformFile.saveBlob.calls.mostRecent().args;
    expect(filename).toBe('solicitud-viaticos-12345678.xlsx');

    const ws = await readWorkbook(blob as Blob);
    expect(cellText(ws, 'A2')).toBe('SOLICITUD DE VIÁTICOS');
    expect(cellText(ws, 'A3')).toBe('Responsable:');
    expect(cellText(ws, 'B3')).toBe('MAMANI LEON, ALEX YURI');
    expect(cellText(ws, 'B5')).toBe('71818670');
    // Cantidad de personas se deriva del máximo de las líneas.
    expect(cellText(ws, 'B6')).toBe('1');
    expect(cellText(ws, 'B7')).toBe('Lima, Perú');
    expect(cellText(ws, 'C8')).toBe('15/07/2026');
    expect(cellText(ws, 'E8')).toBe('17/07/2026');
    expect(cellText(ws, 'B9')).toBe('61511 PETROPERÚ - Caracterización, ERSA, PDR');
    expect(cellText(ws, 'A11')).toBe('Viáticos');
    expect(cellText(ws, 'A12')).toBe('EPPS PROY');
    expect(ws.getCell('G12').value).toBe(550);
    expect(cellText(ws, 'A13')).toBe('TOTAL');
    expect(ws.getCell('G13').value).toBe(550);
  });

  it('imprime el financiamiento por bolsa y lo que falta depositar', async () => {
    await service.downloadExcel(makeData({
      total: 550,
      financiamiento: [
        { label: 'Saldo de rendición · RD-0042', amount: 300 },
        { label: 'Depósito de Contabilidad', amount: 150 },
        { label: 'Cero, no se imprime', amount: 0 },
      ],
      pendienteDeposito: 100,
    }));

    const [blob] = platformFile.saveBlob.calls.mostRecent().args;
    const ws = await readWorkbook(blob as Blob);
    const filas: string[] = [];
    ws.eachRow({ includeEmpty: false }, row => filas.push(String(row.values)));
    const texto = filas.join(' | ');

    expect(texto).toContain('Financiamiento');
    expect(texto).toContain('Saldo de rendición · RD-0042');
    expect(texto).toContain('Depósito de Contabilidad');
    expect(texto).toContain('Pendiente de depósito de Contabilidad');
    expect(texto).not.toContain('Cero, no se imprime');
  });

  it('sin financiamiento no imprime el bloque', async () => {
    await service.downloadExcel(makeData({ pendienteDeposito: 550 }));
    const [blob] = platformFile.saveBlob.calls.mostRecent().args;
    const ws = await readWorkbook(blob as Blob);
    const filas: string[] = [];
    ws.eachRow({ includeEmpty: false }, row => filas.push(String(row.values)));
    expect(filas.join(' | ')).not.toContain('Financiamiento');
  });

  it('agrega la fila de saldo anterior cuando lo hay', async () => {
    await service.downloadExcel(makeData({ saldoAnterior: 250.5 }));
    const [blob] = platformFile.saveBlob.calls.mostRecent().args;
    const ws = await readWorkbook(blob as Blob);
    expect(cellText(ws, 'A12')).toBe('Saldo anterior');
    expect(ws.getCell('G12').value).toBe(250.5);
    expect(cellText(ws, 'A13')).toBe('EPPS PROY');
  });

  it('funciona sin líneas', async () => {
    await service.downloadPdf(makeData({ lines: [], total: 0 }));
    expect(platformFile.saveBlob).toHaveBeenCalled();
  });
});
