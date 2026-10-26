import { test, expect } from '@playwright/test';
import { OrdenDePagoNuevaPage } from '../../../pages/climbs/orden-de-pago.page';
import { paso, adjuntarTexto, formatearFecha, reiniciarNumeracionDePasos, importeANumero } from '../../../utils/pasos';
import { reservarServicioYGenerarFile, armarFacturaAprobada, cajaDeRegresion, PROVEEDOR_DE_REGRESION } from '../comun/precondiciones';

/**
 * COBRANZAS — app nueva (ClimbsApp).
 *
 * El mismo flujo que tests/bloque-c/orden-de-pago.spec.ts, con el mismo titulo: la factura
 * del proveedor, aprobada, se paga con una orden desde la caja AUTO-QA de su moneda, se
 * imputa y se aprueba aplicando el recibo. Todo por pantalla.
 */
const comoFecha = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s.trim());

test.describe('Cobranzas', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Orden de pago: cancela la factura del proveedor desde la caja de regresion', async ({ page }) => {
    test.setTimeout(900_000);
    const erroresJS: string[] = [];
    page.on('pageerror', (e) => erroresJS.push(e.message));
    const orden = new OrdenDePagoNuevaPage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);
    const datos = {
      sucursal: 'Argentina',
      detalle: `Orden de pago de regresion automatica ${sello}. No operar.`,
      comentarioDeLaImputacion: `AUTO-QA ${sello.slice(-8)}`,
      reciboDelProveedor: `AUTOQA${sello.slice(-8)}`,
      estadoAprobada: 'Pago',
    };

    const factura = await armarFacturaAprobada(page, sello, ahora, await reservarServicioYGenerarFile(page, sello));
    const caja = cajaDeRegresion(factura.moneda);
    const total = factura.total;
    const totalComoTexto = total.toFixed(2).replace('.', ',');
    let idDeLaOrden = '';
    let codigo = '';

    await paso(page, 'Abrir una orden de pago nueva: nace con la fecha de hoy', async () => {
      await orden.abrirNueva();
      expect(comoFecha(await orden.campo('date').inputValue()), 'La orden tiene que nacer con la fecha de hoy').toBe(fechaDeHoy);
      expect(comoFecha(await orden.campo('due-0').inputValue()), 'La forma de pago tiene que nacer con vencimiento hoy').toBe(fechaDeHoy);
    });

    await paso(page, 'Verificar la sucursal y elegir el proveedor y la moneda', async () => {
      // La pantalla propone la sucursal de trabajo: si ya es Argentina no se toca, como haria una persona.
      if (!(await orden.opcionElegida('branch')).includes(datos.sucursal)) await orden.campo('branch').selectOption({ label: datos.sucursal });
      expect(await orden.opcionElegida('branch'), 'La orden tiene que quedar en la sucursal del file y la factura').toContain(datos.sucursal);
      await orden.elegirProveedor(PROVEEDOR_DE_REGRESION.termino, PROVEEDOR_DE_REGRESION.razonSocial);
      await expect(orden.campo('supplier'), 'La orden tiene que quedar a nombre del proveedor de la factura').toHaveValue(PROVEEDOR_DE_REGRESION.razonSocial);
      // La lista de cajas depende de la moneda: se elige la de la factura.
      await orden.campo('currency').selectOption({ label: factura.moneda });
      expect(await orden.opcionElegida('currency'), 'La orden tiene que ir en la moneda de la factura').toContain(factura.moneda);
    });

    await paso(page, 'Verificar que la caja de regresion se ofrezca y elegirla', async () => {
      const cajas = await orden.opciones('cf-0');
      await adjuntarTexto('Cajas ofrecidas para la moneda de la orden', cajas.join('\n'));
      expect(cajas.join(' | '), `La orden tiene que ofrecer la caja ${caja} para ${factura.moneda}. Si no aparece, revisar que siga publicada y en la sucursal.`)
        .toContain(caja);
      await orden.campo('cf-0').selectOption({ label: caja });
    });

    await paso(page, 'Cargar el importe y verificar el total que calcula la pantalla', async () => {
      await orden.campo('amount-0').fill(totalComoTexto);
      await orden.campo('amount-0').press('Tab');
      await orden.campo('detail').fill(datos.detalle);
      await expect(orden.campo('total'), 'El monto total no se carga a mano').toBeDisabled();
      expect(importeANumero(await orden.campo('total').inputValue()), 'Con una sola forma de pago, el total tiene que ser ese importe').toBe(total);
    });

    await paso(page, 'Guardar la orden y verificar que conserve los datos cargados', async () => {
      idDeLaOrden = await orden.guardar();
      expect(idDeLaOrden, 'Guardar tiene que devolver el id de la orden').toMatch(/^\d+$/);
      codigo = (await orden.campo('code').inputValue()).trim();
      await adjuntarTexto('Orden de pago generada', `${codigo} (id ${idDeLaOrden})`);
      expect(codigo, 'La orden tiene que numerarse con el formato OP y diez digitos').toBe(`OP${idDeLaOrden.padStart(10, '0')}`);
      expect(importeANumero(await orden.campo('total').inputValue()), 'La orden tiene que conservar el importe').toBe(total);
      expect(await orden.opcionElegida('cf-0'), 'La orden tiene que conservar la caja').toContain(caja);
      expect(importeANumero(await orden.campo('amount-0').inputValue()), 'La forma de pago tiene que conservar su importe').toBe(total);
      await expect(orden.campo('detail'), 'La orden tiene que conservar su detalle').toHaveValue(datos.detalle);
      expect(comoFecha(await orden.campo('due-0').inputValue()), 'La forma de pago tiene que conservar su vencimiento').toBe(fechaDeHoy);
      const mes = await orden.opcionElegida('month');
      const nombreDelMes = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(ahora).toUpperCase();
      await adjuntarTexto('Mes de aplicacion de la orden', mes);
      expect(mes.toUpperCase(), 'El mes de aplicacion tiene que ser el de la fecha de la orden').toContain(`${nombreDelMes} ${ahora.getFullYear()}`);
      expect(importeANumero(await orden.campo('rate').inputValue()) as number, 'La cotizacion nunca puede quedar en cero').toBeGreaterThan(0);
    });

    await paso(page, 'Verificar el pendiente de asignacion contra el total de la orden', async () => {
      const pendiente = (await orden.pendienteDeAsignacion().innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Pendiente de asignacion de la orden', pendiente);
      expect(importeANumero(pendiente.split(':')[1] ?? ''), 'Sin nada imputado, el pendiente tiene que ser el total de la orden').toBe(total);
    });

    await paso(page, 'Ubicar la factura entre las pendientes y comparar la fila', async () => {
      const fila = orden.filaPendiente(factura.numeroDeFactura);
      await expect(fila, `La factura ${factura.puntoDeVenta}-${factura.numeroDeFactura} tiene que figurar entre las pendientes de pago del proveedor`)
        .toBeVisible({ timeout: 60_000 });
      const celdas = (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
      await adjuntarTexto('Fila de la factura pendiente de pago', celdas.join(' | '));
      const saldos = celdas.filter((c) => /^[A-Z]{3}\s*-?\d[\d.,]*$/.test(c)).map(importeANumero);
      expect(saldos.at(-1), 'La factura no tiene nada pagado, asi que su saldo tiene que ser el total entero').toBe(total);
      expect(celdas.join(' | '), 'La fila tiene que mostrar el total de la factura, sus retenciones y el importe pagable').toContain('Pagable');
    });

    await paso(page, 'Abrir la asignacion y comparar los importes del dialogo', async () => {
      const dialogo = await orden.abrirAsignacion(orden.filaPendiente(factura.numeroDeFactura));
      const i = await orden.importesDelDialogo(dialogo);
      await adjuntarTexto('Importes del dialogo de asignacion', JSON.stringify(i, null, 2));
      expect(i.moneda, 'El dialogo tiene que mostrar la moneda de la orden').toContain(factura.moneda);
      expect(importeANumero(i.ordenTotal), 'El dialogo tiene que mostrar el total de la orden').toBe(total);
      expect(importeANumero(i.ordenPendiente), 'Sin nada imputado, el pendiente de la orden tiene que ser su total').toBe(total);
      expect(importeANumero(i.facturaPagable), 'El dialogo tiene que mostrar el pagable de la factura').toBe(total);
      expect(importeANumero(i.facturaPendiente), 'La factura no tiene nada pagado, asi que su pendiente tiene que ser su total').toBe(total);

      await orden.asignar(dialogo, totalComoTexto, datos.comentarioDeLaImputacion);
      await expect.poll(async () => importeANumero((await orden.pendienteDeAsignacion().innerText()).split(':')[1] ?? ''),
        { message: 'Imputada la orden entera, no tiene que quedar nada pendiente de asignacion', timeout: 30_000 }).toBe(0);
      await expect(orden.filaPendiente(factura.numeroDeFactura), 'Imputado el total, la factura no tiene que seguir entre las pendientes')
        .toHaveCount(0, { timeout: 60_000 });
      await expect(orden.filaAsignada(factura.numeroDeFactura), 'La factura tiene que pasar a las asignadas').toBeVisible();
    });

    await paso(page, 'Aprobar la orden aplicando el recibo y verificar el estado', async () => {
      await orden.aprobar(fechaDeHoy, datos.reciboDelProveedor);
      await expect(page.getByText(datos.estadoAprobada, { exact: true }), 'Aprobada y con el recibo aplicado, la orden tiene que quedar en estado Pago')
        .toBeVisible({ timeout: 60_000 });
      await expect(orden.campo('receipt'), 'El recibo tiene que conservar su numero, en mayuscula').toHaveValue(datos.reciboDelProveedor.toUpperCase());
      expect(comoFecha(await orden.campo('receipt-date').inputValue()), 'El recibo tiene que conservar su fecha').toBe(fechaDeHoy);
      await adjuntarTexto('Cadena generada', [
        `File: ${factura.fileCode}`, `Factura de proveedor: ${factura.puntoDeVenta}-${factura.numeroDeFactura}`,
        `Orden de pago: ${codigo} (id ${idDeLaOrden})`, `Caja: ${caja}`, `Pagado: ${factura.moneda} ${totalComoTexto}`,
      ].join('\n'));
    });

    await paso(page, 'Verificar la orden en el listado de ordenes de pago', async () => {
      await page.goto('/finance/pay-orders');
      await page.getByPlaceholder('Código, proveedor, referencia u observación').fill(codigo);
      const fila = page.locator('tbody tr').filter({ hasText: codigo }).first();
      await expect(fila, `La orden ${codigo} tiene que aparecer en el listado`).toBeVisible({ timeout: 60_000 });
      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Fila de la orden en el listado', texto);
      expect(texto.toUpperCase(), 'El listado tiene que mostrar el proveedor').toContain(PROVEEDOR_DE_REGRESION.razonSocial.toUpperCase());
      expect(texto, 'El listado tiene que mostrar el detalle de la orden').toContain(datos.detalle.slice(0, 40));
      expect(texto.toUpperCase(), 'Aprobada, la orden tiene que figurar como paga en el listado').toContain(datos.estadoAprobada.toUpperCase());
      const importes = (texto.match(/\d[\d.]*,\d+/g) ?? []).map(importeANumero);
      expect(importes, 'El listado tiene que mostrar el monto de la orden').toContain(total);
    });

    expect(erroresJS, 'La app nueva no tiene que tirar errores de JavaScript durante el flujo').toEqual([]);
  });
});
