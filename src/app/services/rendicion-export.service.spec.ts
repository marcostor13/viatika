import { TestBed } from '@angular/core/testing';
import {
  RendicionExportService,
  RendicionExportData,
  AffidavitExportData,
  MobilitySheetExportData,
  CashVoucherExportData,
  ReceiptExportData,
  SingleExpenseAffidavitData,
} from './rendicion-export.service';
import { CompanyConfigService } from './company-config.service';
import { PlatformFileService } from './platform-file.service';
import ExcelJS from 'exceljs';

const mockCompanyConfigService = jasmine.createSpyObj('CompanyConfigService', ['getCompanyConfig']);

const makeRendicionData = (): RendicionExportData => ({
  fileBaseName: 'test-rendicion',
  titulo: 'Rendición Test',
  estado: 'open',
  colaborador: 'Juan Pérez',
  presupuesto: 1000,
  totalGastado: 800,
  totalAnticipado: 500,
  saldoLibre: 200,
  fechaGeneracion: '01/01/2026',
  comprobantes: [],
  anticipos: [],
});

describe('RendicionExportService', () => {
  let service: RendicionExportService;
  let platformFile: jasmine.SpyObj<PlatformFileService>;

  beforeEach(() => {
    platformFile = jasmine.createSpyObj('PlatformFileService', ['saveBlob', 'fetchBinary']);
    platformFile.saveBlob.and.returnValue(Promise.resolve());
    platformFile.fetchBinary.and.returnValue(Promise.resolve(null));
    mockCompanyConfigService.getCompanyConfig.and.returnValue({
      _id: 'c1',
      companyId: 'c1',
      name: 'Test Co',
      businessName: 'Test Co SA',
      logo: '',
    });

    // Prevent blob URL creation for Excel downloads
    spyOn(URL, 'createObjectURL').and.returnValue('blob:test-url');
    spyOn(URL, 'revokeObjectURL').and.returnValue(undefined);
    // Prevent network calls for logo fetch
    spyOn(window, 'fetch').and.returnValue(Promise.reject('no network in tests'));
    // Prevent anchor click (Excel download trigger)
    spyOn(HTMLAnchorElement.prototype, 'click').and.returnValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        RendicionExportService,
        { provide: CompanyConfigService, useValue: mockCompanyConfigService },
        { provide: PlatformFileService, useValue: platformFile },
      ],
    });

    service = TestBed.inject(RendicionExportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ─── Async PDF methods ────────────────────────────────────────────────

  describe('exportAffidavitToPdf', () => {
    it('resolves for minimal data', async () => {
      const data: AffidavitExportData = {
        fileBaseName: 'afidavit-2026',
        tipo: 'viaticos_nacionales',
        empresaNombre: 'Empresa SA',
        empresaRuc: '20123456789',
        colaborador: 'Juan Pérez',
        fechaGeneracion: '01/01/2026',
        total: 500,
        rows: [],
      };
      await expectAsync(service.exportAffidavitToPdf(data)).toBeResolved();
    });

    it('resolves when rows array is populated', async () => {
      const data: AffidavitExportData = {
        fileBaseName: 'afidavit',
        tipo: 'viajes_exterior',
        empresaNombre: 'Co SA',
        empresaRuc: '20000000001',
        colaborador: 'María García',
        fechaGeneracion: '15/05/2026',
        total: 1200,
        rows: [
          { fecha: '01/05/2026', documento: 'FAC-001', concepto: 'Hotel', categoria: 'Alojamiento', monto: 600 },
          { fecha: '02/05/2026', documento: 'FAC-002', concepto: 'Taxi', categoria: 'Transporte', monto: 600 },
        ],
        signature: undefined,
      };
      await expectAsync(service.exportAffidavitToPdf(data)).toBeResolved();
    });
  });

  describe('exportReceiptToPdf', () => {
    it('resolves for full data', async () => {
      const data: ReceiptExportData = {
        fileBaseName: 'recibo-test',
        collaborator: 'Juan Pérez',
        collaboratorDni: '12345678',
        razonSocial: 'Proveedor SA',
        ruc: '20111111111',
        numeroDocumento: 'RC-001',
        concepto: 'Servicios de consultoría',
        fecha: '01/01/2026',
        monto: 250,
      };
      await expectAsync(service.exportReceiptToPdf(data)).toBeResolved();
    });

    it('resolves when optional fields are absent', async () => {
      const data: ReceiptExportData = {
        fileBaseName: 'recibo-minimal',
        collaborator: 'Ana López',
        razonSocial: 'Co',
        concepto: 'Gastos varios',
        fecha: '01/01/2026',
        monto: 100,
      };
      await expectAsync(service.exportReceiptToPdf(data)).toBeResolved();
    });
  });

  describe('exportSingleExpenseAffidavitToPdf', () => {
    it('resolves for minimal data', async () => {
      const data: SingleExpenseAffidavitData = {
        fileBaseName: 'single-dj-test',
        titulo: 'Declaración Jurada de Gastos',
        colaborador: 'Juan Pérez',
        colaboradorDni: '12345678',
        fechaGeneracion: '01/01/2026',
        total: 50,
      };
      await expectAsync(service.exportSingleExpenseAffidavitToPdf(data)).toBeResolved();
    });

    it('resolves with mobility rows', async () => {
      const data: SingleExpenseAffidavitData = {
        fileBaseName: 'single-mobility',
        titulo: 'DJ Movilidad',
        colaborador: 'Carlos',
        fechaGeneracion: '01/01/2026',
        total: 80,
        mobilityRows: [
          { fecha: '01/01', clienteProveedor: 'Empresa', origen: 'Lima', destino: 'Callao', gestion: 'Reunión', total: 40 },
        ],
      };
      await expectAsync(service.exportSingleExpenseAffidavitToPdf(data)).toBeResolved();
    });
  });

  // ─── Other async PDF/Excel methods ────────────────────────────────────

  describe('exportToPdf', () => {
    it('resolves without throwing for minimal rendicion data', async () => {
      await expectAsync(service.exportToPdf(makeRendicionData())).toBeResolved();
    });

    it('resolves without throwing when comprobantes are present', async () => {
      const data: RendicionExportData = {
        ...makeRendicionData(),
        comprobantes: [
          { tipo: 'factura', fecha: '01/01/2026', descripcion: 'Hotel', monto: 400, estadoComprobante: 'approved', proveedor: 'Hoteles SA', numeroDocumento: 'FAC-001' },
        ],
        anticipos: [{ descripcion: 'Anticipo Enero', monto: 500, estado: 'paid', fechaSolicitud: '01/12/2025' }],
        settlement: { advanceTotal: 500, expenseTotal: 400, difference: 100, typeLabel: 'Devolución' },
      };
      await expectAsync(service.exportToPdf(data)).toBeResolved();
    });
  });

  describe('exportMobilitySheetToPdf', () => {
    it('resolves without throwing for empty rows', async () => {
      const data: MobilitySheetExportData = {
        fileBaseName: 'mobility-test',
        collaborator: 'Juan Pérez',
        collaboratorDni: '12345678',
        generatedAt: '01/01/2026',
        rows: [],
        total: 0,
      };
      await expectAsync(service.exportMobilitySheetToPdf(data)).toBeResolved();
    });

    it('resolves without throwing when rows are present', async () => {
      const data: MobilitySheetExportData = {
        fileBaseName: 'mobility-rows',
        collaborator: 'María',
        generatedAt: '01/01/2026',
        rows: [
          { fecha: '01/01', clienteProveedor: 'Empresa', origen: 'Lima', destino: 'Miraflores', gestion: 'Gestión', total: 30 },
        ],
        total: 30,
      };
      await expectAsync(service.exportMobilitySheetToPdf(data)).toBeResolved();
    });
  });

  describe('exportCashVoucherToPdf', () => {
    it('resolves without throwing for minimal data', async () => {
      const data: CashVoucherExportData = {
        fileBaseName: 'cash-voucher',
        collaborator: 'Juan',
        entregadoA: 'Pedro López',
        concepto: 'Gastos de representación',
        monto: 150,
        generatedAt: '01/01/2026',
      };
      await expectAsync(service.exportCashVoucherToPdf(data)).toBeResolved();
    });

    it('resolves without throwing with all optional fields', async () => {
      const data: CashVoucherExportData = {
        fileBaseName: 'cash-full',
        collaborator: 'Ana',
        collaboratorDni: '87654321',
        internalCode: 'EMP-001',
        entregadoA: 'Carlos',
        direccion: 'Av. Lima 100',
        concepto: 'Servicios',
        monto: 300,
        generatedAt: '15/05/2026',
        projectName: 'Proyecto Alpha',
        clientName: 'Cliente SA',
        fechaEmision: '15/05/2026',
      };
      await expectAsync(service.exportCashVoucherToPdf(data)).toBeResolved();
    });
  });

  // ─── Excel methods ────────────────────────────────────────────────────

  describe('exportToExcel', () => {
    it('resolves without throwing for empty rendicion', async () => {
      await expectAsync(service.exportToExcel(makeRendicionData())).toBeResolved();
    });

    it('resolves without throwing when comprobantes are present', async () => {
      const data: RendicionExportData = {
        ...makeRendicionData(),
        comprobantes: [
          { tipo: 'factura', fecha: '01/01/2026', descripcion: 'Vuelo', monto: 800, estadoComprobante: 'approved' },
        ],
      };
      await expectAsync(service.exportToExcel(data)).toBeResolved();
    });
  });

  describe('exportMobilitySheetToExcel', () => {
    it('resolves without throwing for empty rows', async () => {
      const data: MobilitySheetExportData = {
        fileBaseName: 'mobility-excel',
        collaborator: 'Juan',
        generatedAt: '01/01/2026',
        rows: [],
        total: 0,
      };
      await expectAsync(service.exportMobilitySheetToExcel(data)).toBeResolved();
    });

    it('resolves without throwing with populated rows', async () => {
      const data: MobilitySheetExportData = {
        fileBaseName: 'mobility-excel-rows',
        collaborator: 'María García',
        collaboratorDni: '11111111',
        internalCode: 'MG-01',
        location: 'Lima',
        generatedAt: '01/01/2026',
        rows: [
          { fecha: '01/01', clienteProveedor: 'Co', origen: 'A', destino: 'B', gestion: 'G', total: 25 },
          { fecha: '02/01', clienteProveedor: 'Co', origen: 'B', destino: 'C', gestion: 'G', total: 30 },
        ],
        total: 55,
      };
      await expectAsync(service.exportMobilitySheetToExcel(data)).toBeResolved();
    });
  });

  // ─── Solicitud de viáticos: mismo formato de la rendición, con TOTAL ────────

  describe('solicitud de viáticos', () => {
    const makeSolicitudData = (): RendicionExportData => ({
      ...makeRendicionData(),
      fileBaseName: 'solicitud_VT-0001_proyecto',
      projectName: '63882 SERVICIO DE ELABORACIÓN DE INFORME',
      codigo: 'VT-0001',
      colaborador: 'COBEÑAS GARCIA, JULIO CESAR',
      idDocument: '43215678',
      accountNumber: '00219119093607601954',
      location: 'Talara, Perú',
      startDate: '31/07/2026',
      endDate: '31/07/2026',
      comprobantes: [],
      anticipos: [],
      items: [
        { descripcion: 'ALIMENTACIÓN PROY — Desayuno y almuerzo', importe: 60, personas: 1, combustible: 0, dias: 1, total: 60 },
        { descripcion: 'MATERIALES — Trípticos', importe: 40, personas: 1, combustible: 0, dias: 1, total: 40 },
      ],
      itemsTotal: 100,
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

    it('el Excel usa el mismo formato de la rendición y lista el presupuesto detallado', async () => {
      await service.exportToExcel(makeSolicitudData());

      const [blob, filename] = platformFile.saveBlob.calls.mostRecent().args;
      expect(filename).toBe('solicitud_VT-0001_proyecto.xlsx');

      const ws = await readWorkbook(blob as Blob);
      expect(cellText(ws, 'A4')).toBe('RENDICIÓN DE VIÁTICOS');
      expect(cellText(ws, 'A5')).toContain('63882 SERVICIO DE ELABORACIÓN DE INFORME');
      expect(cellText(ws, 'A7')).toBe('DEL 31/07/2026 AL 31/07/2026');
      expect(cellText(ws, 'B9')).toBe('COBEÑAS GARCIA, JULIO CESAR');
      expect(cellText(ws, 'B10')).toBe('Talara, Perú');
      expect(cellText(ws, 'F9')).toBe('43215678');
      expect(cellText(ws, 'F10')).toBe('00219119093607601954');
      expect(cellText(ws, 'A13')).toBe('Item');

      const rows: string[] = [];
      ws.eachRow({ includeEmpty: false }, row => rows.push(String(row.values)));
      const flat = rows.join(' | ');
      expect(flat).toContain('RESUMEN DE SOLICITUD (PRESUPUESTO DETALLADO)');
      expect(flat).toContain('ALIMENTACIÓN PROY — Desayuno y almuerzo');
      const totalRow = ws.getRows(1, ws.rowCount)!.find(r => cellText(ws, `A${r.number}`) === 'TOTAL');
      expect(totalRow).toBeTruthy();
      expect(ws.getCell(`F${totalRow!.number}`).value).toBe(100);
    });

    it('el PDF de la solicitud se genera sin gastos', async () => {
      await service.exportToPdf(makeSolicitudData());
      const [blob, filename] = platformFile.saveBlob.calls.mostRecent().args;
      expect(filename).toBe('solicitud_VT-0001_proyecto.pdf');
      expect((blob as Blob).size).toBeGreaterThan(0);
    });

    it('sin itemsTotal la rendición no agrega la fila TOTAL', async () => {
      await service.exportToExcel({
        ...makeRendicionData(),
        items: [{ descripcion: 'Alimentación', importe: 50, personas: 1, combustible: 0, dias: 1, total: 50 }],
      });
      const [blob] = platformFile.saveBlob.calls.mostRecent().args;
      const ws = await readWorkbook(blob as Blob);
      expect(cellText(ws, 'A4')).toBe('RENDICIÓN DE VIÁTICOS');
      const totalRow = ws.getRows(1, ws.rowCount)!.find(r => cellText(ws, `A${r.number}`) === 'TOTAL');
      expect(totalRow).toBeUndefined();
    });
  });
});
