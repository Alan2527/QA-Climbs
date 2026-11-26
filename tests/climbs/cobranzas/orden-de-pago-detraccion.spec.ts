import { test, expect, Locator } from '@playwright/test';
import { FacturaProveedorNuevaPage } from '../../../pages/climbs/factura-proveedor.page';
import { OrdenDePagoNuevaPage } from '../../../pages/climbs/orden-de-pago.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado, formatearFecha, importeANumero } from '../../../utils/pasos';

/**
 * COBRANZAS — app nueva (ClimbsApp). Orden de pago de detracción (Perú, Azure 4811).
 *
 * El mismo flujo que tests/bloque-c/orden-de-pago-detraccion.spec.ts, con el mismo titulo y los
 * mismos importes: la factura del proveedor de Perú con detracción del 10% (no gravado PEN 1.000,
 * detracción 100, pagable 900) y una orden de tipo Detracción por 100 que la lista por su
 * detracción, la asigna por el total y se aprueba.
 *
 * Datos propios (los mismos del BO viejo):
 *   - proveedor 3344 "AUTO-QA NO TOCAR - PROVEEDOR DETRACCION PERU" (Perú, RUC 20999999996, PEN);
 *   - caja 213 "AUTO-QA NO TOCAR - CAJA PEN PERU" (Perú, PEN).
 */
const SUCURSAL = 'Perú';
const PROVEEDOR = { termino: 'AUTO-QA NO TOCAR - PROVEEDOR DETRACCION', razonSocial: 'AUTO-QA NO TOCAR - PROVEEDOR DETRACCION PERU' };
const CAJA = 'AUTO-QA NO TOCAR - CAJA PEN PERU';
const MONEDA = 'PEN';
const NO_GRAVADO = 1000;
const TASA = '10%';
const DETRACCION = 100;
const PAGABLE = NO_GRAVADO - DETRACCION;

const numero = (t: string) => importeANumero(t) ?? NaN;
const coma = (x: number) => x.toFixed(2).replace('.', ',');

test.describe('Orden de pago de detracción (Perú)', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Detracción: la orden lista la factura por su detracción, la asigna y se aprueba', async ({ page }) => {
    test.setTimeout(900_000);
    const factura = new FacturaProveedorNuevaPage(page);
    const orden = new OrdenDePagoNuevaPage(page);
    const ahora = new Date();
    const hoy = formatearFecha(ahora);
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const serie = 'F999';
    const correlativo = sello.slice(-8);
    const comprobante = `${serie}-${correlativo}`;
    let idFactura = '';
    let idOrden = '';
    let codigo = '';

    const pendiente = (): Locator => orden.filaPendiente(correlativo);
    const asignada = (): Locator => orden.filaAsignada(correlativo);
    const pendienteDeLaOrden = async () => numero((await orden.pendienteDeAsignacion().innerText()).replace(/\s+/g, ' ')
      .replace(/^\s*Pendiente de asignación:?/, '').replace(/·.*$/, ''));

    await paso(page, `Factura de proveedor de ${SUCURSAL} con detracción ${TASA}: la pantalla calcula detracción y pagable`, async () => {
      await factura.abrirNueva();
      await factura.elegirSucursal(SUCURSAL);
      await factura.elegirProveedor(PROVEEDOR.termino, PROVEEDOR.razonSocial);
      if ((await factura.opcionElegida('currency')) !== MONEDA) await factura.campo('currency').selectOption({ label: MONEDA });
      await factura.campo('pe-type').selectOption({ label: 'Factura' });
      await factura.campo('pe-series').fill(serie);
      await factura.campo('pe-correlative').fill(correlativo);
      await factura.campo('pe-base').fill('0');
      await factura.campo('pe-base').press('Tab');
      await factura.campo('pe-nontaxable').fill(String(NO_GRAVADO));
      await factura.campo('pe-nontaxable').press('Tab');
      await factura.campo('pe-withholding').selectOption({ label: 'Detracción' });
      await factura.campo('pe-detraction-rate').selectOption({ label: TASA });
      // T-231 (25/11/2026): la detraccion de Peru ya no tiene "Constancia" ("quitar el campo
      // Constancia") y la cuenta bancaria es opcional. Se carga la cuenta igual, como antes.
      await factura.campo('pe-bank').fill('00-000-000001');
      await expect(factura.campo('pe-certificate'), 'T-231: con Detraccion no tiene que aparecer el campo Constancia').toBeHidden();
      await factura.campo('comment').fill(`Factura de regresion automatica ${sello}. No operar.`);
      const leido = {
        total: await factura.campo('country-total').inputValue(),
        detraccion: await factura.campo('country-withholding').inputValue(),
        pagable: await factura.campo('country-payable').inputValue(),
      };
      await adjuntarTexto('Importes del comprobante', `Total ${leido.total} | Retenciones/detracción ${leido.detraccion} | Pagable ${leido.pagable}`);
      await conResaltado(page, factura.campo('country-payable'), 'detraccion y pagable', () => {
        expect(numero(leido.total), 'El total del comprobante es el no gravado').toBe(NO_GRAVADO);
        expect(numero(leido.detraccion), `La detracción es el ${TASA} del total`).toBe(DETRACCION);
        expect(numero(leido.pagable), 'Lo pagable al proveedor es el total menos la detracción').toBe(PAGABLE);
      });
      idFactura = await factura.guardar();
      expect(idFactura, 'Guardar la factura tiene que devolver su id').toMatch(/^\d+$/);
      await adjuntarTexto('Factura', `${comprobante} (id ${idFactura})`);
    });

    await paso(page, 'Orden de pago nueva de tipo Detracción al proveedor, en PEN, desde la caja AUTO-QA', async () => {
      await orden.abrirNueva();
      if (!(await orden.opcionElegida('branch')).includes(SUCURSAL)) await orden.campo('branch').selectOption({ label: SUCURSAL });
      // Los tipos dependen de la sucursal: se esperan los de Perú antes de leerlos.
      await expect.poll(() => orden.opciones('type'), { message: 'Perú tiene que ofrecer el tipo de orden Detracción', timeout: 30_000 }).toContain('Detracción');
      const tipos = await orden.opciones('type');
      await adjuntarTexto('Tipos de orden que ofrece Perú', tipos.join(' | '));
      await orden.elegir('type', 'Detracción');
      await orden.elegirProveedor(PROVEEDOR.termino, PROVEEDOR.razonSocial);
      await expect(orden.campo('supplier'), 'La orden tiene que quedar a nombre del proveedor de la factura').toHaveValue(PROVEEDOR.razonSocial);
      if (!(await orden.opcionElegida('currency')).includes(MONEDA)) await orden.campo('currency').selectOption({ label: MONEDA });
      if (!(await orden.opcionElegida('ref')).includes('201P')) await orden.elegir('ref', '201P');
      await orden.elegir('cf-0', CAJA);
      await orden.campo('amount-0').fill(coma(DETRACCION));
      await orden.campo('amount-0').press('Tab');
      await orden.campo('detail').fill(`Orden de detraccion de regresion automatica ${sello}. No operar.`);
      const totalOrden = await orden.campo('total').inputValue();
      await adjuntarTexto('Monto total de la orden', totalOrden);
      await conResaltado(page, orden.campo('total'), 'monto total de la orden', () => {
        expect(numero(totalOrden), `Con una sola forma de pago, el monto total de la orden es su importe (${DETRACCION})`).toBe(DETRACCION);
      });
      idOrden = await orden.guardar();
      expect(idOrden, 'Guardar la orden tiene que devolver su id').toMatch(/^\d+$/);
      codigo = (await orden.campo('code').inputValue()).trim();
      await adjuntarTexto('Orden de pago', `${codigo} (id ${idOrden})`);
    });

    await paso(page, 'La orden lista la factura por su detracción, no por el pagable', async () => {
      await expect(pendiente(), `La factura ${comprobante} tiene que figurar entre las pendientes de la orden de detracción`).toHaveCount(1, { timeout: 60_000 });
      const texto = (await pendiente().innerText()).replace(/\s+/g, ' ');
      const celdas = (await pendiente().locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
      await adjuntarTexto('Fila pendiente', celdas.join(' | '));
      await conResaltado(page, pendiente(), 'saldo fiscal de la factura', () => {
        const saldo = celdas.filter((c) => /^[A-Z]{3}\s*-?\d[\d.,]*$/.test(c)).at(-1) ?? '';
        expect(saldo, `La factura tiene que figurar por su detracción (${MONEDA} ${DETRACCION})`).toMatch(new RegExp(`^${MONEDA}\\s*${DETRACCION}\\b`));
        // La fila trae los importes de la factura: tienen que ser los que se cargaron.
        const dato = (rotulo: string) => numero(texto.match(new RegExp(`${rotulo}:\\s*(?:[A-Z]{3}\\s*)?([\\d.,]+)`, 'i'))?.[1] ?? '');
        expect(dato('Total factura'), 'La fila tiene que mostrar el total de la factura').toBe(NO_GRAVADO);
        expect(dato('Retenciones'), 'La fila tiene que mostrar la detracción de la factura').toBe(DETRACCION);
        expect(dato('Pagable'), 'La fila tiene que mostrar el pagable de la factura').toBe(PAGABLE);
      });
    });

    await paso(page, 'Asignar total: la factura pasa a asignada por la detracción y la orden queda sin pendiente', async () => {
      await pendiente().getByRole('button', { name: `Asignar total ${comprobante}` }).or(pendiente().getByRole('button', { name: /^Asignar total/ })).first().click();
      await expect(asignada(), `La factura ${comprobante} tiene que pasar a las asignadas`).toHaveCount(1, { timeout: 60_000 });
      await expect(pendiente(), 'La factura asignada no tiene que seguir entre las pendientes').toHaveCount(0, { timeout: 30_000 });
      const celdas = (await asignada().locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
      const resto = await pendienteDeLaOrden();
      await adjuntarTexto('Asignada', `${celdas.join(' | ')}\nPendiente de la orden: ${resto}`);
      await conResaltado(page, asignada(), 'factura asignada', () => {
        const asignado = celdas.filter((c) => /^[A-Z]{3}\s*-?\d[\d.,]*$/.test(c)).at(-1) ?? '';
        expect(asignado, `La asignación tiene que ser por la detracción (${MONEDA} ${DETRACCION})`).toMatch(new RegExp(`^${MONEDA}\\s*${DETRACCION}\\b`));
        expect(resto, 'La orden asignada completa queda sin pendiente').toBe(0);
      });
    });

    await paso(page, 'Aprobar con el recibo: la orden queda en Pago y el listado la muestra como Detracción', async () => {
      await orden.aprobar(hoy, `AUTOQA-DET-${correlativo}`);
      await expect(page.getByRole('dialog').or(page.locator('main')).last().getByText('Pago', { exact: true }).filter({ visible: true }).first(),
        'Aprobada, la orden tiene que quedar en Pago').toBeVisible({ timeout: 60_000 });
      await page.goto('/finance/pay-orders');
      // El listado abre en la sucursal de trabajo (Argentina): se filtra Perú y el tipo Detracción, como en el BO viejo.
      await page.getByRole('combobox', { name: 'Sucursal' }).first().selectOption({ label: SUCURSAL });
      await page.getByRole('combobox', { name: 'Tipo' }).first().selectOption({ label: 'Detracción' });
      await page.locator('#search-pay-orders').fill(codigo);
      await page.waitForLoadState('networkidle');
      const fila = page.locator('tbody tr').filter({ hasText: codigo });
      await expect(fila, `Filtrado por el tipo Detracción, el listado tiene que traer la orden ${codigo}`).toHaveCount(1, { timeout: 60_000 });
      const celdas = (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
      await adjuntarTexto('Fila del listado (filtro Tipo: Detracción)', celdas.join(' | '));
      await conResaltado(page, fila, 'orden en el listado', () => {
        expect(celdas.join(' | '), 'El listado tiene que mostrar la orden en Pago').toContain('Pago');
        expect(celdas.join(' | '), `El listado tiene que mostrar la orden por ${MONEDA} ${DETRACCION}`).toMatch(new RegExp(`${MONEDA}\\s*${DETRACCION}\\b`));
      });
    });
  });
});
