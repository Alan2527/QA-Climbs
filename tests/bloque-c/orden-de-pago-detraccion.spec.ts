import { test, expect, Page, Locator } from '@playwright/test';
import { BackOfficePage } from '../../pages/backoffice.page';
import { FacturaProveedorPage } from '../../pages/factura-proveedor.page';
import { OrdenDePagoPage } from '../../pages/orden-de-pago.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado, esperarFinDeCarga, formatearFecha, importeANumero } from '../../utils/pasos';

/**
 * BLOQUE C — Orden de pago de detracción (Perú, Azure 4811).
 *
 * En Perú la factura del proveedor puede llevar detracción: el importe detraído no se le paga al
 * proveedor sino que se deposita aparte, con una orden de pago de tipo "Detracción". Esa orden
 * lista entre sus pendientes solo las facturas del proveedor con detracción, por su saldo fiscal
 * (la detracción, no el pagable), y al asignarla y aprobarla la factura queda saldada en lo fiscal.
 *
 * El mismo flujo en la app nueva: tests/climbs/cobranzas/orden-de-pago-detraccion.spec.ts
 * (ClimbsApp #225, release 24/11/2026).
 *
 * Datos propios, creados por pantalla el 24/11/2026:
 *   - proveedor 3344 "AUTO-QA NO TOCAR - PROVEEDOR DETRACCION PERU" (Perú, RUC 20999999996, PEN);
 *   - caja 213 "AUTO-QA NO TOCAR - CAJA PEN PERU" (Perú, PEN, categoria EFECTIVO EN OFICINA LIM).
 * Cada corrida carga una factura (no gravado PEN 1.000, detracción 10% = 100, pagable 900) y una
 * orden de detracción por 100 que se asigna y se aprueba. La aprobación no mueve la caja.
 */
const SUCURSAL = 'Perú';
const PROVEEDOR = { termino: 'AUTO-QA NO TOCAR - PROVEEDOR DETRACCION', razonSocial: 'AUTO-QA NO TOCAR - PROVEEDOR DETRACCION PERU' };
const CAJA = 'AUTO-QA NO TOCAR - CAJA PEN PERU';
const MONEDA = 'PEN';
const NO_GRAVADO = 1000;
const TASA = '10%';
const DETRACCION = 100;
const PAGABLE = NO_GRAVADO - DETRACCION;

/** Los campos con mascara del BO recalculan al salir: se tipea como una persona y se sale con Tab. */
async function tipear(page: Page, selector: string, valor: string) {
  const campo = page.locator(selector).first();
  await campo.click();
  await campo.fill('');
  await campo.pressSequentially(valor, { delay: 30 });
  await campo.press('Tab');
  await esperarFinDeCarga(page);
}

const numero = (t: string) => importeANumero(t) ?? NaN;

test.describe('Orden de pago de detracción (Perú)', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Detracción: la orden lista la factura por su detracción, la asigna y se aprueba', async ({ page }) => {
    test.setTimeout(900_000);
    const bo = new BackOfficePage(page);
    const factura = new FacturaProveedorPage(page);
    const orden = new OrdenDePagoPage(page);
    const ahora = new Date();
    const hoy = formatearFecha(ahora);
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const serie = 'F999';
    const correlativo = sello.slice(-8);
    const comprobante = `${serie}-${correlativo}`;
    let idFactura = '';
    let idOrden = '';
    let codigo = '';

    const pendientes = (): Locator => page.locator('table').filter({ hasText: /SALDO FISCAL/i }).first();
    const asignadas = (): Locator => page.locator('table').filter({ hasText: /IMPORTE ASIGNADO/i }).first();

    await paso(page, `Factura de proveedor de ${SUCURSAL} con detracción ${TASA}: el BO calcula detracción y pagable`, async () => {
      await bo.ingresar(process.env.BO_USER!, process.env.BO_PASS!);
      await factura.irABandejaDeFacturas();
      await factura.nuevaFactura();
      await factura.elegirSucursal(SUCURSAL);
      await factura.elegirProveedor(PROVEEDOR.termino, PROVEEDOR.razonSocial);
      await tipear(page, factura.campoFecha, hoy);
      await tipear(page, factura.campoVencimiento, hoy);
      if ((await factura.opcionElegida(factura.comboMoneda)) !== MONEDA) {
        await page.locator(factura.comboMoneda).selectOption({ label: MONEDA });
        await esperarFinDeCarga(page);
      }
      await page.locator('#ddPeDocumentType').selectOption({ label: 'Factura' });
      await tipear(page, '#txtPeSeries', serie);
      await tipear(page, '#txtPeCorrelative', correlativo);
      await tipear(page, '#txtPeTaxableBase', '0');
      await tipear(page, '#txtPeNonTaxable', String(NO_GRAVADO));
      await page.locator('#ddPeWithholdingType').selectOption({ label: 'Detracción' });
      await esperarFinDeCarga(page);
      await page.locator('#ddPeDetractionRate').selectOption({ label: TASA });
      await esperarFinDeCarga(page);
      // HU 5118 (25/11/2026): la detraccion de Peru ya no tiene "Constancia" y la cuenta bancaria es
      // opcional. Se carga la cuenta igual, como antes.
      await tipear(page, '#txtPeBankAccount', '00-000-000001');
      await expect(page.locator('#txtPeCertificate'), 'HU 5118: con Detraccion no tiene que aparecer el campo Constancia').toBeHidden();
      await page.locator(factura.campoComentario).fill(`Factura de regresion automatica ${sello}. No operar.`);
      const leido = {
        total: await page.locator('#txtPeTotalAmount').inputValue(),
        detraccion: await page.locator('#txtPeWithholdingTotal').inputValue(),
        pagable: await page.locator('#txtPePayableAmount').inputValue(),
      };
      await adjuntarTexto('Importes del comprobante', `Total ${leido.total} | Retenciones/detracción ${leido.detraccion} | Pagable ${leido.pagable}`);
      await conResaltado(page, page.locator('#txtPePayableAmount'), 'detraccion y pagable', () => {
        expect(numero(leido.total), 'El total del comprobante es el no gravado').toBe(NO_GRAVADO);
        expect(numero(leido.detraccion), `La detracción es el ${TASA} del total`).toBe(DETRACCION);
        expect(numero(leido.pagable), 'Lo pagable al proveedor es el total menos la detracción').toBe(PAGABLE);
      });
      idFactura = await factura.guardar();
      expect(idFactura, 'Guardar la factura tiene que devolver su id').toMatch(/^\d+$/);
      await adjuntarTexto('Factura', `${comprobante} (id ${idFactura})`);
    });

    await paso(page, 'Orden de pago nueva de tipo Detracción al proveedor, en PEN, desde la caja AUTO-QA', async () => {
      await orden.irABandejaDeOrdenes();
      await orden.nuevaOrden();
      await orden.asegurarSucursal(SUCURSAL);
      const tipos = await orden.opcionesDe('#ddOrderType');
      await adjuntarTexto('Tipos de orden que ofrece Perú', tipos.join(' | '));
      await orden.elegirEnCombo('#ddOrderType', 'Detracción');
      await orden.elegirProveedor(PROVEEDOR.termino, PROVEEDOR.razonSocial);
      if (!(await orden.opcionElegida(orden.comboMoneda)).includes(MONEDA)) await orden.elegirEnCombo(orden.comboMoneda, MONEDA);
      await orden.elegirEnCombo('#ddPaymentRefs', '201P');
      await orden.elegirEnCombo(orden.comboCaja, CAJA);
      await orden.cargarImporte(String(DETRACCION));
      await page.locator(orden.campoDetalle).fill(`Orden de detraccion de regresion automatica ${sello}. No operar.`);
      const totalOrden = await page.locator(orden.campoTotal).inputValue();
      await adjuntarTexto('Monto total de la orden', totalOrden);
      await conResaltado(page, page.locator(orden.campoTotal), 'monto total de la orden', () => {
        expect(numero(totalOrden), `Con una sola forma de pago, el monto total de la orden es su importe (${DETRACCION})`).toBe(DETRACCION);
      });
      idOrden = await orden.guardar();
      expect(idOrden, 'Guardar la orden tiene que devolver su id').toMatch(/^\d+$/);
      codigo = (await page.locator(orden.campoCodigo).inputValue()).trim();
      await adjuntarTexto('Orden de pago', `${codigo} (id ${idOrden})`);
    });

    await paso(page, 'La orden lista la factura por su detracción, no por el pagable', async () => {
      const fila = pendientes().locator('tbody tr').filter({ hasText: correlativo });
      await expect(fila, `La factura ${comprobante} tiene que figurar entre las pendientes de la orden de detracción`).toHaveCount(1, { timeout: 60_000 });
      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Fila pendiente', texto);
      await conResaltado(page, fila, 'saldo fiscal de la factura', () => {
        expect(texto, `La factura tiene que figurar por su detracción (${MONEDA} ${DETRACCION})`).toMatch(new RegExp(`${MONEDA}\\s*${DETRACCION}\\b`));
        // La fila trae los importes de la factura: tienen que ser los que se cargaron.
        const dato = (rotulo: string) => numero(texto.match(new RegExp(`${rotulo}:\\s*([\\d.,]+)`, 'i'))?.[1] ?? '');
        expect(dato('Total factura'), 'La fila tiene que mostrar el total de la factura').toBe(NO_GRAVADO);
        expect(dato('Detracciones/retenciones'), 'La fila tiene que mostrar la detracción de la factura').toBe(DETRACCION);
        expect(dato('Pagable'), 'La fila tiene que mostrar el pagable de la factura').toBe(PAGABLE);
      });
    });

    await paso(page, 'Asignar total: la factura pasa a asignada por la detracción y la orden queda sin pendiente', async () => {
      await pendientes().locator('tbody tr').filter({ hasText: correlativo }).locator('a[title="Asignar total"]').click();
      await esperarFinDeCarga(page);
      const fila = asignadas().locator('tbody tr').filter({ hasText: correlativo });
      await expect(fila, `La factura ${comprobante} tiene que pasar a las asignadas`).toHaveCount(1, { timeout: 60_000 });
      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      // En la orden fiscal el encabezado no lleva el id de la orden de pago a proveedor: se lee por su texto.
      const pendiente = ((await page.getByRole('heading', { name: /^Pendiente de asignación:/ }).first().innerText())
        .replace(/^[^:]*:/, '')).trim();
      await adjuntarTexto('Asignada', `${texto}\nPendiente de la orden: ${pendiente}`);
      await conResaltado(page, fila, 'factura asignada', async () => {
        expect(texto, `La asignación tiene que ser por la detracción (${MONEDA} ${DETRACCION})`).toMatch(new RegExp(`${MONEDA}\\s*${DETRACCION}\\b`));
        await expect(pendientes().locator('tbody tr').filter({ hasText: correlativo }), 'La factura asignada no tiene que seguir entre las pendientes').toHaveCount(0);
        expect(numero(pendiente), 'La orden asignada completa queda sin pendiente').toBe(0);
      });
    });

    await paso(page, 'Aprobar con el recibo: la orden queda en Pago y la bandeja la muestra como Detracción', async () => {
      await orden.aprobar(hoy, `AUTOQA-DET-${correlativo}`);
      const estado = await orden.estado();
      await adjuntarTexto('Estado de la orden', estado);
      await orden.irABandejaDeOrdenes();
      // La bandeja abre en la sucursal de trabajo (Argentina): se filtra Perú y el tipo Detracción.
      await page.locator('select:has(option:text-is("Todos")):has(option:text-is("Perú"))').first().selectOption({ label: SUCURSAL });
      await page.locator('select:has(option:text-is("Detracción"))').first().selectOption({ label: 'Detracción' });
      await page.locator("[id$='btnFilter']").first().click();
      await page.waitForLoadState('domcontentloaded');
      await esperarFinDeCarga(page);
      await orden.buscarEnLaBandeja(codigo);
      const celdas = await orden.celdasDeLaBandeja(codigo);
      await adjuntarTexto('Fila de la bandeja', celdas.join(' | '));
      await conResaltado(page, orden.filaEnLaBandeja(codigo), 'orden en la bandeja', () => {
        expect(estado.toUpperCase(), 'Aprobada, la orden tiene que quedar en Pago').toContain('PAGO');
        expect(celdas.join(' | '), 'La bandeja tiene que mostrar el tipo Detracción').toContain('Detracción');
      });
    });
  });
});
