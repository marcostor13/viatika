import { RendicionDetailComponent } from './rendicion-detail.component';

/**
 * Aritmética de moneda del detalle de una rendición. Se prueba sobre el
 * prototipo (sin TestBed): son getters puros sobre `report`/`advances`, y
 * levantar el componente completo arrastraría una docena de servicios que no
 * intervienen en el cálculo.
 *
 * El caso replica el reportado por el cliente: viático de USD 450 a Buenos
 * Aires con dos declaraciones juradas en dólares y un comprobante pagado en
 * soles en Perú (S/ 54.45 al TC 3.556 del día = USD 15.31).
 */
describe('RendicionDetailComponent — moneda de la rendición', () => {
  const crear = (report: unknown, advances: unknown[] = []) => {
    const comp = Object.create(RendicionDetailComponent.prototype) as any;
    comp.report = report;
    comp.advances = advances;
    comp.totalGastado = 0;
    comp.totalGastadoReporte = 0;
    comp.calculateTotals();
    return comp;
  };

  const viaticoUsd = () => ({
    type: 'viatico',
    moneda: 'USD',
    tipoCambio: 3.556,
    viaticoAmount: 450,
    viaticoAmountBase: 1600.2,
    viaticoPaidAmount: 450,
    expenseIds: [
      // DJ alimentación: nativa en dólares
      {
        total: 88,
        moneda: 'USD',
        montoBase: 309.94,
        tipoCambio: 3.522,
        monedaReporte: 'USD',
        tcReporte: 3.522,
        montoReporte: 88,
      },
      // DJ movilidad: nativa en dólares
      {
        total: 219,
        moneda: 'USD',
        montoBase: 775.26,
        tipoCambio: 3.54,
        monedaReporte: 'USD',
        tcReporte: 3.54,
        montoReporte: 219,
      },
      // Comprobante pagado en soles en Perú
      {
        total: 54.45,
        moneda: 'PEN',
        montoBase: 54.45,
        tipoCambio: 1,
        monedaReporte: 'USD',
        tcReporte: 3.556,
        montoReporte: 15.31,
      },
    ],
  });

  it('suma el gastado en la moneda del viático, no en soles', () => {
    const comp = crear(viaticoUsd());
    expect(comp.totalGastadoReporte).toBe(322.31);
  });

  it('mantiene el equivalente en soles para la línea secundaria', () => {
    const comp = crear(viaticoUsd());
    // 309.94 + 775.26 + 54.45
    expect(comp.totalGastado).toBeCloseTo(1139.65, 2);
  });

  it('calcula el saldo en dólares (antes restaba USD contra soles)', () => {
    const comp = crear(viaticoUsd());
    expect(comp.saldoLibre).toBe(127.69);
    expect(comp.monedaPrefijo).toBe('USD');
    expect(comp.saldoLibreBase).toBeCloseTo(454.07, 2);
  });

  it('el comprobante en soles se descuenta convertido con el TC de su día', () => {
    const comp = crear(viaticoUsd());
    const enSoles = comp.report.expenseIds[2];
    expect(comp.showsConversionToReportCurrency(enSoles)).toBeTrue();
    expect(comp.expenseAmountInReportCurrencyPublic(enSoles)).toBe(15.31);
    expect(comp.getExpenseTcReporte(enSoles)).toBe(3.556);
    // La fila sigue mostrando su moneda original.
    expect(comp.getExpenseMonedaPrefijo(enSoles)).toBe('S/');
  });

  it('una DJ en dólares no se convierte: su importe nativo es exacto', () => {
    const comp = crear(viaticoUsd());
    const dj = comp.report.expenseIds[0];
    expect(comp.showsConversionToReportCurrency(dj)).toBeFalse();
    expect(comp.getExpenseMonedaPrefijo(dj)).toBe('USD');
  });

  it('respalda con el TC del viático los gastos anteriores a montoReporte', () => {
    const report = viaticoUsd();
    // Gasto legacy: solo tiene el congelado a moneda base.
    report.expenseIds = [
      { total: 54.45, moneda: 'PEN', montoBase: 54.45, tipoCambio: 1 },
    ] as any;
    const comp = crear(report);
    // 54.45 / 3.556 = 15.31
    expect(comp.totalGastadoReporte).toBe(15.31);
  });

  it('ignora un congelado obsoleto si la rendición cambió de moneda', () => {
    const report = viaticoUsd();
    report.expenseIds = [
      {
        total: 54.45,
        moneda: 'PEN',
        montoBase: 54.45,
        monedaReporte: 'EUR', // congelado contra otra moneda
        montoReporte: 999,
      },
    ] as any;
    const comp = crear(report);
    expect(comp.totalGastadoReporte).toBe(15.31);
  });

  it('en una rendición en soles todo se comporta como antes', () => {
    const comp = crear({
      type: 'viatico',
      moneda: 'PEN',
      viaticoAmount: 500,
      viaticoPaidAmount: 500,
      expenseIds: [
        { total: 100, moneda: 'PEN', montoBase: 100 },
        { total: 54.45, moneda: 'PEN', montoBase: 54.45 },
      ],
    });
    expect(comp.monedaPrefijo).toBe('S/');
    expect(comp.totalGastadoReporte).toBe(154.45);
    expect(comp.totalGastadoReporte).toBeCloseTo(comp.totalGastado, 2);
    expect(comp.saldoLibre).toBe(345.55);
  });

  it('sin TC congelado no inventa conversión: se comporta como soles', () => {
    const comp = crear({
      type: 'viatico',
      moneda: 'USD',
      // sin tipoCambio
      viaticoAmount: 450,
      viaticoPaidAmount: 450,
      expenseIds: [{ total: 88, moneda: 'USD', montoBase: 88 }],
    });
    expect(comp.isReportForeignCurrency).toBeFalse();
    expect(comp.monedaPrefijo).toBe('S/');
    expect(comp.totalGastadoReporte).toBe(88);
  });

  it('convierte la liquidación del backend, que viene en soles', () => {
    const comp = crear({
      type: 'directa',
      isDirecta: true,
      moneda: 'USD',
      tipoCambio: 3.556,
      expenseIds: [],
      settlement: { difference: 355.6 },
    });
    // 355.60 soles = USD 100.00
    expect(comp.saldoLibre).toBe(100);
  });
});
