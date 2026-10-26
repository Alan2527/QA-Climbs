import { test, expect, Page, Locator } from '@playwright/test';
import { BackofficeNuevoPage } from '../../../pages/climbs/backoffice.page';
import { OrdenDePagoNuevaPage } from '../../../pages/climbs/orden-de-pago.page';
import { elegirEnMenuAcciones } from '../../../pages/climbs/menu-acciones';
import { paso, adjuntarTexto, formatearFecha, numeroDelFile, reiniciarNumeracionDePasos, importeANumero } from '../../../utils/pasos';
import {
  reservarServicioYGenerarFile, armarFacturaAlCliente, armarFacturaAprobada, cajaDeRegresion, PROVEEDOR_DE_REGRESION, FacturaAprobada,
} from '../comun/precondiciones';

/**
 * COBRANZAS — app nueva (ClimbsApp). Anulaciones.
 *
 * Los mismos tres tests que tests/bloque-c/anulaciones.spec.ts, con los mismos titulos:
 * 1. Dar de baja la carta de cobranza: sale de Cartas emitidas, el panel del file la deja de
 *    listar, vuelve a faltar cobrar la venta, el file vuelve a A facturar y se puede volver a
 *    facturar.
 * 2. Anular ordenes de pago: la que no tiene imputacion se anula; la imputada sigue vigente.
 * 3. Orden de pago parcial: imputar parcial baja el pendiente de la factura ese monto, y no
 *    se puede imputar mas que el pendiente de la orden ni de la factura.
 */
const n = (s: string) => importeANumero(s) ?? 0;
const coma = (x: number) => x.toFixed(2).replace('.', ',');

/** Una orden de pago a GRUPO SUMMA desde la caja AUTO-QA, guardada **sin imputar**. */
async function guardarOrdenSinImputar(page: Page, moneda: string, monto: number, detalle: string) {
  const orden = new OrdenDePagoNuevaPage(page);
  await orden.abrirNueva();
  if (!(await orden.opcionElegida('branch')).includes('Argentina')) await orden.campo('branch').selectOption({ label: 'Argentina' });
  await orden.elegirProveedor(PROVEEDOR_DE_REGRESION.termino, PROVEEDOR_DE_REGRESION.razonSocial);
  await orden.campo('currency').selectOption({ label: moneda });
  await orden.campo('cf-0').selectOption({ label: cajaDeRegresion(moneda) });
  await orden.campo('amount-0').fill(coma(monto));
  await orden.campo('amount-0').press('Tab');
  await orden.campo('detail').fill(detalle);
  const id = await orden.guardar();
  const codigo = (await orden.campo('code').inputValue()).trim();
  await adjuntarTexto(`Orden de pago guardada sin imputar (${detalle})`, `${codigo} (id ${id}) por ${moneda} ${coma(monto)}`);
  return { id, codigo };
}

/** La fila de una orden en el listado, buscada con el buscador del propio listado. */
async function filaEnElListado(page: Page, codigo: string): Promise<Locator> {
  await page.goto('/finance/pay-orders');
  await page.getByPlaceholder('Código, proveedor, referencia u observación').fill(codigo);
  await page.waitForLoadState('networkidle');
  return page.locator('tbody tr').filter({ hasText: codigo });
}

/**
 * Si la fila ofrece "Anular". Con varias acciones van en el menu "Acciones" (se abre y se
 * cierra sin elegir); con una sola, la pantalla muestra ese boton directo y no hay menu.
 */
async function ofreceAnular(page: Page, fila: Locator, codigo: string): Promise<boolean> {
  const menuDeLaFila = fila.getByRole('button', { name: /^Acciones/ });
  if (await menuDeLaFila.count() === 0) return await fila.getByRole('button', { name: `Anular ${codigo}` }).count() > 0;
  await menuDeLaFila.click();
  const menu = page.getByRole('menu', { name: 'Acciones' });
  await expect(menu).toBeVisible();
  const hay = await menu.getByRole('menuitem', { name: `Anular ${codigo}` }).count() > 0;
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  return hay;
}

/** Anula desde el menu de la fila y confirma la pregunta. */
async function anular(page: Page, fila: Locator, codigo: string) {
  await elegirEnMenuAcciones(page, fila, new RegExp(`^Anular ${codigo}$`));
  const pregunta = page.getByRole('alertdialog').filter({ hasText: '¿Anular la orden de pago?' });
  await pregunta.getByRole('button', { name: 'Anular', exact: true }).click();
  await expect(pregunta).toBeHidden({ timeout: 30_000 });
}

/** Estado de la orden en su ficha (la pastilla de la tarjeta "Orden de pago"). */
async function estadoDeLaOrden(page: Page, id: string): Promise<string> {
  await page.goto(`/finance/pay-orders/${id}`);
  const tarjeta = page.locator('section, .card').filter({ has: page.getByRole('heading', { name: 'Orden de pago', exact: true }) }).first();
  await expect(tarjeta.locator('.badge, [class*="badge"]').first(), 'La orden tiene que mostrar su estado').toBeVisible({ timeout: 60_000 });
  return (await tarjeta.locator('.badge, [class*="badge"]').first().innerText()).trim();
}

test.describe('Cobranzas — anulaciones', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  // =====================================================================================
  // 1. Dar de baja la carta de cobranza
  // =====================================================================================
  test('Anular la carta de cobranza: sale de Cartas emitidas, el file vuelve a A Facturar y se puede volver a facturar', async ({ page }) => {
    test.setTimeout(1_800_000);
    const erroresJS: string[] = [];
    page.on('pageerror', (e) => erroresJS.push(e.message));
    const bo = new BackofficeNuevoPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

    const base = await reservarServicioYGenerarFile(page, sello);
    const carta = await armarFacturaAlCliente(page, sello, base);
    const digitos = numeroDelFile(base.fileCode);
    const venta = base.ventaDelItem.valor as number;
    let estadoAntes = '';

    await paso(page, `Abrir el file ${base.fileCode} y leer su estado y el panel con la carta emitida`, async () => {
      await bo.abrirFicha(base.fileId);
      estadoAntes = await bo.estadoDelFile();
      await bo.verFinanzas();
      const cliente = await bo.cifras(bo.ladoCliente());
      await adjuntarTexto('Estado del file con la carta emitida', estadoAntes);
      await adjuntarTexto('Cifras del cliente con la carta emitida', JSON.stringify(cliente, null, 1));
      const filas = bo.listaDeFacturas().locator('li');
      await expect(filas, 'Con la carta emitida, la lista "Facturas" del cliente tiene que tener una sola fila').toHaveCount(1);
      await expect(filas.first(), `La fila tiene que ser la de la carta ${carta.comprobante}`).toContainText(carta.comprobante);
      expect(n(cliente['Facturado']), 'La carta factura toda la venta del file').toBe(venta);
      if (estadoAntes !== 'Facturado') {
        test.info().annotations.push({ type: 'aviso', description: `Con la carta emitida el file quedo en "${estadoAntes}" y no en Facturado: no se exige la vuelta a A facturar.` });
      }
    });

    await paso(page, 'Dar de baja la carta desde Cartas emitidas', async () => {
      await page.goto(`/finance/invoicing/letters?state=issued&q=${digitos}`);
      const fila = page.locator('tbody tr').filter({ hasText: carta.comprobante }).first();
      await expect(fila, `Cartas emitidas tiene que listar la carta ${carta.comprobante}`).toBeVisible({ timeout: 60_000 });
      await adjuntarTexto('Fila de la carta antes de darla de baja', (await fila.innerText()).replace(/\s+/g, ' '));
      await elegirEnMenuAcciones(page, fila, new RegExp(`^Eliminar ${carta.comprobante}$`));
      const pregunta = page.getByRole('alertdialog').filter({ hasText: '¿Dar de baja la carta?' });
      await pregunta.getByRole('button', { name: 'Eliminar', exact: true }).click();
      await expect(pregunta).toBeHidden({ timeout: 30_000 });
      await expect(page.locator('tbody tr').filter({ hasText: carta.comprobante }), `La carta ${carta.comprobante} no tiene que seguir en Cartas emitidas`)
        .toHaveCount(0, { timeout: 60_000 });
    });

    await paso(page, 'El panel Comprobantes y saldos deja de listar la carta y vuelve a faltar cobrar la venta', async () => {
      await bo.abrirFicha(base.fileId);
      const estado = await bo.estadoDelFile();
      await bo.verFinanzas();
      const cliente = await bo.cifras(bo.ladoCliente());
      await adjuntarTexto('Cifras del cliente con la carta dada de baja', JSON.stringify(cliente, null, 1));
      await adjuntarTexto('Estado del file con la carta dada de baja', estado);
      await expect(bo.listaDeFacturas().locator('li'), 'Sin la carta, la lista "Facturas" del cliente no tiene que listar ningun comprobante').toHaveCount(0);
      await expect(bo.listaDeFacturas().getByText('Sin facturas'), 'Sin comprobantes, la lista tiene que mostrar el cartel de vacia').toBeVisible();
      expect(n(cliente['Venta del file']), 'La baja no toca la venta del file').toBe(venta);
      expect(n(cliente['Facturado']), 'Sin la carta, no queda nada facturado').toBe(0);
      expect(n(cliente['Cobrado']), 'No se cobro nada').toBe(0);
      expect(n(cliente['Falta cobrar']), 'Sin la carta, vuelve a faltar cobrar toda la venta').toBe(venta);
      await expect(bo.ladoCliente().locator('.fa-figure--owed'), 'La cifra "Falta cobrar" tiene que volver a marcarse como deuda').toHaveCount(1);
      if (estadoAntes === 'Facturado') expect(estado, 'Sin la unica carta, el file Facturado tiene que volver a A facturar').toBe('A facturar');
    });

    await paso(page, 'Volver a facturar el file: la venta quedo libre y la carta nueva lleva otro numero', async () => {
      const nueva = await armarFacturaAlCliente(page, sello, base);
      await adjuntarTexto('Carta nueva', `${nueva.comprobante} por ${nueva.total} (la dada de baja era ${carta.comprobante} por ${carta.total})`);
      // En el BO actual el numero no se reutiliza. En la app nueva, el 26/10/2026 la carta
      // nueva salio con el numero de la dada de baja: es una diferencia anotada, no bloquea
      // el resto del paso pero deja el test en rojo.
      expect.soft(nueva.comprobante, 'La carta nueva no puede reusar el numero de la dada de baja').not.toBe(carta.comprobante);
      expect(nueva.total, 'La carta nueva tiene que facturar la misma venta').toBe(carta.total);
      await bo.abrirFicha(base.fileId);
      const estado = await bo.estadoDelFile();
      await bo.verFinanzas();
      const filas = bo.listaDeFacturas().locator('li');
      await expect(filas, 'El panel tiene que listar solo la carta nueva').toHaveCount(1);
      await expect(filas.first(), `La fila tiene que ser la carta nueva ${nueva.comprobante}`).toContainText(nueva.comprobante);
      // Con el mismo numero no se puede distinguir en el panel cual de las dos es: solo se compara si difieren.
      if (nueva.comprobante !== carta.comprobante) {
        await expect(filas.first(), 'La carta dada de baja no puede volver a aparecer').not.toContainText(carta.comprobante);
      }
      if (estadoAntes === 'Facturado') expect(estado, 'Facturada de nuevo toda la venta, el file tiene que volver a Facturado').toBe('Facturado');
    });

    expect(erroresJS, 'La app nueva no tiene que tirar errores de JavaScript durante el flujo').toEqual([]);
  });

  // =====================================================================================
  // 2. Anular ordenes de pago
  // =====================================================================================
  test('Anular ordenes de pago: la que no tiene imputacion se anula y la imputada sigue vigente', async ({ page }) => {
    test.setTimeout(1_800_000);
    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);
    const orden = new OrdenDePagoNuevaPage(page);

    const base = await reservarServicioYGenerarFile(page, sello);
    const factura = await armarFacturaAprobada(page, sello, ahora, base);

    await paso(page, 'Una orden de pago sin imputar se puede anular desde el listado', async () => {
      const primera = await guardarOrdenSinImputar(page, factura.moneda, 100, `Orden de pago de regresion automatica ${sello} para anular. No operar.`);
      let fila = await filaEnElListado(page, primera.codigo);
      await expect(fila, `La orden ${primera.codigo} tiene que figurar en el listado`).toBeVisible({ timeout: 60_000 });
      expect(await ofreceAnular(page, fila, primera.codigo), 'Sin imputaciones, el listado tiene que ofrecer Anular la orden').toBe(true);
      await anular(page, fila, primera.codigo);
      fila = await filaEnElListado(page, primera.codigo);
      await expect(fila, `La orden anulada ${primera.codigo} no tiene que seguir en el listado`).toHaveCount(0, { timeout: 60_000 });
      const estado = await estadoDeLaOrden(page, primera.id);
      await adjuntarTexto('Estado de la orden anulada', estado);
      expect(estado.toUpperCase(), 'La ficha tiene que mostrar la orden como anulada').toContain('ANULAD');
    });

    const segunda = { id: '', codigo: '' };
    let listado!: Locator;

    await paso(page, 'Guardar una orden por el total de la factura, todavia sin imputar, y ver que el listado ofrece Anular', async () => {
      Object.assign(segunda, await guardarOrdenSinImputar(page, factura.moneda, factura.total,
        `Orden de pago de regresion automatica ${sello} imputada. No operar.`));
      listado = await filaEnElListado(page, segunda.codigo);
      await expect(listado, `La orden ${segunda.codigo} tiene que figurar en el listado`).toBeVisible({ timeout: 60_000 });
      expect(await ofreceAnular(page, listado, segunda.codigo), 'Mientras no tenga imputaciones, el listado ofrece Anular').toBe(true);
    });

    await paso(page, 'Imputar la orden a la factura desde otra pestana, sin recargar el listado', async () => {
      const otra = await page.context().newPage();
      try {
        const enOtra = new OrdenDePagoNuevaPage(otra);
        await otra.goto(`/finance/pay-orders/${segunda.id}`);
        await enOtra.asignar(await enOtra.abrirAsignacion(enOtra.filaPendiente(factura.numeroDeFactura)), coma(factura.total), `AUTO-QA ${sello.slice(-8)}`);
        await expect.poll(async () => n((await enOtra.pendienteDeAsignacion().innerText()).split(':')[1] ?? ''),
          { message: 'Imputada la factura entera, la orden no tiene que tener pendiente', timeout: 30_000 }).toBe(0);
      } finally {
        await otra.close();
      }
    });

    await paso(page, 'Intentar anular la orden imputada desde el listado sin recargar: la orden sigue vigente', async () => {
      await page.bringToFront();
      // El listado puede haberse refrescado solo al volver a la pestana: si ya no ofrece
      // Anular, el intento no se puede hacer por pantalla y se deja constancia.
      const ofrece = await ofreceAnular(page, listado, segunda.codigo);
      if (ofrece) {
        await anular(page, listado, segunda.codigo);
      } else {
        test.info().annotations.push({ type: 'aviso', description: 'Al volver a la pestana el listado ya se habia actualizado y no ofrecio Anular la orden imputada: no se pudo intentar la anulacion.' });
      }
      await adjuntarTexto('Intento de anular la orden imputada', ofrece ? 'El listado sin recargar todavia ofrecia Anular: se intento.' : 'El listado ya no ofrecia Anular.');
      const estado = await estadoDeLaOrden(page, segunda.id);
      const pendiente = (await orden.pendienteDeAsignacion().innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Orden despues del intento de anulacion', `${estado} · ${pendiente}`);
      expect(estado.toUpperCase(), 'La orden imputada a una factura no se puede anular').not.toContain('ANULAD');
      expect(estado.toUpperCase(), 'La orden tiene que seguir pendiente de aprobar').toContain('PENDIENTE');
      expect(n(pendiente.split(':')[1] ?? ''), 'La imputacion a la factura tiene que seguir en pie: sin pendiente de asignacion').toBe(0);
      await expect(await filaEnElListado(page, segunda.codigo), 'La orden tiene que seguir listada').toBeVisible({ timeout: 60_000 });
    });

    await paso(page, 'Aprobada la orden, el listado deja de ofrecer Anular', async () => {
      await page.goto(`/finance/pay-orders/${segunda.id}`);
      await orden.aprobar(fechaDeHoy, `AUTOQAN${sello.slice(-7)}`);
      await expect(page.getByText('Pago', { exact: true }), 'Aprobada, la orden tiene que quedar en estado Pago').toBeVisible({ timeout: 60_000 });
      const fila = await filaEnElListado(page, segunda.codigo);
      await expect(fila, `La orden ${segunda.codigo} tiene que seguir en el listado`).toBeVisible({ timeout: 60_000 });
      expect(await ofreceAnular(page, fila, segunda.codigo), 'Una orden aprobada e imputada no tiene que ofrecer Anular').toBe(false);
    });
  });

  // =====================================================================================
  // 3. Ordenes de pago parciales
  // =====================================================================================
  test('Orden de pago parcial: el pendiente de la factura baja el monto imputado y no se puede imputar de mas', async ({ page }) => {
    test.setTimeout(1_800_000);
    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const orden = new OrdenDePagoNuevaPage(page);

    const base = await reservarServicioYGenerarFile(page, sello);
    const factura: FacturaAprobada = await armarFacturaAprobada(page, sello, ahora, base);
    const total = factura.total;
    const parcial = Math.round(total * 0.4 * 100) / 100;
    const resto = Math.round((total - parcial) * 100) / 100;
    const sobrante = Math.max(10, Math.round(parcial * 0.1));
    await adjuntarTexto('Montos de la prueba', `Factura ${factura.puntoDeVenta}-${factura.numeroDeFactura}: ${factura.moneda} ${coma(total)}\nParcial: ${coma(parcial)}\nResto: ${coma(resto)}`);

    const pendienteDeLaOrden = async () => n((await orden.pendienteDeAsignacion().innerText()).split(':')[1] ?? '');
    const saldoDeLaFactura = async () => {
      const fila = orden.filaPendiente(factura.numeroDeFactura);
      await expect(fila, 'La factura tiene que seguir entre las pendientes').toBeVisible({ timeout: 60_000 });
      const celdas = (await fila.locator('td').allInnerTexts()).map((c) => c.trim());
      await adjuntarTexto('Fila de la factura pendiente de pago', celdas.join(' | '));
      return n(celdas.filter((c) => /^[A-Z]{3}\s*-?\d[\d.,]*$/.test(c)).at(-1) ?? '');
    };
    /** Intenta imputar un monto que la pantalla tiene que rechazar y espera el aviso. */
    const imputarYEsperarAviso = async (dialogo: Locator, monto: number, aviso: RegExp) => {
      await dialogo.locator('#pa-amount').fill(coma(monto));
      await dialogo.locator('#pa-comment').fill('AUTO-QA monto excedido');
      await dialogo.getByRole('button', { name: /^(Guardar|Aceptar)$/ }).click();
      await expect(page.getByText(aviso).first(), `Al superar el pendiente, la pantalla tiene que avisar ${aviso}`).toBeVisible({ timeout: 30_000 });
      await adjuntarTexto(`Aviso ${aviso}`, (await page.getByText(aviso).first().innerText().catch(() => '')) || '(el aviso se fue antes de leerlo)');
    };

    const ordenA = { id: '', codigo: '' };
    const ordenB = { id: '', codigo: '' };

    await paso(page, 'Orden parcial: imputar mas que el pendiente de la orden se rechaza con aviso y no escribe nada', async () => {
      Object.assign(ordenA, await guardarOrdenSinImputar(page, factura.moneda, parcial, `Orden de pago parcial de regresion automatica ${sello}. No operar.`));
      const dialogo = await orden.abrirAsignacion(orden.filaPendiente(factura.numeroDeFactura));
      const i = await orden.importesDelDialogo(dialogo);
      await adjuntarTexto('Importes del dialogo (orden parcial)', JSON.stringify(i, null, 2));
      expect(n(i.ordenPendiente), 'La orden parcial arranca con todo su monto pendiente').toBe(parcial);
      expect(n(i.facturaPendiente), 'La factura arranca con todo su total pendiente').toBe(total);
      await imputarYEsperarAviso(dialogo, parcial + sobrante, /supera el monto pendiente de asignaci.n de la OP/i);
      await page.goto(`/finance/pay-orders/${ordenA.id}`);
      expect(await pendienteDeLaOrden(), 'El intento rechazado no tiene que haber imputado nada').toBe(parcial);
      expect(await saldoDeLaFactura(), 'El intento rechazado no tiene que haber tocado el saldo de la factura').toBeCloseTo(total, 2);
    });

    await paso(page, 'Imputar el monto de la orden parcial: el pendiente de la factura baja exactamente ese monto', async () => {
      await orden.asignar(await orden.abrirAsignacion(orden.filaPendiente(factura.numeroDeFactura)), coma(parcial), `AUTO-QA ${sello.slice(-8)}`);
      await expect.poll(pendienteDeLaOrden, { message: 'Imputado todo su monto, la orden no tiene que tener pendiente', timeout: 30_000 }).toBe(0);
      expect(await saldoDeLaFactura(), `El saldo de la factura tiene que bajar exactamente ${coma(parcial)}: de ${coma(total)} a ${coma(resto)}`).toBeCloseTo(resto, 2);
    });

    await paso(page, 'Segunda orden por el total de la factura: el dialogo muestra el resto como pendiente de la factura', async () => {
      Object.assign(ordenB, await guardarOrdenSinImputar(page, factura.moneda, total, `Orden de pago de regresion automatica ${sello} por el total. No operar.`));
      const dialogo = await orden.abrirAsignacion(orden.filaPendiente(factura.numeroDeFactura));
      const i = await orden.importesDelDialogo(dialogo);
      await adjuntarTexto('Importes del dialogo (segunda orden)', JSON.stringify(i, null, 2));
      expect(n(i.facturaPagable), 'El pagable de la factura no cambia con el pago parcial').toBe(total);
      expect(n(i.facturaPendiente), 'La segunda orden tiene que ver el pendiente que dejo la primera').toBeCloseTo(resto, 2);
      expect(n(i.ordenPendiente), 'La segunda orden arranca con todo su monto pendiente').toBe(total);
    });

    await paso(page, 'Imputar mas que el pendiente de la factura se rechaza con aviso y no escribe nada', async () => {
      const dialogo = page.getByRole('dialog', { name: 'Asignación OP' });
      await imputarYEsperarAviso(dialogo, total, /supera el monto pendiente de la factura/i);
      await page.goto(`/finance/pay-orders/${ordenB.id}`);
      expect(await pendienteDeLaOrden(), 'El intento rechazado no tiene que haber imputado nada').toBe(total);
      expect(await saldoDeLaFactura(), 'El intento rechazado no tiene que haber tocado el saldo de la factura').toBeCloseTo(resto, 2);
    });

    await paso(page, 'Imputar el pendiente exacto de la factura la deja saldada', async () => {
      await orden.asignar(await orden.abrirAsignacion(orden.filaPendiente(factura.numeroDeFactura)), coma(resto), `AUTO-QA ${sello.slice(-8)}`);
      await expect.poll(pendienteDeLaOrden, { message: 'La segunda orden pago solo el resto: le tiene que quedar pendiente lo que la primera ya habia pagado', timeout: 30_000 })
        .toBeCloseTo(parcial, 2);
      await expect(orden.filaPendiente(factura.numeroDeFactura), 'Imputado el resto, la factura esta saldada y no tiene que seguir entre las pendientes')
        .toHaveCount(0, { timeout: 60_000 });
    });
  });
});
