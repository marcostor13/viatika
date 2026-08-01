import { MisRendicionesComponent } from './mis-rendiciones.component';
import { RendicionDetailComponent } from './rendicion-detail/rendicion-detail.component';

/**
 * Totales por moneda en el listado y en la liquidación que va al PDF/Excel.
 * Igual que en el detalle, se prueban los métodos sobre el prototipo: son
 * cálculos puros sobre el objeto `report`.
 */
describe('MisRendicionesComponent — total por moneda', () => {
  const comp = Object.create(MisRendicionesComponent.prototype) as any;

  const viaticoUsd = {
    moneda: 'USD',
    tipoCambio: 3.556,
    budget: 450,
    expenseIds: [
      { total: 88, moneda: 'USD', montoBase: 309.94, monedaReporte: 'USD', montoReporte: 88 },
      { total: 219, moneda: 'USD', montoBase: 775.26, monedaReporte: 'USD', montoReporte: 219 },
      { total: 54.45, moneda: 'PEN', montoBase: 54.45, monedaReporte: 'USD', montoReporte: 15.31 },
    ],
  };

  it('suma en la moneda de la rendición (antes sumaba 361.45 mezclando monedas)', () => {
    expect(comp.getTotalGastado(viaticoUsd)).toBe(322.31);
    expect(comp.monedaPrefijoDe(viaticoUsd)).toBe('USD');
  });

  it('el saldo de la lista queda en la misma moneda', () => {
    expect(comp.getSaldoLibre(viaticoUsd)).toBeCloseTo(127.69, 2);
  });

  it('una rendición en soles se comporta igual que antes', () => {
    const enSoles = {
      moneda: 'PEN',
      budget: 300,
      expenseIds: [
        { total: 100, montoBase: 100 },
        { total: 54.45, montoBase: 54.45 },
      ],
    };
    expect(comp.getTotalGastado(enSoles)).toBe(154.45);
    expect(comp.monedaPrefijoDe(enSoles)).toBe('S/');
  });

  it('sin gastos devuelve 0', () => {
    expect(comp.getTotalGastado({ moneda: 'USD', tipoCambio: 3.556, expenseIds: [] })).toBe(0);
  });
});

describe('RendicionDetailComponent — liquidación exportada', () => {
  const crear = (report: unknown) => {
    const comp = Object.create(RendicionDetailComponent.prototype) as any;
    comp.report = report;
    comp.advances = [];
    return comp;
  };

  it('expresa la liquidación (que el backend calcula en soles) en la moneda del documento', () => {
    const comp = crear({
      type: 'viatico',
      moneda: 'USD',
      tipoCambio: 3.556,
      expenseIds: [],
      settlement: {
        type: 'devolucion',
        advanceTotal: 1600.2, // S/
        expenseTotal: 1139.65, // S/
        difference: 460.55, // S/
      },
    });

    const exportado = comp.getSettlementForExport();
    expect(exportado.advanceTotal).toBeCloseTo(450, 2);
    expect(exportado.expenseTotal).toBeCloseTo(320.49, 2);
    expect(exportado.difference).toBeCloseTo(129.51, 2);
    expect(exportado.typeLabel).toBe('A devolver (USD)');
  });

  it('en soles no convierte ni cambia la etiqueta', () => {
    const comp = crear({
      type: 'directa',
      moneda: 'PEN',
      expenseIds: [],
      settlement: { type: 'reembolso', advanceTotal: 100, expenseTotal: 150, difference: -50 },
    });

    const exportado = comp.getSettlementForExport();
    expect(exportado.advanceTotal).toBe(100);
    expect(exportado.difference).toBe(50); // reembolso se muestra en positivo
    expect(exportado.typeLabel).toBe('A reembolsar (S/)');
  });
});
