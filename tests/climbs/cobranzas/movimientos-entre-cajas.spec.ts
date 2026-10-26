import { test, expect, Page } from '@playwright/test';
import { CajaDiariaNuevaPage } from '../../../pages/climbs/caja-diaria.page';
import { MovimientosNuevaPage, absoluto } from '../../../pages/climbs/movimientos-entre-cajas.page';
import { paso, adjuntarTexto, formatearFecha, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { cajaDeRegresion } from '../comun/precondiciones';

/**
 * CAJA DIARIA — app nueva (ClimbsApp). Movimientos entre cajas.
 *
 * Los mismos dos tests que tests/bloque-c/movimientos-entre-cajas.spec.ts, con los mismos
 * titulos. **Mueve plata entre cajas**: solo usa las cajas AUTO-QA (USD y ARS) y la caja de
 * la otra sucursal configurada en AMV_MOV_*, y deja todo como estaba (el movimiento se borra
 * al final, y en el finally si el test corta). Los cuadres se miden como diferencia contra el
 * estado inicial, porque otros tests dejan ordenes en esas mismas cajas el mismo dia.
 * No cierra la caja del dia.
 */
const CAJA_USD = cajaDeRegresion('USD');
const CAJA_ARS = cajaDeRegresion('ARS');
const SUCURSAL = 'Argentina';
const ALTA = { origen: { texto: '10,00', valor: 10 }, destino: { texto: '15000,00', valor: 15000 } };
const EDICION = { origen: { texto: '11,00', valor: 11 }, destino: { texto: '16500,00', valor: 16500 } };

type Totales = { inicial: number; ingreso: number; salida: number; balance: number; final: number };
const n = (t: string) => Number((t || '0').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
const r2 = (x: number) => Number(x.toFixed(2));

async function medir(caja: CajaDiariaNuevaPage, nombre: string, moneda: string): Promise<Totales> {
  await caja.filtrarPorCaja(nombre);
  const t = await caja.totales(moneda);
  expect(t, `La caja diaria tiene que mostrar los totales de ${nombre} en ${moneda}`).not.toBeNull();
  return { inicial: n(t!.inicial), ingreso: n(t!.ingreso), salida: n(t!.salida), balance: n(t!.balance), final: n(t!.final) };
}

/** Totales despues = antes + efecto. La salida puede venir con o sin signo: se compara su valor absoluto. */
async function cuadre(etiqueta: string, antes: Totales, despues: Totales, efecto: { entra?: number; sale?: number }) {
  const entra = efecto.entra ?? 0;
  const sale = efecto.sale ?? 0;
  await adjuntarTexto(`Cuadre de ${etiqueta}`, `antes: ${JSON.stringify(antes)}\ndespues: ${JSON.stringify(despues)}\nefecto: entra ${entra}, sale ${sale}`);
  expect(r2(despues.ingreso - antes.ingreso), `El ingreso de ${etiqueta} tiene que subir ${entra}`).toBe(r2(entra));
  expect(r2(Math.abs(despues.salida) - Math.abs(antes.salida)), `La salida de ${etiqueta} tiene que crecer ${sale}`).toBe(r2(sale));
  expect(r2(despues.inicial), 'El saldo inicial no tiene que moverse: la caja sigue abierta').toBe(r2(antes.inicial));
  expect(r2(despues.inicial + despues.balance), 'El saldo final tiene que ser el inicial mas el balance').toBe(r2(despues.final));
}

/** Limpieza de ultima instancia: si el test corto con el movimiento creado, lo borra desde la caja de origen. */
async function limpiar(page: Page, caja: CajaDiariaNuevaPage, mov: MovimientosNuevaPage, comentario: string, fecha: string, detalle: string) {
  try {
    await caja.abrirCajaDelDia(fecha, SUCURSAL, detalle);
    const fila = mov.filaEnLaCaja(comentario, CAJA_USD);
    if (await fila.count()) {
      await mov.borrar(fila);
      await adjuntarTexto('Limpieza', `Movimiento "${comentario}" borrado en el finally`);
    }
  } catch (error) {
    await adjuntarTexto('LIMPIEZA PENDIENTE', `No se pudo borrar el movimiento "${comentario}": ${(error as Error).message}. Borrarlo a mano desde la caja del dia de ${SUCURSAL}.`);
  }
}

test.describe('Movimientos entre cajas', () => {
  // Cada test borra su movimiento en el finally: reintentar no duplica datos.
  test.describe.configure({ retries: process.env.CI ? 2 : 0 });
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Movimiento entre dos cajas de la misma sucursal: sale de una, entra en la otra y cuadra', async ({ page }) => {
    test.setTimeout(900_000);
    const caja = new CajaDiariaNuevaPage(page);
    const mov = new MovimientosNuevaPage(page);
    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);
    const detalle = `Caja de regresion automatica ${sello}. No operar.`;
    const comentario = `AUTO-QA ${sello}`;
    let creado = false;
    let borrado = false;
    let antesUSD!: Totales;
    let antesARS!: Totales;

    try {
      await paso(page, 'Abrir la caja del dia y medir las dos cajas AUTO-QA antes de mover nada', async () => {
        const { id, creada } = await caja.abrirCajaDelDia(fechaDeHoy, SUCURSAL, detalle);
        await adjuntarTexto('Caja del dia', `id ${id} — ${creada ? 'abierta por el test' : 'ya existia'} — ${fechaDeHoy}`);
        antesUSD = await medir(caja, CAJA_USD, 'USD');
        antesARS = await medir(caja, CAJA_ARS, 'ARS');
        await caja.quitarFiltroDeCaja();
      });

      await paso(page, 'Validaciones del formulario: sin monto y con el mismo origen y destino no se guarda nada', async () => {
        await mov.abrirNuevo();
        await mov.origen({ moneda: 'USD', caja: CAJA_USD });
        await mov.comentario(comentario);
        await mov.destino({ moneda: 'USD', caja: CAJA_USD });
        await mov.guardarSinEsperar();
        // En la app nueva (26/10/2026) el servidor rechaza el pedido sin montos con un 400 generico
        // y la pantalla muestra solo "Bad Request": no se guarda, pero el aviso no dice que falta.
        // Diferencia con el BO actual: se marca sin cortar.
        const aviso = page.getByText(/Debe completar Monto & Cotizaci.n|Bad Request/).first();
        await expect(aviso, 'Sin monto el guardado tiene que rechazarse con un aviso').toBeVisible({ timeout: 30_000 });
        const textoDelAviso = (await aviso.innerText()).trim();
        await adjuntarTexto('Aviso sin monto', textoDelAviso);
        expect.soft(textoDelAviso, 'Sin monto el aviso tiene que decir que falta Monto & Cotizacion').toMatch(/Debe completar Monto & Cotizaci.n/);
        await mov.campo('amount').fill(ALTA.origen.texto);
        await mov.campo('damount').fill(ALTA.origen.texto);
        await mov.asegurarCotizacion();
        await mov.guardarSinEsperar();
        await expect(page.getByText('Origen & Destino no pueden ser los mismos').first(), 'Con la misma caja de origen y destino tiene que rechazar el movimiento').toBeVisible({ timeout: 30_000 });
        await expect(mov.formulario, 'Un rechazo no tiene que cerrar el formulario').toBeVisible();
        await expect(mov.filas(comentario), 'Un rechazo no tiene que dejar filas en la caja').toHaveCount(0);
      });

      await paso(page, 'Guardar el movimiento de USD a ARS entre las dos cajas AUTO-QA', async () => {
        await mov.destino({ moneda: 'ARS', caja: CAJA_ARS, monto: ALTA.destino.texto });
        await mov.campo('amount').fill(ALTA.origen.texto);
        await adjuntarTexto('Cotizacion', await mov.asegurarCotizacion());
        await mov.guardar();
        creado = true;
      });

      await paso(page, 'Verificar las dos filas del movimiento y lo que permite cada una', async () => {
        await page.reload();
        const filas = mov.filas(comentario);
        await expect(filas, 'Un movimiento entre cajas de la misma sucursal tiene que verse como dos filas').toHaveCount(2, { timeout: 30_000 });
        await adjuntarTexto('Filas del movimiento', (await filas.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join('\n'));
        const origen = mov.filaEnLaCaja(comentario, CAJA_USD);
        const destino = mov.filaEnLaCaja(comentario, CAJA_ARS);
        await expect(origen, `La salida tiene que estar en ${CAJA_USD}`).toBeVisible();
        await expect(destino, `La entrada tiene que estar en ${CAJA_ARS}`).toBeVisible();
        expect(await mov.celda(destino, 'Código'), 'Las dos filas tienen que llevar el mismo codigo').toBe(await mov.celda(origen, 'Código'));
        expect((await mov.celda(origen, 'T')).toUpperCase(), 'El tipo tiene que ser Movimiento ("M")').toBe('M');
        expect(await mov.celda(origen, 'Moneda'), 'La salida tiene que estar en USD').toContain('USD');
        expect(absoluto(await mov.celda(origen, 'Monto')), 'El monto de la salida tiene que ser el de origen').toBe(ALTA.origen.valor);
        expect(n(await mov.celda(origen, 'Cotización')), 'La cotizacion tiene que ser mayor que cero').toBeGreaterThan(0);
        expect(await mov.celda(origen, 'Fecha'), 'La fecha tiene que ser la de hoy').toContain(fechaDeHoy);
        expect((await mov.celda(destino, 'T')).toUpperCase(), 'El tipo de la entrada tiene que ser Movimiento ("M")').toBe('M');
        expect(await mov.celda(destino, 'Moneda'), 'La entrada tiene que estar en ARS').toContain('ARS');
        expect(absoluto(await mov.celda(destino, 'Monto')), 'El monto de la entrada tiene que ser el de destino').toBe(ALTA.destino.valor);
        const aO = await mov.acciones(origen);
        const aD = await mov.acciones(destino);
        await adjuntarTexto('Acciones por fila', `origen: ${JSON.stringify(aO)}\ndestino: ${JSON.stringify(aD)}`);
        expect(aO, 'La salida se puede copiar, editar y borrar').toMatchObject({ copiar: true, editar: true, borrar: true });
        expect(aD, 'La entrada no se edita ni se borra: se modifica desde el origen').toMatchObject({ copiar: false, editar: false, borrar: false });
      });

      await paso(page, 'Verificar el cuadre: la salida baja la caja USD y la entrada sube la caja ARS', async () => {
        await cuadre(CAJA_USD, antesUSD, await medir(caja, CAJA_USD, 'USD'), { sale: ALTA.origen.valor });
        await cuadre(CAJA_ARS, antesARS, await medir(caja, CAJA_ARS, 'ARS'), { entra: ALTA.destino.valor });
        await caja.quitarFiltroDeCaja();
      });

      await paso(page, 'Copiar: el movimiento de la misma sucursal se puede copiar y muestra origen y destino', async () => {
        await mov.abrirCopiar();
        const fila = mov.filaDeCopiar(comentario);
        await expect(fila, 'Copiar tiene que listar el movimiento de hoy').toBeVisible({ timeout: 30_000 });
        const texto = (await fila.innerText()).replace(/\s+/g, ' ').toUpperCase();
        await adjuntarTexto('Fila de Copiar', texto);
        await expect(fila.getByRole('checkbox'), 'Un movimiento dentro de la misma sucursal tiene que poder copiarse').toHaveCount(1);
        expect(texto, 'El Medio tiene que mostrar la caja de origen').toContain(CAJA_USD.toUpperCase());
        expect(texto, 'El Medio tiene que mostrar la caja de destino').toContain(CAJA_ARS.toUpperCase());
        // Solo se mira: copiar crearia otro movimiento.
        await mov.cerrarCopiar();
      });

      await paso(page, 'Editar el origen: el formulario trae los dos lados y al guardar se actualizan los dos', async () => {
        await mov.editar(mov.filaEnLaCaja(comentario, CAJA_USD));
        expect(await mov.elegido('cashflow'), 'El Medio de origen tiene que ser el guardado').toBe(CAJA_USD);
        expect(await mov.elegido('dcashflow'), 'El Medio de destino tiene que ser el guardado').toBe(CAJA_ARS);
        expect(n(await mov.campo('amount').inputValue()), 'Monto de origen').toBe(ALTA.origen.valor);
        expect(n(await mov.campo('damount').inputValue()), 'Monto de destino').toBe(ALTA.destino.valor);
        await expect(mov.campo('type'), 'El tipo no se cambia al editar').toBeDisabled();
        await mov.campo('amount').fill(EDICION.origen.texto);
        await mov.campo('damount').fill(EDICION.destino.texto);
        await mov.guardar();
        await page.reload();
        await expect(mov.filas(comentario), 'Editar no tiene que duplicar el movimiento').toHaveCount(2, { timeout: 30_000 });
        expect(absoluto(await mov.celda(mov.filaEnLaCaja(comentario, CAJA_USD), 'Monto')), 'La salida tiene que mostrar el monto nuevo').toBe(EDICION.origen.valor);
        expect(absoluto(await mov.celda(mov.filaEnLaCaja(comentario, CAJA_ARS), 'Monto')), 'La entrada tiene que mostrar el monto nuevo').toBe(EDICION.destino.valor);
        await cuadre(`${CAJA_USD} tras editar`, antesUSD, await medir(caja, CAJA_USD, 'USD'), { sale: EDICION.origen.valor });
        await cuadre(`${CAJA_ARS} tras editar`, antesARS, await medir(caja, CAJA_ARS, 'ARS'), { entra: EDICION.destino.valor });
        await caja.quitarFiltroDeCaja();
      });

      await paso(page, 'Borrar el movimiento desde el origen: desaparecen las dos filas y las cajas vuelven a su cuadre', async () => {
        await mov.borrar(mov.filaEnLaCaja(comentario, CAJA_USD));
        borrado = true;
        await page.reload();
        await expect(mov.filas(comentario), 'Borrar el origen tiene que borrar tambien la entrada').toHaveCount(0, { timeout: 30_000 });
        await cuadre(`${CAJA_USD} tras borrar`, antesUSD, await medir(caja, CAJA_USD, 'USD'), {});
        await cuadre(`${CAJA_ARS} tras borrar`, antesARS, await medir(caja, CAJA_ARS, 'ARS'), {});
      });
    } finally {
      if (creado && !borrado) await limpiar(page, caja, mov, comentario, fechaDeHoy, detalle);
    }
  });

  test('Movimiento entre sucursales: la entrada vive en la caja destino, se ve en solo lectura y no se copia', async ({ page }) => {
    test.setTimeout(900_000);
    const sucursalDestino = process.env.AMV_MOV_SUCURSAL_DESTINO ?? '';
    const cajaDestino = process.env.AMV_MOV_CAJA_DESTINO ?? '';
    const monedaDestino = process.env.AMV_MOV_MONEDA_DESTINO ?? '';
    test.skip(!sucursalDestino || !cajaDestino || !monedaDestino,
      'Faltan AMV_MOV_SUCURSAL_DESTINO, AMV_MOV_CAJA_DESTINO y AMV_MOV_MONEDA_DESTINO: sin una caja de otra sucursal no hay movimiento entre sucursales que probar.');
    const caja = new CajaDiariaNuevaPage(page);
    const mov = new MovimientosNuevaPage(page);
    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);
    const detalle = `Caja de regresion automatica ${sello}. No operar.`;
    const comentario = `AUTO-QA ${sello}`;
    const MONTO = { origen: { texto: '10,00', valor: 10 }, destino: { texto: '10,00', valor: 10 } };
    let creado = false;
    let borrado = false;
    let antesOrigen!: Totales;
    let antesDestino!: Totales;
    let cajaDestinoVacia = false;

    try {
      await paso(page, 'Abrir la caja del dia de la sucursal destino y medir su caja', async () => {
        const { id, creada } = await caja.abrirCajaDelDia(fechaDeHoy, sucursalDestino, detalle);
        await adjuntarTexto('Caja del dia destino', `id ${id} — ${creada ? 'abierta por el test' : 'ya existia'} — ${sucursalDestino}`);
        cajaDestinoVacia = await page.getByText('La caja no tiene movimientos.').isVisible().catch(() => false);
        antesDestino = await medir(caja, cajaDestino, monedaDestino);
      });

      await paso(page, 'Abrir la caja del dia de Argentina y medir la caja de origen', async () => {
        await caja.abrirCajaDelDia(fechaDeHoy, SUCURSAL, detalle);
        antesOrigen = await medir(caja, CAJA_USD, 'USD');
        await caja.quitarFiltroDeCaja();
      });

      await paso(page, 'Guardar un movimiento de la caja USD de Argentina a la caja de la otra sucursal', async () => {
        await mov.abrirNuevo();
        await mov.origen({ moneda: 'USD', caja: CAJA_USD, monto: MONTO.origen.texto });
        await mov.destino({ sucursal: sucursalDestino, moneda: monedaDestino, caja: cajaDestino, monto: MONTO.destino.texto });
        await mov.comentario(comentario);
        await adjuntarTexto('Cotizacion', await mov.asegurarCotizacion());
        await mov.guardar();
        creado = true;
      });

      await paso(page, 'En la caja de Argentina solo queda la salida, con su cuadre y sin poder copiarse', async () => {
        await page.reload();
        const filas = mov.filas(comentario);
        await expect(filas, 'En la caja de origen tiene que verse solo la salida: la entrada vive en la otra sucursal').toHaveCount(1, { timeout: 30_000 });
        const origen = mov.filaEnLaCaja(comentario, CAJA_USD);
        await expect(origen, `La salida tiene que estar en ${CAJA_USD}`).toBeVisible();
        await adjuntarTexto('Salida (origen)', (await origen.innerText()).replace(/\s+/g, ' '));
        expect(absoluto(await mov.celda(origen, 'Monto')), 'El monto de la salida tiene que ser el de origen').toBe(MONTO.origen.valor);
        expect(await mov.acciones(origen), 'La salida se puede editar y borrar').toMatchObject({ editar: true, borrar: true });
        await cuadre(CAJA_USD, antesOrigen, await medir(caja, CAJA_USD, 'USD'), { sale: MONTO.origen.valor });
        await caja.quitarFiltroDeCaja();

        await mov.abrirCopiar();
        const fila = mov.filaDeCopiar(comentario);
        await expect(fila, 'Copiar tiene que listar el movimiento, aunque no se pueda copiar').toBeVisible({ timeout: 30_000 });
        const texto = (await fila.innerText()).replace(/\s+/g, ' ');
        await adjuntarTexto('Fila de Copiar', texto);
        await expect(fila.getByRole('checkbox'), 'Un movimiento entre sucursales no tiene que poder copiarse').toHaveCount(0);
        await expect(fila.locator('[title="Movimiento entre sucursales: no se puede copiar."]'), 'Tiene que mostrar el aviso de que no se puede copiar').toHaveCount(1);
        expect(texto.toUpperCase(), 'El Medio tiene que mostrar la caja de destino').toContain(cajaDestino.toUpperCase());
        await mov.cerrarCopiar();
      });

      await paso(page, 'En la caja de la otra sucursal aparece la entrada: sin editar ni borrar, en solo lectura, y sube su caja', async () => {
        await caja.abrirCajaDelDia(fechaDeHoy, sucursalDestino, detalle);
        const filas = mov.filas(comentario);
        await expect(filas, 'La caja destino tiene que mostrar la entrada').toHaveCount(1, { timeout: 30_000 });
        const entrada = filas.first();
        await adjuntarTexto('Entrada (destino)', (await entrada.innerText()).replace(/\s+/g, ' '));
        expect((await mov.celda(entrada, 'Moneda')).toUpperCase(), `La entrada tiene que estar en ${monedaDestino}`).toContain(monedaDestino.toUpperCase());
        expect(absoluto(await mov.celda(entrada, 'Monto')), 'El monto de la entrada tiene que ser el de destino').toBe(MONTO.destino.valor);
        expect((await mov.celda(entrada, 'Medio')).toUpperCase(), 'La entrada tiene que caer en la caja destino').toContain(cajaDestino.toUpperCase());
        expect(await mov.acciones(entrada), 'La entrada de otra sucursal solo se mira: ni se edita, ni se borra, ni se copia')
          .toMatchObject({ copiar: false, editar: false, borrar: false });
        await cuadre(cajaDestino, antesDestino, await medir(caja, cajaDestino, monedaDestino), { entra: MONTO.destino.valor });
        await caja.quitarFiltroDeCaja();

        // Se abre en solo lectura con el movimiento de origen.
        await mov.filas(comentario).first().locator('td[data-label="Comentario"]').click();
        await expect(mov.formulario, 'La entrada tiene que abrirse en solo lectura').toBeVisible();
        await expect(mov.formulario.getByText('Es la entrada de un movimiento de otra caja'), 'Tiene que avisar que se modifica desde la caja de origen').toBeVisible();
        await expect(mov.formulario.getByRole('button', { name: 'Guardar', exact: true }), 'En solo lectura no tiene que haber Guardar').toHaveCount(0);
        await expect(mov.campo('amount'), 'Los campos tienen que estar deshabilitados').toBeDisabled();
        expect(await mov.elegido('cashflow'), 'Tiene que mostrar el Medio del origen').toBe(CAJA_USD);
        expect(await mov.elegido('dcashflow'), 'Tiene que mostrar el Medio del destino').toBe(cajaDestino);
        await mov.cerrarFormulario();
      });

      await paso(page, 'La caja destino no se puede eliminar mientras tenga la entrada', async () => {
        // Solo si estaba vacia antes del test: si el bloqueo fallara, la baja se llevaria sus movimientos.
        if (!cajaDestinoVacia) {
          await adjuntarTexto('OMITIDO', 'La caja destino ya tenia movimientos antes del test: no se intenta la baja.');
          return;
        }
        await caja.irAlListado();
        await caja.elegirSucursal(sucursalDestino);
        const fila = caja.filaDeLaFecha(fechaDeHoy).first();
        const borrar = fila.getByRole('button', { name: 'Borrar', exact: true });
        if (await borrar.count()) {
          await borrar.click();
          const pregunta = page.getByRole('alertdialog').filter({ hasText: '¿Está seguro?' });
          await pregunta.getByRole('button', { name: 'Sí, eliminar', exact: true }).click();
          await page.waitForLoadState('networkidle');
          await adjuntarTexto('Intento de baja', 'El listado ofrecia Borrar: se intento');
        } else {
          await adjuntarTexto('Intento de baja', 'El listado no ofrece Borrar para la caja con la entrada');
        }
        // Al recargar el listado vuelve a la sucursal de trabajo: se vuelve a elegir la destino.
        await page.reload();
        await caja.elegirSucursal(sucursalDestino);
        await expect(caja.filaDeLaFecha(fechaDeHoy), 'La caja destino tiene que seguir en el listado').toBeVisible({ timeout: 30_000 });
      });

      await paso(page, 'Borrar el movimiento desde Argentina: la entrada desaparece de la otra sucursal y las dos cajas vuelven al cuadre', async () => {
        await caja.abrirCajaDelDia(fechaDeHoy, SUCURSAL, detalle);
        await mov.borrar(mov.filaEnLaCaja(comentario, CAJA_USD));
        borrado = true;
        await page.reload();
        await expect(mov.filas(comentario), 'La salida tiene que desaparecer').toHaveCount(0, { timeout: 30_000 });
        await cuadre(`${CAJA_USD} tras borrar`, antesOrigen, await medir(caja, CAJA_USD, 'USD'), {});
        await caja.abrirCajaDelDia(fechaDeHoy, sucursalDestino, detalle);
        await expect(mov.filas(comentario), 'Borrar el origen tiene que borrar tambien la entrada de la otra sucursal').toHaveCount(0, { timeout: 30_000 });
        await cuadre(`${cajaDestino} tras borrar`, antesDestino, await medir(caja, cajaDestino, monedaDestino), {});
      });
    } finally {
      if (creado && !borrado) await limpiar(page, caja, mov, comentario, fechaDeHoy, detalle);
    }
  });
});
