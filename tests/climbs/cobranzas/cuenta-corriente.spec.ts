import { test, expect } from '@playwright/test';
import { CuentaCorrienteNuevaPage, CuentaAbierta, FilaDeLaAgenda, celda, codigoFlexible, elegirFiltro } from '../../../pages/climbs/cuenta-corriente.page';
import { paso, adjuntarTexto, formatearFecha, numeroDelFile, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import {
  reservarServicioYGenerarFile, armarFacturaAprobada, armarOrdenDePagoAprobada, armarFacturaAlCliente, armarOrdenDeCobroAprobada,
  PROVEEDOR_DE_REGRESION,
} from '../comun/precondiciones';

/**
 * COBRANZAS — app nueva (ClimbsApp). Cuenta corriente del cliente y del proveedor.
 *
 * El mismo test que tests/bloque-c/cuenta-corriente.spec.ts, con el mismo titulo. Con la
 * cadena completa sobre un file nuevo:
 *  - Agenda de pendientes del cliente: antes de la carta el file figura para facturar; con
 *    la carta emitida y sin cobro, para cobrar; con el cobro aprobado deja de figurar.
 *  - Cuenta del cliente: la carta con su importe y saldada, y la orden de cobro aplicada.
 *  - Cuenta del proveedor: la factura con su importe, saldada e imputada, y la orden de pago.
 *  - En las dos cuentas, los totales suman las filas de la grilla.
 * Las cuentas tienen cientos de movimientos de otras corridas: cada fila se ubica por el
 * comprobante de la cadena y se compara contra los importes de la cadena.
 */
type Cifras = { venta: number; facturado: number; cobrado: number; faltaFacturar: number; faltaCobrar: number };
const GESTIONES = [
  { clave: 'facturar' as const, nombre: 'Facturar ítems' },
  { clave: 'cobrar' as const, nombre: 'Cobrar facturas' },
];

test.describe('Cobranzas — cuenta corriente del cliente y del proveedor', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Cuenta corriente: con la cadena completa, el cliente y el proveedor listan sus comprobantes con importes y saldos coherentes', async ({ page }) => {
    test.setTimeout(2_400_000);
    const cuentas = new CuentaCorrienteNuevaPage(page);
    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);

    const base = await reservarServicioYGenerarFile(page, sello);
    const venta = base.ventaDelItem.valor as number;
    const facturaProveedor = await armarFacturaAprobada(page, sello, ahora, base);
    const ordenDePago = await armarOrdenDePagoAprobada(page, sello, fechaDeHoy, facturaProveedor);

    /** Compara las dos gestiones del file en la agenda contra lo esperado (null = no tiene que figurar). */
    const verificarAgenda = async (momento: string, esperado: { facturar: Cifras | null; cobrar: Cifras | null }) => {
      const filas: FilaDeLaAgenda[] = await cuentas.agendaDelFile(numeroDelFile(base.fileCode), base.fileCode, base.fecha);
      await adjuntarTexto(`Agenda ${momento}: filas del file ${base.fileCode}`, filas.map((f) => f.texto).join('\n') || '(ninguna)');
      for (const g of GESTIONES) {
        const delTipo = filas.filter((f) => f.gestion === g.nombre);
        const cifras = esperado[g.clave];
        if (!cifras) {
          expect(delTipo.length, `${momento}, el file ${base.fileCode} no tiene que figurar en la agenda como "${g.nombre}"`).toBe(0);
          continue;
        }
        expect(delTipo.length, `${momento}, el file ${base.fileCode} tiene que figurar una vez en la agenda como "${g.nombre}"`).toBe(1);
        if (delTipo.length !== 1) continue;
        const f = delTipo[0];
        expect(f.venta, `${momento}, la Venta total de "${g.nombre}" es la venta del file`).toBeCloseTo(cifras.venta, 1);
        expect(f.facturado, `${momento}, el Total facturado de "${g.nombre}"`).toBeCloseTo(cifras.facturado, 1);
        expect(f.cobrado, `${momento}, el Total cobrado de "${g.nombre}"`).toBeCloseTo(cifras.cobrado, 1);
        expect(f.faltaFacturar, `${momento}, lo que Falta facturar en "${g.nombre}"`).toBeCloseTo(cifras.faltaFacturar, 1);
        expect(f.faltaCobrar, `${momento}, lo que Falta cobrar en "${g.nombre}"`).toBeCloseTo(cifras.faltaCobrar, 1);
      }
    };

    await paso(page, 'Agenda de pendientes: antes de emitir la carta, el file figura para facturar', async () => {
      await verificarAgenda('antes de la carta', { facturar: { venta, facturado: 0, cobrado: 0, faltaFacturar: venta, faltaCobrar: venta }, cobrar: null });
    });

    const carta = await armarFacturaAlCliente(page, sello, base);

    await paso(page, 'Agenda de pendientes: con la carta emitida y sin cobro, el file figura para cobrar', async () => {
      const sinFacturar = Math.max(0, venta - carta.total);
      await verificarAgenda('con la carta emitida', {
        facturar: sinFacturar > 0.01 ? { venta, facturado: carta.total, cobrado: 0, faltaFacturar: sinFacturar, faltaCobrar: venta } : null,
        cobrar: { venta, facturado: carta.total, cobrado: 0, faltaFacturar: sinFacturar, faltaCobrar: venta },
      });
    });

    const ordenDeCobro = await armarOrdenDeCobroAprobada(page, sello, fechaDeHoy, carta);

    await paso(page, 'Agenda de pendientes: con el cobro aprobado, el file deja de figurar', async () => {
      await verificarAgenda('con el cobro aprobado', { facturar: null, cobrar: null });
    });

    // --- Cuenta corriente del cliente ---
    let cliente!: CuentaAbierta;
    await paso(page, `Abrir la cuenta corriente del cliente ${base.cliente} con todos los movimientos`, async () => {
      cliente = new CuentaAbierta(await cuentas.abrirCuentaDelCliente(base.cliente));
      await elegirFiltro(cliente.page, 'acc-currency', 'USD');
      await elegirFiltro(cliente.page, 'acc-view', /todos/i);
      await cliente.esperarCarga();
      const hay = await cliente.filas().count();
      await adjuntarTexto('Cuenta del cliente', `${await cliente.page.locator('h1').innerText()} · movimientos en pantalla: ${hay}`);
      expect(hay, 'La cuenta del cliente tiene que listar movimientos').toBeGreaterThan(0);
    });

    await paso(page, `La carta ${carta.comprobante} figura en la cuenta del cliente, con su importe y saldada`, async () => {
      const fila = cliente.filaPorComprobante(carta.comprobante);
      await expect(fila, `La cuenta del cliente tiene que listar la carta ${carta.comprobante} una sola vez`).toHaveCount(1);
      await adjuntarTexto('Fila de la carta en la cuenta del cliente', (await fila.innerText()).replace(/\s+/g, ' '));
      expect(cliente.numero(await celda(fila, 'Debe').innerText()), 'El Debe de la carta es su total').toBeCloseTo(carta.total, 1);
      expect(cliente.numero(await celda(fila, 'Haber').innerText()), 'Una carta de cobranza no tiene Haber').toBeCloseTo(0, 1);
      expect(cliente.numero(await celda(fila, 'Saldo').innerText()), 'Con la orden de cobro aplicada por el total, el saldo de la carta es cero').toBeCloseTo(0, 1);
      await expect(fila, 'La carta cobrada por completo tiene que verse como saldada').toHaveClass(/acc-paid/);
      await expect(celda(fila, 'File').getByRole('link'), 'La carta tiene que enlazar a su file').toHaveAttribute('href', new RegExp(`/files/files/${base.fileId}$`));
      const file = (await celda(fila, 'File').innerText()).trim();
      if (file !== numeroDelFile(base.fileCode)) {
        test.info().annotations.push({ type: 'observacion', description: `La columna File de la cuenta del cliente muestra "${file}" en vez del numero del file ${numeroDelFile(base.fileCode)}` });
      }
    });

    await paso(page, `La orden de cobro ${ordenDeCobro} figura en la cuenta del cliente, aplicada a la carta`, async () => {
      const fila = cliente.filaPorComprobante(ordenDeCobro);
      await expect(fila, `La cuenta del cliente tiene que listar la orden de cobro ${ordenDeCobro} una sola vez, aplicada a la carta y no ademas suelta`).toHaveCount(1);
      await adjuntarTexto('Fila de la orden de cobro en la cuenta del cliente', (await fila.innerText()).replace(/\s+/g, ' '));
      expect(cliente.numero(await celda(fila, 'Haber').innerText()), 'El Haber de la orden de cobro es lo que se cobro').toBeCloseTo(carta.total, 1);
      expect((await celda(fila, 'Debe').innerText()).trim(), 'Una orden de cobro no tiene Debe').toBe('');
      expect((await celda(fila, 'Saldo').innerText()).trim(), 'Una orden aplicada a una carta no muestra saldo propio').toBe('');
      expect((await celda(fila, 'Estado').innerText()).trim(), 'La orden de cobro aprobada tiene que figurar como Pago').toBe('Pago');
      await expect(fila, 'La orden de cobro aplicada tiene que verse como hija de la carta').toHaveClass(/acc-child/);
      await expect(cliente.filaPorComprobante(carta.comprobante).locator('xpath=following-sibling::tr[1]'),
        'La orden de cobro tiene que quedar justo debajo de la carta').toContainText(codigoFlexible(ordenDeCobro));
    });

    await paso(page, 'Los totales de la cuenta del cliente suman los movimientos de la grilla', async () => {
      const debe = await cliente.sumar('Debe');
      // Los totales no cuentan las ordenes de cobro en estado Pendiente.
      const haber = await cliente.sumar('Haber', async (f) => !/^pendiente$/i.test((await celda(f, 'Estado').innerText()).trim()));
      const t = await cliente.totales();
      await adjuntarTexto('Totales de la cuenta del cliente', `Filas: ${debe.filas} · Debe sumado: ${debe.suma} · Haber sumado: ${haber.suma} · Pantalla: ${JSON.stringify(t)}`);
      const tolerancia = 0.001 * debe.filas + 0.05;
      expect(Math.abs(t['Debe'] - debe.suma), 'El Debe total es la suma del Debe de los movimientos').toBeLessThanOrEqual(tolerancia);
      expect(Math.abs(t['Haber'] - haber.suma), 'El Haber total es la suma del Haber de los movimientos').toBeLessThanOrEqual(tolerancia);
      expect(Math.abs(t['Saldo'] - (debe.suma - haber.suma)), 'El Saldo total es el Debe menos el Haber').toBeLessThanOrEqual(tolerancia);
      await cliente.page.close();
    });

    // --- Cuenta corriente del proveedor ---
    let proveedor!: CuentaAbierta;
    await paso(page, 'Abrir la cuenta corriente del proveedor en la vista Completa', async () => {
      proveedor = new CuentaAbierta(await cuentas.abrirCuentaDelProveedor(PROVEEDOR_DE_REGRESION.razonSocial));
      await elegirFiltro(proveedor.page, 'sacc-currency', facturaProveedor.moneda);
      // La vista Parcial solo trae lo pendiente de pago: la factura ya esta pagada.
      await elegirFiltro(proveedor.page, 'sacc-view', 'Completa');
      await proveedor.esperarCarga();
      const hay = await proveedor.filas().count();
      await adjuntarTexto('Cuenta del proveedor', `${await proveedor.page.locator('h1').innerText()} · movimientos en pantalla: ${hay}`);
      expect(hay, 'La cuenta del proveedor tiene que listar movimientos en los ultimos 30 dias').toBeGreaterThan(0);
    });

    await paso(page, `La factura ${facturaProveedor.numeroDeFactura} figura en la cuenta del proveedor, con su importe, saldada e imputada al file`, async () => {
      const fila = proveedor.filas().filter({ has: proveedor.page.locator('td[data-label="Comprobante"]', { hasText: facturaProveedor.numeroDeFactura }) });
      await expect(fila, `La cuenta del proveedor tiene que listar la factura ${facturaProveedor.numeroDeFactura} una sola vez`).toHaveCount(1);
      await adjuntarTexto('Fila de la factura en la cuenta del proveedor', (await fila.innerText()).replace(/\s+/g, ' '));
      const v = async (c: string) => proveedor.numero(await celda(fila, c).innerText());
      expect(await v('Total factura'), 'El Total factura es el total cargado en la cadena').toBeCloseTo(facturaProveedor.total, 1);
      expect(await v('Pagable'), 'Lo Pagable es el total menos las retenciones').toBeCloseTo((await v('Total factura')) - (await v('Retenciones')), 1);
      expect(await v('Debe'), 'El Debe de la factura es lo Pagable').toBeCloseTo(await v('Pagable'), 1);
      expect(await v('Saldo'), 'Con la orden de pago aplicada por el total, el saldo de la factura es cero').toBeCloseTo(0, 1);
      expect(await v('Pendiente'), 'Imputada por el total al file, no queda nada Pendiente').toBeCloseTo(0, 1);
      await expect(fila, 'La factura pagada por completo tiene que verse como saldada').toHaveClass(/acc-paid/);
    });

    await paso(page, `La orden de pago ${ordenDePago} figura en la cuenta del proveedor, aplicada a la factura`, async () => {
      const fila = proveedor.filaPorComprobante(ordenDePago);
      await expect(fila, `La cuenta del proveedor tiene que listar la orden de pago ${ordenDePago} una sola vez`).toHaveCount(1);
      await adjuntarTexto('Fila de la orden de pago en la cuenta del proveedor', (await fila.innerText()).replace(/\s+/g, ' '));
      expect(proveedor.numero(await celda(fila, 'Haber').innerText()), 'El Haber de la orden de pago es lo que se pago').toBeCloseTo(facturaProveedor.total, 1);
      expect(proveedor.numero(await celda(fila, 'Debe').innerText()), 'Una orden de pago no tiene Debe').toBeCloseTo(0, 1);
      // armarOrdenDePagoAprobada aprueba con el recibo AUTOQA + los ultimos 8 del sello.
      expect((await celda(fila, 'Recibo').innerText()).trim(), 'La cuenta tiene que mostrar el recibo con el que se aprobo la orden').toContain(`AUTOQA${sello.slice(-8)}`);
      const factura = proveedor.filas().filter({ has: proveedor.page.locator('td[data-label="Comprobante"]', { hasText: facturaProveedor.numeroDeFactura }) });
      await expect(factura.locator('xpath=following-sibling::tr[1]'), 'La orden de pago tiene que quedar justo debajo de la factura').toContainText(codigoFlexible(ordenDePago));
    });

    await paso(page, 'Los totales de la cuenta del proveedor suman los movimientos de la grilla', async () => {
      const debe = await proveedor.sumar('Debe');
      const haber = await proveedor.sumar('Haber');
      const t = await proveedor.totales();
      await adjuntarTexto('Totales de la cuenta del proveedor', `Filas: ${debe.filas} · Debe sumado: ${debe.suma} · Haber sumado: ${haber.suma} · Pantalla: ${JSON.stringify(t)}`);
      const tolerancia = 0.001 * debe.filas + 0.05;
      expect(Math.abs(t['Debe'] - debe.suma), 'El Debe total es la suma del Debe de los movimientos').toBeLessThanOrEqual(tolerancia);
      expect(Math.abs(t['Haber'] - haber.suma), 'El Haber total es la suma del Haber de los movimientos').toBeLessThanOrEqual(tolerancia);
      expect(Math.abs(t['Saldo'] - (debe.suma - haber.suma)), 'El Saldo total es el Debe menos el Haber').toBeLessThanOrEqual(tolerancia);
      await proveedor.page.close();
    });
  });
});
