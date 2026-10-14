import { test, expect, Page, Locator } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, formatearFecha, reiniciarNumeracionDePasos, conResaltado,
} from '../../utils/pasos';
import { reservarServicioYGenerarFile } from './cobranzas-comun';
import {
  armarFacturaAprobada, armarFacturaAlCliente, armarOrdenDePagoAprobada, armarOrdenDeCobroAprobada,
} from './cobranzas-armado';

/**
 * BLOQUE C — Cierre del file.
 *
 * Los otros eslabones miran cada comprobante en su pantalla. Este mira el file
 * despues de toda la cadena: es el unico lugar donde la factura del proveedor, la
 * orden de pago, la carta de cobranza y la orden de cobro se cruzan con el costo y la
 * venta del file (panel "Comprobantes y saldos", `ManageFile.aspx`). Es tambien lo que
 * mas toco el calculo de utilidades (4896) y el rediseno del BO (4648).
 *
 * Con la cadena completa sobre un file nuevo, el panel tiene que mostrar un
 * comprobante de cada tipo y los dos lados "Al dia": nada por cobrar ni por pagar.
 *
 * Solo lee lo que la cadena dejo: no escribe nada propio.
 */
test.describe('Cobranzas — cierre del file', () => {
  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  const baseBO = () => process.env.AMV_BO_URL || 'https://qa.bo.amv.travel';

  /** Un lado del panel (Cliente o Proveedores), por el titulo que lo nombra. */
  const lado = (page: Page, id: 'boCompCliente' | 'boCompProveedores') =>
    page.locator(`section.bo-comp__lado[aria-labelledby="${id}"]`);

  /** Las cifras de un lado: "Venta del file", "Facturado", "Cobrado"/"Pagado", "Falta ...". */
  async function cifras(seccion: Locator): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const cifra of await seccion.locator('.bo-comp__cifra').all()) {
      const dt = (await cifra.locator('dt').innerText()).trim();
      out[dt] = (await cifra.locator('dd').innerText()).replace(/\s+/g, ' ').trim();
    }
    return out;
  }

  test('Cierre del file: con la cadena completa, el file muestra cada comprobante y queda al dia', async ({ page }) => {
    test.setTimeout(1_800_000);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);

    // --- La cadena entera sobre un file nuevo ---
    const base = await reservarServicioYGenerarFile(page, sello);
    const facturaProveedor = await armarFacturaAprobada(page, sello, ahora, base);
    const ordenDePago = await armarOrdenDePagoAprobada(page, sello, fechaDeHoy, facturaProveedor);
    const facturaCliente = await armarFacturaAlCliente(page, sello, base);
    const ordenDeCobro = await armarOrdenDeCobroAprobada(page, sello, fechaDeHoy, facturaCliente);

    await paso(page, `Abrir el file ${base.fileCode} y leer el panel de comprobantes`, async () => {
      await page.goto(`${baseBO()}/booking/files/managefile/${base.fileId}`);
      await esperarFinDeCarga(page);
      const panel = page.locator('section.bo-ficha__grupo').filter({ hasText: 'Comprobantes y saldos' });
      await expect(panel, 'El file tiene que mostrar el panel "Comprobantes y saldos"').toBeVisible({ timeout: 60_000 });
      await adjuntarTexto('Cadena armada', [
        `File: ${base.fileCode} (id ${base.fileId})`,
        `Costo del item: ${base.costoDelItem.moneda} ${base.costoDelItem.valor}`,
        `Venta del item: ${base.ventaDelItem.moneda} ${base.ventaDelItem.valor}`,
        `Factura de proveedor: ${facturaProveedor.numeroDeFactura} por ${facturaProveedor.moneda} ${facturaProveedor.total}`,
        `Orden de pago: ${ordenDePago}`,
        `Carta de cobranza: ${facturaCliente.comprobante} por ${facturaCliente.total}`,
        `Orden de cobro: ${ordenDeCobro}`,
      ].join('\n'));
      await adjuntarTexto('Panel Comprobantes y saldos', (await panel.innerText()).replace(/[ \t]+/g, ' '));
      await adjuntarTexto('Cifras del cliente', JSON.stringify(await cifras(lado(page, 'boCompCliente')), null, 1));
      await adjuntarTexto('Cifras del proveedor', JSON.stringify(await cifras(lado(page, 'boCompProveedores')), null, 1));
    });

    await paso(page, 'Cada comprobante de la cadena figura en su lista, con su estado', async () => {
      // El titulo de cada lista es el de `ManageFile.aspx` (en pantalla sale en mayusculas por CSS).
      const esperadas: { id: 'boCompCliente' | 'boCompProveedores'; titulo: RegExp; codigo: string; estado: RegExp }[] = [
        { id: 'boCompCliente', titulo: /^Facturas$/, codigo: facturaCliente.comprobante, estado: /Cobrada/ },
        { id: 'boCompCliente', titulo: /rdenes de cobro$/, codigo: ordenDeCobro, estado: /Pagado/ },
        { id: 'boCompProveedores', titulo: /^Facturas de proveedor$/, codigo: facturaProveedor.numeroDeFactura, estado: /Pagada/ },
        { id: 'boCompProveedores', titulo: /rdenes de pago$/, codigo: ordenDePago, estado: /Pagado/ },
      ];
      for (const e of esperadas) {
        const deQuien = e.id === 'boCompCliente' ? 'Cliente' : 'Proveedores';
        const filas = lado(page, e.id).locator('.bo-comp__lista')
          .filter({ has: page.locator('.bo-comp__lista-titulo', { hasText: e.titulo }) })
          .first().locator('.bo-comp__fila');
        await conResaltado(page, filas.first(), `${deQuien}: ${e.codigo}`, async () => {
          await expect(filas, `La lista "${e.titulo.source}" de ${deQuien} tiene que tener solo el comprobante de la cadena`)
            .toHaveCount(1);
          await expect(filas.first(), `La fila tiene que ser la de ${e.codigo}`).toContainText(e.codigo);
          await expect(filas.first().locator('.bo-comp__estado'), `Con la cadena completa, ${e.codigo} tiene que quedar saldado`)
            .toHaveText(e.estado);
        });
      }
    });

    await paso(page, 'Cliente y proveedor quedan al dia: lo facturado es lo cobrado y lo pagado', async () => {
      // Formato del BO: punto de miles y coma decimal ("63,067", "94.600,00").
      const numero = (t: string) => Number(t.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
      const cliente = await cifras(lado(page, 'boCompCliente'));
      const proveedor = await cifras(lado(page, 'boCompProveedores'));

      await conResaltado(page, lado(page, 'boCompCliente'), 'Saldo del cliente', async () => {
        expect(numero(cliente['Venta del file']), 'La venta del file es la del item reservado')
          .toBe(base.ventaDelItem.valor);
        expect(numero(cliente['Facturado']), 'La carta de cobranza factura toda la venta').toBe(numero(cliente['Venta del file']));
        expect(numero(cliente['Cobrado']), 'La orden de cobro cobra todo lo facturado').toBe(numero(cliente['Facturado']));
        expect(cliente['Falta cobrar'], 'No queda nada por cobrar').toMatch(/^0\b.*Al d[ií]a/);
      });

      await conResaltado(page, lado(page, 'boCompProveedores'), 'Saldo del proveedor', async () => {
        // El costo del item esta en ARS y el file en USD: el panel lo pasa con el tipo de
        // cambio del proveedor, asi que se compara contra si mismo y no contra los 94.600.
        expect(numero(proveedor['Facturado']), 'La factura del proveedor cubre todo el costo del file')
          .toBe(numero(proveedor['Costo del file']));
        expect(numero(proveedor['Pagado']), 'La orden de pago paga todo lo facturado').toBe(numero(proveedor['Facturado']));
        expect(proveedor['Falta pagar'], 'No queda nada por pagar').toMatch(/^0\b.*Al d[ií]a/);
      });

      await expect(page.locator('.bo-comp__cifra--debe'), 'Ninguna cifra tiene que quedar marcada como deuda').toHaveCount(0);
    });
  });
});
