import { test, expect } from '@playwright/test';
import { BackofficeNuevoPage } from '../../../pages/climbs/backoffice.page';
import { paso, adjuntarTexto, formatearFecha, reiniciarNumeracionDePasos, importeANumero } from '../../../utils/pasos';
import {
  reservarServicioYGenerarFile, armarFacturaAprobada, armarOrdenDePagoAprobada, armarFacturaAlCliente, armarOrdenDeCobroAprobada,
} from '../comun/precondiciones';
import { codigoFlexible } from '../../../pages/climbs/cuenta-corriente.page';

/**
 * COBRANZAS — app nueva (ClimbsApp). Cierre del file.
 *
 * El mismo test que tests/bloque-c/cierre-del-file.spec.ts, con el mismo titulo: con la
 * cadena completa sobre un file nuevo, el panel "Comprobantes y saldos" de la ficha (solapa
 * Finanzas) tiene que mostrar un comprobante de cada tipo, saldado, y los dos lados al dia.
 * Solo lee lo que la cadena dejo.
 */
const n = (s: string) => importeANumero(s) ?? 0;

test.describe('Cobranzas — cierre del file', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Cierre del file: con la cadena completa, el file muestra cada comprobante y queda al dia', async ({ page }) => {
    test.setTimeout(1_800_000);
    const erroresJS: string[] = [];
    page.on('pageerror', (e) => erroresJS.push(e.message));
    const bo = new BackofficeNuevoPage(page);
    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);

    const base = await reservarServicioYGenerarFile(page, sello);
    const facturaProveedor = await armarFacturaAprobada(page, sello, ahora, base);
    const ordenDePago = await armarOrdenDePagoAprobada(page, sello, fechaDeHoy, facturaProveedor);
    const carta = await armarFacturaAlCliente(page, sello, base);
    const ordenDeCobro = await armarOrdenDeCobroAprobada(page, sello, fechaDeHoy, carta);

    await paso(page, `Abrir el file ${base.fileCode} y leer el panel de comprobantes`, async () => {
      await bo.abrirFicha(base.fileId);
      await bo.verFinanzas();
      await adjuntarTexto('Cadena armada', [
        `File: ${base.fileCode} (id ${base.fileId})`,
        `Costo del item: ${base.costoDelItem.moneda} ${base.costoDelItem.valor}`, `Venta del item: ${base.ventaDelItem.moneda} ${base.ventaDelItem.valor}`,
        `Factura de proveedor: ${facturaProveedor.numeroDeFactura} por ${facturaProveedor.moneda} ${facturaProveedor.total}`, `Orden de pago: ${ordenDePago}`,
        `Carta de cobranza: ${carta.comprobante} por ${carta.total}`, `Orden de cobro: ${ordenDeCobro}`,
      ].join('\n'));
      await adjuntarTexto('Cifras del cliente', JSON.stringify(await bo.cifras(bo.ladoCliente()), null, 1));
      await adjuntarTexto('Cifras del proveedor', JSON.stringify(await bo.cifras(bo.ladoProveedores()), null, 1));
    });

    await paso(page, 'Cada comprobante de la cadena figura en su lista, con su estado', async () => {
      const esperadas = [
        { lado: bo.ladoCliente(), deQuien: 'Cliente', titulo: /^Facturas$/, codigo: carta.comprobante, estado: /Cobrad/i },
        { lado: bo.ladoCliente(), deQuien: 'Cliente', titulo: /rdenes de cobro$/, codigo: ordenDeCobro, estado: /Pag/i },
        { lado: bo.ladoProveedores(), deQuien: 'Proveedores', titulo: /^Facturas de proveedor$/, codigo: facturaProveedor.numeroDeFactura, estado: /Pagad/i },
        { lado: bo.ladoProveedores(), deQuien: 'Proveedores', titulo: /rdenes de pago$/, codigo: ordenDePago, estado: /Pag/i },
      ];
      for (const e of esperadas) {
        const filas = bo.lista(e.lado, e.titulo).locator('li');
        await adjuntarTexto(`${e.deQuien}: lista ${e.titulo.source}`, (await filas.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join('\n') || '(vacia)');
        await expect(filas, `La lista "${e.titulo.source}" de ${e.deQuien} tiene que tener solo el comprobante de la cadena`).toHaveCount(1);
        await expect(filas.first(), `La fila tiene que ser la de ${e.codigo}`).toContainText(codigoFlexible(e.codigo));
        await expect(filas.first().locator('.fa-status'), `Con la cadena completa, ${e.codigo} tiene que quedar saldado`).toHaveText(e.estado);
      }
    });

    await paso(page, 'Cliente y proveedor quedan al dia: lo facturado es lo cobrado y lo pagado', async () => {
      const cliente = await bo.cifras(bo.ladoCliente());
      const proveedor = await bo.cifras(bo.ladoProveedores());
      expect(n(cliente['Venta del file']), 'La venta del file es la del item reservado').toBe(base.ventaDelItem.valor);
      expect(n(cliente['Facturado']), 'La carta de cobranza factura toda la venta').toBe(n(cliente['Venta del file']));
      expect(n(cliente['Cobrado']), 'La orden de cobro cobra todo lo facturado').toBe(n(cliente['Facturado']));
      expect(await bo.textoDeCifra(bo.ladoCliente(), 'Falta cobrar'), 'No queda nada por cobrar').toMatch(/^0(,0+)?\b.*Al d[ií]a/);
      // El costo del item esta en ARS y el file en USD: el panel lo pasa con el tipo de cambio
      // del proveedor, asi que se compara contra si mismo y no contra los 94.600.
      expect(n(proveedor['Facturado']), 'La factura del proveedor cubre todo el costo del file').toBe(n(proveedor['Costo del file']));
      expect(n(proveedor['Pagado']), 'La orden de pago paga todo lo facturado').toBe(n(proveedor['Facturado']));
      expect(await bo.textoDeCifra(bo.ladoProveedores(), 'Falta pagar'), 'No queda nada por pagar').toMatch(/^0(,0+)?\b.*Al d[ií]a/);
      await expect(bo.fichaDelFile.locator('.fa-figure--owed'), 'Ninguna cifra tiene que quedar marcada como deuda').toHaveCount(0);
    });

    expect(erroresJS, 'La app nueva no tiene que tirar errores de JavaScript durante el flujo').toEqual([]);
  });
});
