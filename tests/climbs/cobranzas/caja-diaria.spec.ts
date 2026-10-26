import { test, expect } from '@playwright/test';
import { CajaDiariaNuevaPage } from '../../../pages/climbs/caja-diaria.page';
import { paso, adjuntarTexto, formatearFecha, reiniciarNumeracionDePasos, importeANumero } from '../../../utils/pasos';
import {
  reservarServicioYGenerarFile, armarFacturaAprobada, armarOrdenDePagoAprobada, armarFacturaAlCliente, armarOrdenDeCobroAprobada,
  cajaDeRegresion, PROVEEDOR_DE_REGRESION,
} from '../comun/precondiciones';

/**
 * COBRANZAS — app nueva (ClimbsApp).
 *
 * El mismo flujo que tests/bloque-c/caja-diaria.spec.ts, con el mismo titulo: la cadena
 * entera de un file (pago al proveedor y cobro al cliente, aprobados con recibo de hoy) y
 * los dos movimientos en la caja diaria, cada uno en la caja AUTO-QA de su moneda y con su
 * cuadre. El test no cierra la caja: cerrarla bloquea los aprobados del resto del dia.
 */
const n = (s: string) => importeANumero(s) ?? 0;
const redondo = (x: number) => Number(x.toFixed(2));

test.describe('Cobranzas', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Caja diaria: recibe el pago y el cobro del mismo file y cuadra', async ({ page }) => {
    test.setTimeout(1_800_000);
    const erroresJS: string[] = [];
    page.on('pageerror', (e) => erroresJS.push(e.message));
    const caja = new CajaDiariaNuevaPage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);

    // --- La cadena entera, las dos ramas del mismo file ---
    const base = await reservarServicioYGenerarFile(page, sello);
    const facturaProveedor = await armarFacturaAprobada(page, sello, ahora, base);
    const ordenDePago = await armarOrdenDePagoAprobada(page, sello, fechaDeHoy, facturaProveedor);
    const carta = await armarFacturaAlCliente(page, sello, base);
    const ordenDeCobro = await armarOrdenDeCobroAprobada(page, sello, fechaDeHoy, carta);

    // Cada rama cae en la caja AUTO-QA de su moneda: el costo va en pesos y la venta en dolares.
    const ramas = [
      { que: 'pago', codigo: ordenDePago, moneda: facturaProveedor.moneda, caja: cajaDeRegresion(facturaProveedor.moneda),
        importe: facturaProveedor.total, contraparte: PROVEEDOR_DE_REGRESION.termino, queImporte: 'el costo del item del file' },
      { que: 'cobro', codigo: ordenDeCobro, moneda: carta.moneda, caja: cajaDeRegresion(carta.moneda),
        importe: carta.total, contraparte: base.cliente.toUpperCase(), queImporte: 'la venta del item del file' },
    ];
    const balances: Record<string, number> = {};

    await paso(page, 'Abrir la caja del dia de la sucursal', async () => {
      const { id, creada } = await caja.abrirCajaDelDia(fechaDeHoy, 'Argentina', `Caja de regresion automatica ${sello}. No operar.`);
      await adjuntarTexto('Caja del dia', `id ${id} — ${creada ? 'abierta por el test' : 'ya existia'} — ${fechaDeHoy}`);
      expect(id, 'Tiene que haber una caja diaria para hoy en la sucursal').toMatch(/^\d+$/);
      await adjuntarTexto('Cajas de cada rama', ramas.map((r) => `${r.que}: ${r.codigo} en ${r.caja} (${r.moneda} ${r.importe})`).join('\n'));
    });

    for (const r of ramas) {
      await paso(page, `Filtrar por ${r.caja} y verificar que el ${r.que} cayo en la caja`, async () => {
        const cajas = await caja.cajasOfrecidas();
        expect(cajas.join(' | '), `La caja diaria tiene que ofrecer ${r.caja} para filtrar`).toContain(r.caja);
        await caja.filtrarPorCaja(r.caja);
        const fila = caja.filaDelMovimiento(r.codigo);
        await expect(fila, `La orden ${r.codigo} tiene que aparecer en ${r.caja}. Si no esta, revisar que este aprobada con recibo de hoy y en la sucursal.`)
          .toBeVisible({ timeout: 60_000 });
        const celdas = await caja.celdas(fila);
        const texto = celdas.join(' | ').toUpperCase();
        await adjuntarTexto(`Movimiento del ${r.que}`, celdas.join(' | '));
        expect(texto, `El ${r.que} tiene que quedar registrado en ${r.caja}`).toContain(r.caja.toUpperCase());
        const importes = celdas.filter((c) => /^-?\d[\d.]*,\d+$/.test(c)).map((c) => Math.abs(n(c)));
        expect(importes, `El movimiento de ${r.que} tiene que ser por ${r.queImporte}`).toContain(r.importe);
        expect(celdas.join(' | '), `El movimiento de ${r.que} tiene que llevar la fecha de la caja`).toContain(fechaDeHoy);
        expect(texto, `El movimiento de ${r.que} tiene que identificar a ${r.contraparte}`).toContain(r.contraparte);
        expect(texto, 'El movimiento tiene que estar en la moneda de su caja').toContain(r.moneda);
      });

      await paso(page, `Verificar el cuadre de ${r.caja}`, async () => {
        const t = await caja.totales(r.moneda);
        await adjuntarTexto(`Totales de ${r.caja}`, JSON.stringify(t, null, 2));
        expect(t, `La caja tiene que mostrar sus totales en ${r.moneda}`).not.toBeNull();
        const [inicial, ingreso, salida, balance, final] = [t!.inicial, t!.ingreso, t!.salida, t!.balance, t!.final].map(n);
        balances[r.caja] = balance;
        // La salida puede venir con o sin signo: el balance es lo que entra menos lo que sale.
        expect(redondo(ingreso - Math.abs(salida)), 'El balance tiene que ser el ingreso menos la salida').toBe(redondo(balance));
        expect(redondo(inicial + balance), 'El saldo final tiene que ser el saldo inicial mas el balance').toBe(redondo(final));
        if (r.que === 'cobro') expect(ingreso, 'El ingreso de la caja tiene que incluir la venta cobrada').toBeGreaterThanOrEqual(r.importe);
        else expect(Math.abs(salida), 'La salida de la caja tiene que incluir el costo pagado').toBeGreaterThanOrEqual(r.importe);
      });
    }

    await paso(page, 'Abrir el pre-cierre y verificar que muestre el cuadre de las dos cajas', async () => {
      const dialogo = await caja.abrirPreCierre();
      for (const r of ramas) {
        const fila = await caja.filaDelPreCierre(dialogo, r.caja);
        await adjuntarTexto(`Fila de ${r.caja} en el pre-cierre`, fila.join(' | '));
        expect(fila.length, `El pre-cierre tiene que listar ${r.caja} con su cuadre`).toBeGreaterThan(0);
        expect(fila.map((c) => importeANumero(c)), `El balance del dia de ${r.caja} en el pre-cierre tiene que coincidir con el de la pantalla`)
          .toContain(balances[r.caja]);
      }
      await caja.cerrarPreCierre(dialogo);
      await adjuntarTexto('Cadena completa generada', [
        `File: ${base.fileCode}`, `Factura de proveedor: ${facturaProveedor.puntoDeVenta}-${facturaProveedor.numeroDeFactura}`,
        `Orden de pago: ${ordenDePago} (costo ${facturaProveedor.moneda} ${facturaProveedor.total})`,
        `Carta al cliente: ${carta.comprobante}`, `Orden de cobro: ${ordenDeCobro} (venta ${carta.moneda} ${carta.total})`,
      ].join('\n'));
    });

    await paso(page, 'Verificar la caja en el listado y que quede abierta', async () => {
      await caja.irAlListado();
      const fila = caja.filaDeLaFecha(fechaDeHoy).first();
      await expect(fila, `La caja del ${fechaDeHoy} tiene que aparecer en el listado`).toBeVisible({ timeout: 60_000 });
      const texto = (await fila.innerText()).replace(/\s+/g, ' ').toUpperCase();
      await adjuntarTexto('Fila de la caja en el listado', texto);
      expect(texto, 'La caja tiene que quedar abierta: el test no la cierra').toContain('ABIERTO');
      expect(texto).not.toContain('CERRADO');
    });

    expect(erroresJS, 'La app nueva no tiene que tirar errores de JavaScript durante el flujo').toEqual([]);
  });
});
