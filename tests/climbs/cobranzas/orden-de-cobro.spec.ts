import { test, expect } from '@playwright/test';
import { OrdenDeCobroNuevaPage } from '../../../pages/climbs/orden-de-cobro.page';
import { paso, adjuntarTexto, formatearFecha, reiniciarNumeracionDePasos, importeANumero, numeroDelFile } from '../../../utils/pasos';
import { reservarServicioYGenerarFile, armarFacturaAlCliente, cajaDeRegresion } from '../comun/precondiciones';

/**
 * COBRANZAS — app nueva (ClimbsApp).
 *
 * El mismo flujo que tests/bloque-c/orden-de-cobro.spec.ts, con el mismo titulo: la carta
 * de cobranza emitida al cliente se cobra con una orden en la caja AUTO-QA de su moneda,
 * se imputa y se aprueba aplicando el recibo. Todo por pantalla.
 */
const comoFecha = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s.trim());
const soloDigitos = (s: string) => s.replace(/\D/g, '');

test.describe('Cobranzas', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Orden de cobro: cobra el comprobante del cliente en la caja de regresion', async ({ page }) => {
    test.setTimeout(900_000);
    const erroresJS: string[] = [];
    page.on('pageerror', (e) => erroresJS.push(e.message));
    const orden = new OrdenDeCobroNuevaPage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);
    const datos = {
      detalle: `Orden de cobro de regresion automatica ${sello}. No operar.`,
      comentarioDeLaImputacion: `AUTO-QA ${sello.slice(-8)}`,
      referenciaDelRecibo: `AUTOQA${sello.slice(-8)}`,
      estadoAprobada: 'Pago',
    };

    const carta = await armarFacturaAlCliente(page, sello, await reservarServicioYGenerarFile(page, sello));
    const caja = cajaDeRegresion(carta.moneda);
    const total = carta.total;
    const totalComoTexto = total.toFixed(2).replace('.', ',');
    // La grilla muestra el file a su manera: se lo ubica por su numero.
    const numeroDeFile = numeroDelFile(carta.fileCode);
    let idDeLaOrden = '';
    let codigo = '';

    await paso(page, 'Abrir una orden de cobro nueva: nace con la fecha de hoy', async () => {
      await orden.abrirNueva();
      expect(comoFecha(await orden.campo('date').inputValue()), 'La orden tiene que nacer con la fecha de hoy').toBe(fechaDeHoy);
    });

    await paso(page, 'Elegir el cliente y la moneda del cobro', async () => {
      const filaDelBuscador = await orden.elegirCliente(carta.cliente, carta.cliente);
      await adjuntarTexto('Cliente elegido en el buscador', filaDelBuscador);
      const documento = (await orden.campo('doc').inputValue()).trim();
      expect(soloDigitos(filaDelBuscador), 'El documento cargado tiene que ser el que mostraba el buscador de clientes').toContain(soloDigitos(documento));
      expect((await orden.campo('customer').inputValue()).toUpperCase(), 'La orden tiene que quedar a nombre del cliente al que se le facturo')
        .toContain(carta.cliente.toUpperCase());
      await orden.campo('currency').selectOption({ label: carta.moneda });
      expect(await orden.opcionElegida('currency'), 'La orden tiene que ir en la moneda del comprobante').toContain(carta.moneda);
    });

    await paso(page, 'Verificar que la caja de regresion se ofrezca y elegirla', async () => {
      const cajas = await orden.opciones('cf-0');
      await adjuntarTexto('Cajas ofrecidas para la moneda de la orden', cajas.join('\n'));
      expect(cajas.join(' | '), `La orden tiene que ofrecer la caja ${caja} para ${carta.moneda}. Si no aparece, revisar que siga publicada.`).toContain(caja);
      await orden.campo('cf-0').selectOption({ label: caja });
    });

    await paso(page, 'Cargar el importe y verificar el total que calcula la pantalla', async () => {
      await orden.campo('amount-0').fill(totalComoTexto);
      await orden.campo('amount-0').press('Tab');
      await orden.campo('detail').fill(datos.detalle);
      await expect(orden.campo('total'), 'El monto total no se carga a mano').toBeDisabled();
      expect(importeANumero(await orden.campo('total').inputValue()), 'Con un solo medio de cobro, el total tiene que ser ese importe').toBe(total);
    });

    await paso(page, 'Guardar la orden y verificar que conserve los datos cargados', async () => {
      idDeLaOrden = await orden.guardar();
      expect(idDeLaOrden, 'Guardar tiene que devolver el id de la orden').toMatch(/^\d+$/);
      codigo = (await orden.campo('code').inputValue()).trim();
      await adjuntarTexto('Orden de cobro generada', `${codigo} (id ${idDeLaOrden})`);
      expect(codigo, 'La orden tiene que numerarse con el formato OC y diez digitos').toBe(`OC${idDeLaOrden.padStart(10, '0')}`);
      expect(await orden.opcionElegida('cf-0'), 'La orden tiene que conservar la caja').toContain(caja);
      expect(importeANumero(await orden.campo('amount-0').inputValue()), 'El medio de cobro tiene que conservar su importe').toBe(total);
      await expect(orden.campo('detail'), 'La orden tiene que conservar su detalle').toHaveValue(datos.detalle);
      expect(comoFecha(await orden.campo('due-0').inputValue()), 'El medio de cobro tiene que conservar su vencimiento').toBe(fechaDeHoy);
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

    await paso(page, 'Ubicar el comprobante entre los pendientes y comparar la fila', async () => {
      const fila = orden.filaPendiente(numeroDeFile);
      await expect(fila, `El comprobante del file ${carta.fileCode} tiene que figurar entre los pendientes de cobro de ${carta.cliente}`)
        .toBeVisible({ timeout: 60_000 });
      await adjuntarTexto('Fila del comprobante pendiente de cobro', (await fila.locator('td').allInnerTexts()).map((c) => c.trim()).join(' | '));
      const totalUSD = importeANumero(await orden.valorDeColumna(fila, 'Total USD'));
      const saldoUSD = importeANumero(await orden.valorDeColumna(fila, 'Saldo USD'));
      expect(totalUSD, 'La grilla tiene que mostrar el total del comprobante emitido').toBe(total);
      expect(saldoUSD, 'El comprobante no tiene nada cobrado, asi que su saldo tiene que ser el total entero').toBe(total);
    });

    await paso(page, 'Abrir la asignacion y comparar los importes del dialogo', async () => {
      const dialogo = await orden.abrirAsignacion(orden.filaPendiente(numeroDeFile));
      const i = await orden.importesDelDialogo(dialogo);
      await adjuntarTexto('Importes del dialogo de asignacion', JSON.stringify(i, null, 2));
      expect(i.moneda, 'El dialogo tiene que mostrar la moneda de la orden').toContain(carta.moneda);
      expect(importeANumero(i.ordenTotal), 'El dialogo tiene que mostrar el total de la orden').toBe(total);
      expect(importeANumero(i.ordenPendiente), 'Sin nada imputado, el pendiente de la orden tiene que ser su total').toBe(total);
      expect(importeANumero(i.comprobanteTotal), 'El dialogo tiene que mostrar el total del comprobante emitido al cliente').toBe(total);
      expect(importeANumero(i.comprobantePendiente), 'El comprobante no tiene nada cobrado, asi que su pendiente tiene que ser su total').toBe(total);

      await orden.asignar(dialogo, totalComoTexto, datos.comentarioDeLaImputacion);
      await expect.poll(async () => importeANumero((await orden.pendienteDeAsignacion().innerText()).split(':')[1] ?? ''),
        { message: 'Imputada la orden entera, no tiene que quedar nada pendiente de asignacion', timeout: 30_000 }).toBe(0);
      await expect(orden.filaAsignada(numeroDeFile), 'El comprobante tiene que pasar a las asignadas').toBeVisible({ timeout: 60_000 });
    });

    await paso(page, 'Aprobar la orden aplicando el recibo y verificar el estado', async () => {
      await orden.aprobar(fechaDeHoy, datos.referenciaDelRecibo);
      await expect(page.getByText(datos.estadoAprobada, { exact: true }), 'Aprobada y con el recibo aplicado, la orden tiene que quedar en estado Pago')
        .toBeVisible({ timeout: 60_000 });
      await expect(orden.campo('receipt'), 'El recibo tiene que conservar su referencia').toHaveValue(datos.referenciaDelRecibo);
      expect(comoFecha(await orden.campo('receipt-date').inputValue()), 'El recibo tiene que conservar su fecha').toBe(fechaDeHoy);
      await expect(orden.filaPendiente(numeroDeFile), 'Cobrado y aprobado, el comprobante no tiene que seguir entre los pendientes')
        .toHaveCount(0, { timeout: 60_000 });
      await adjuntarTexto('Cadena generada', [
        `File: ${carta.fileCode}`, `Cliente: ${carta.cliente}`, `Comprobante: ${carta.comprobante}`,
        `Orden de cobro: ${codigo} (id ${idDeLaOrden})`, `Caja: ${caja}`, `Cobrado: ${carta.moneda} ${totalComoTexto}`,
      ].join('\n'));
    });

    await paso(page, 'Verificar la orden en el listado de ordenes de cobro', async () => {
      await page.goto('/finance/charge-orders');
      await page.getByPlaceholder('Código, cliente, file, referencia u observación').fill(codigo);
      const fila = page.locator('tbody tr').filter({ hasText: codigo }).first();
      await expect(fila, `La orden ${codigo} tiene que aparecer en el listado`).toBeVisible({ timeout: 60_000 });
      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Fila de la orden en el listado', texto);
      expect(texto.toUpperCase(), 'El listado tiene que mostrar el cliente').toContain(carta.cliente.toUpperCase());
      expect(texto, 'El listado tiene que mostrar el detalle de la orden').toContain(datos.detalle.slice(0, 40));
      expect(texto.toUpperCase(), 'Aprobada, la orden tiene que figurar como paga en el listado').toContain(datos.estadoAprobada.toUpperCase());
      expect(texto, `El listado tiene que mostrar el file del comprobante cobrado (${carta.fileCode})`).toContain(numeroDeFile);
      const importes = (texto.match(/\d[\d.]*,\d+/g) ?? []).map(importeANumero);
      expect(importes, 'El listado tiene que mostrar el monto de la orden').toContain(total);
    });

    expect(erroresJS, 'La app nueva no tiene que tirar errores de JavaScript durante el flujo').toEqual([]);
  });
});
