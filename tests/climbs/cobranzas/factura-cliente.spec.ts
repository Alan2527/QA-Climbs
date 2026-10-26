import { test, expect } from '@playwright/test';
import { paso, adjuntarTexto, formatearFecha, numeroDelFile, reiniciarNumeracionDePasos, importeANumero } from '../../../utils/pasos';
import { reservarServicioYGenerarFile } from '../comun/precondiciones';

/**
 * COBRANZAS — app nueva (ClimbsApp).
 *
 * El mismo flujo que tests/bloque-c/factura-cliente.spec.ts, con el mismo titulo para que
 * el tablero los muestre lado a lado: la agencia reserva en el portal nuevo, el personal
 * genera el file en el Backoffice nuevo y le emite el comprobante al cliente desde
 * Facturacion. Todo por pantalla.
 *
 * El Backoffice nuevo tiene modo oscuro, pero este test no lo cubre: es regresion del flujo.
 */

test.describe('Cobranzas', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Factura al cliente: se emite sobre el file y toma sus conceptos', async ({ page }) => {
    test.setTimeout(900_000);
    const erroresJS: string[] = [];
    page.on('pageerror', (e) => erroresJS.push(e.message));

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const pre = await reservarServicioYGenerarFile(page, sello);
    const digitos = numeroDelFile(pre.fileCode);
    let totalDelComprobante: number | null = null;

    await paso(page, 'Entrar a Cartas de cobranza y abrir un comprobante nuevo', async () => {
      await page.goto('/finance/invoicing/letters?state=issued');
      await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
      await expect(page).toHaveURL(/\/finance\/invoicing\/new/);
      await expect(page.locator('#inv-type'), 'Desde Cartas, el tipo tiene que venir en Carta de Cobranza').toHaveValue('2100');
    });

    await paso(page, 'Elegir el destinatario y verificar sus datos', async () => {
      await page.getByRole('button', { name: 'Elegir destinatario' }).click();
      const dlg = page.getByRole('dialog', { name: 'Destinatarios' });
      await dlg.getByRole('searchbox').fill(pre.cliente);
      const fila = dlg.locator('tbody tr').filter({ hasText: pre.cliente }).first();
      await expect(fila, `El buscador de destinatarios tiene que traer a ${pre.cliente}`).toBeVisible({ timeout: 30_000 });
      await fila.click();
      await expect(page.locator('#inv-name'), 'El comprobante tiene que emitirse al cliente del file').toHaveValue(new RegExp(pre.cliente, 'i'));
    });

    await paso(page, 'Cargar desde el file y verificar lo que completa solo', async () => {
      await page.getByRole('button', { name: 'Cargar desde un file' }).click();
      const dlg = page.getByRole('dialog', { name: 'Files del cliente' });
      await dlg.getByRole('searchbox').fill(digitos);
      const fila = dlg.locator('tbody tr').filter({ hasText: digitos }).first();
      await expect(fila, `El buscador de files tiene que traer el file ${pre.fileCode}`).toBeVisible({ timeout: 30_000 });
      await fila.click();
      await expect(dlg).toBeHidden({ timeout: 30_000 });
      // Los conceptos y el vencimiento llegan unos segundos despues de cerrar el dialogo.
      await expect(page.getByRole('textbox', { name: 'Producto 1', exact: true }), 'Los conceptos del file tienen que cargarse').not.toHaveValue('', { timeout: 30_000 });
      await expect(page.locator('#inv-due'), 'El vencimiento lo tiene que calcular el sistema a partir del file y del cliente').not.toHaveValue('', { timeout: 30_000 });

      await expect(page.locator('#inv-file'), 'El comprobante tiene que quedar atado al file').toHaveValue(new RegExp(digitos));
      await expect(page.locator('#inv-pax'), 'El comprobante tiene que tomar el pasajero del file').toHaveValue(new RegExp(pre.apellidoDelPax, 'i'));
      const desde = await page.locator('#inv-from').inputValue();
      const hasta = await page.locator('#inv-to').inputValue();
      expect(`${desde} ${hasta}`, 'Las fechas de los servicios tienen que venir del file').toContain(pre.fecha);
      const moneda = await page.locator('#inv-currency').evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text ?? '');
      expect(moneda, 'La moneda del comprobante tiene que ser la de la venta del file').toContain(pre.ventaDelItem.moneda);
      await adjuntarTexto('Completado desde el file', `Servicios: ${desde} - ${hasta} | Moneda: ${moneda} | Vencimiento: ${await page.locator('#inv-due').inputValue()}`);
    });

    await paso(page, 'Comparar los conceptos y el total contra el file', async () => {
      const filas = await page.getByRole('textbox', { name: /^Producto \d+$/ }).count();
      expect(filas, 'El file tiene que traer un concepto por item reservado').toBe(1);
      const valor = (c: string) => page.getByRole('textbox', { name: `${c} 1`, exact: true }).inputValue();
      const c = {
        producto: await valor('Producto'), concepto: await valor('Concepto'),
        cant: await valor('Cant.'), pu: await valor('PU'), total: await valor('Total'),
      };
      await adjuntarTexto('Concepto traido del file', Object.values(c).join(' | '));
      expect(`${c.producto} ${c.concepto}`.toUpperCase(), 'El concepto tiene que traer el servicio reservado').toContain('TIGRE Y DELTA');
      const cant = importeANumero(c.cant);
      const pu = importeANumero(c.pu);
      const tot = importeANumero(c.total);
      expect(cant, 'La cantidad del concepto tiene que ser la de pasajeros reservados').toBe(pre.cantidadPax);
      expect(Number(((pu ?? 0) * (cant ?? 0)).toFixed(2)), 'El total del concepto tiene que ser su precio unitario por la cantidad')
        .toBe(Number((tot ?? 0).toFixed(2)));

      totalDelComprobante = importeANumero(await page.locator('#inv-total').inputValue());
      expect(totalDelComprobante, 'El total del comprobante tiene que ser la venta del item del file').toBe(pre.ventaDelItem.valor);
    });

    await paso(page, 'Guardar el comprobante y verificar que quede emitido en Cartas de cobranza', async () => {
      await page.locator('#inv-detail').fill(`Factura de regresion automatica ${sello}. No operar.`);
      const respuesta = page.waitForResponse((r) => /\/api\/finance\/invoicing$/.test(r.url()) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      expect((await respuesta).status(), 'Guardar tiene que registrar el comprobante').toBe(200);

      await page.goto(`/finance/invoicing/letters?state=issued&q=${digitos}`);
      const fila = page.locator('tbody tr').filter({ hasText: digitos }).first();
      await expect(fila, `El comprobante del file ${pre.fileCode} tiene que quedar en Cartas emitidas`).toBeVisible({ timeout: 60_000 });
      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Fila del comprobante emitido', texto);
      expect(texto.toUpperCase(), 'Tiene que mostrar el cliente').toContain(pre.cliente.toUpperCase());
      expect(texto.toUpperCase(), 'Tiene que mostrar el pasajero del file').toContain(pre.apellidoDelPax.toUpperCase());
      expect(texto, 'Tiene que mostrar la fecha de emision').toContain(formatearFecha(ahora));
      const importes = (texto.match(/\d[\d.]*,\d+/g) ?? []).map(importeANumero);
      expect(importes, 'Tiene que mostrar el mismo total con el que se guardo').toContain(totalDelComprobante);
    });

    expect(erroresJS, 'La app nueva no tiene que tirar errores de JavaScript durante el flujo').toEqual([]);
  });
});
