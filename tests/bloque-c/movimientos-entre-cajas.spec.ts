import { test, expect, Page } from '@playwright/test';
import { BackOfficePage } from '../../pages/backoffice.page';
import { CajaDiariaPage } from '../../pages/caja-diaria.page';
import { MovimientosEntreCajasPage } from '../../pages/movimientos-entre-cajas.page';
import {
  paso, adjuntarTexto, formatearFecha, reiniciarNumeracionDePasos, conResaltado,
} from '../../utils/pasos';
import { SALTO, cajaDeRegresion, importe } from './cobranzas-comun';

/**
 * BLOQUE C — Movimientos entre cajas (caja diaria del BO).
 *
 * BORRADOR, sin ejecutar contra QA. Cubre lo que cambio el commit `a34bbc76` (4877
 * "Fix movimientos entre cajas - caja diaria") sobre `DailyCashControl.ascx(.cs)`,
 * `DailyCash.aspx(.cs)`, `DailyExpenses.aspx.cs`, `MovementWebService.cs` y
 * `movements.js`:
 *
 *   - un movimiento son dos filas con el mismo codigo, que se guardan juntas (transaccion)
 *     y se validan como par (`IsMovementPairValid`);
 *   - la entrada (`IsDestination`) no se edita ni se borra: se modifica desde el origen;
 *   - editar el origen encuentra el destino por codigo;
 *   - borrar el origen borra las dos filas;
 *   - si el destino es de otra sucursal: la entrada vive en la caja de esa sucursal, se
 *     ve con un ojo (modal de solo lectura), no se puede copiar, y la caja destino no
 *     se puede eliminar mientras tenga la entrada.
 *
 * **Mueve plata entre cajas**: por eso el test usa SOLO las cajas AUTO-QA propias (187
 * USD y 188 ARS, categoria 18) y deja todo como estaba: el movimiento se borra al final
 * (y en un `finally` si el test corta en el medio). Los cuadres se miden como DELTA contra
 * el estado inicial, no contra un valor fijo, porque otros tests del Bloque C dejan
 * ordenes de pago y de cobro en esas mismas cajas el mismo dia.
 *
 * **No cierra la caja del dia** (ver `caja-diaria.spec.ts`: cerrarla bloquea las ordenes
 * del resto del dia y no se puede reabrir).
 *
 * Lo que se afirma sale del CODIGO de origin/qa (que fila lleva cada boton, que signo tiene
 * cada importe, que mensajes devuelve el modal), no de una US: son los puntos a confirmar
 * con el PM si un rojo no resulta evidente.
 *
 * Variables de entorno del segundo test (movimiento entre sucursales). Si falta alguna, se saltea:
 *   AMV_MOV_SUCURSAL_DESTINO  nombre de la sucursal destino, tal como lo ofrece el combo
 *                             (el usuario de BO_USER tiene que tenerla asignada)
 *   AMV_MOV_CAJA_DESTINO      nombre de una caja publicada de esa sucursal
 *   AMV_MOV_MONEDA_DESTINO    moneda de esa caja (codigo, p. ej. USD o COP)
 * Hace falta una caja AUTO-QA en la sucursal destino para no tocar saldos reales: ver la nota
 * al final del archivo.
 *
 * El BO tiene modo oscuro pero no selector de idioma: no se prueba multiidioma. El modo
 * oscuro del modal no cambio en este commit y no se cubre aca.
 */

const CAJA_USD = cajaDeRegresion('USD');
const CAJA_ARS = cajaDeRegresion('ARS');
const SUCURSAL = 'Argentina';

// Importes del alta y de la edicion. Se escriben con coma decimal, que es lo que espera el BO.
const ALTA = { origen: { texto: '10,00', valor: 10 }, destino: { texto: '15000,00', valor: 15000 } };
const EDICION = { origen: { texto: '11,00', valor: 11 }, destino: { texto: '16500,00', valor: 16500 } };

/** Totales de una caja tal como los muestra la caja diaria, ya como numeros. */
type Totales = { inicial: number; ingreso: number; salida: number; balance: number; final: number };

/** Filtra por la caja y lee su fila de totales. */
async function medir(
  mov: MovimientosEntreCajasPage, caja: CajaDiariaPage, nombreDeLaCaja: string, moneda: string,
): Promise<Totales> {
  await mov.filtrarPorCaja(nombreDeLaCaja);
  const t = await caja.totales(moneda);
  expect(t, `La caja diaria tiene que mostrar los totales de ${nombreDeLaCaja} en ${moneda}`).not.toBeNull();
  const n = (x: string) => importe(x).valor ?? Number.NaN;
  return { inicial: n(t!.inicial), ingreso: n(t!.ingreso), salida: n(t!.salida), balance: n(t!.balance), final: n(t!.final) };
}

const redondeo = (x: number) => Number(x.toFixed(2));

/**
 * Compara los totales de una caja contra los de antes mas el efecto esperado del movimiento.
 * `entra` es lo que debe sumarse al ingreso; `sale`, lo que debe restarse a la salida (que
 * viene con signo negativo). El saldo inicial no se mueve: la caja sigue abierta.
 */
async function verificarCuadre(
  page: Page, etiqueta: string, antes: Totales, despues: Totales, efecto: { entra?: number; sale?: number },
) {
  const entra = efecto.entra ?? 0;
  const sale = efecto.sale ?? 0;
  const grilla = page.locator('#tblDailyCashTotals').first();
  await adjuntarTexto(`Cuadre de ${etiqueta}`, [
    `antes:   ${JSON.stringify(antes)}`,
    `despues: ${JSON.stringify(despues)}`,
    `efecto esperado: entra ${entra}, sale ${sale}`,
  ].join(SALTO));

  await conResaltado(page, grilla, `Ingreso de ${etiqueta}`, () => {
    expect(redondeo(despues.ingreso - antes.ingreso), `El ingreso de ${etiqueta} tiene que subir ${entra}`).toBe(redondeo(entra));
  });
  await conResaltado(page, grilla, `Salida de ${etiqueta}`, () => {
    expect(redondeo(despues.salida - antes.salida), `La salida de ${etiqueta} tiene que bajar ${sale} (viene con signo negativo)`).toBe(redondeo(-sale));
  });
  await conResaltado(page, grilla, `Saldo inicial de ${etiqueta}`, () => {
    expect(redondeo(despues.inicial), 'El saldo inicial no tiene que moverse: la caja sigue abierta').toBe(redondeo(antes.inicial));
  });
  await conResaltado(page, grilla, `Saldo final de ${etiqueta}`, () => {
    expect(redondeo(despues.inicial + despues.balance), 'El saldo final tiene que ser el inicial mas el balance').toBe(redondeo(despues.final));
  });
}

/** Lee un importe de una celda de la grilla; el signo no importa en la grilla, lo mide el cuadre. */
const absoluto = (texto: string) => Math.abs(importe(texto).valor ?? Number.NaN);

/**
 * Limpieza de ultima instancia: si el test corto con el movimiento creado, lo borra desde
 * la caja de origen. Nunca tira: si no puede, deja en el reporte como limpiarlo a mano.
 */
async function limpiarMovimiento(
  page: Page, mov: MovimientosEntreCajasPage, codigo: string, fecha: string, detalle: string,
) {
  try {
    await mov.abrirCajaDe(SUCURSAL, fecha, detalle);
    const fila = mov.filasDelMovimiento(codigo).filter({ has: page.locator('i.ph-trash') }).first();
    if (await fila.count()) {
      await mov.eliminar(fila);
      await adjuntarTexto('Limpieza', `Movimiento ${codigo} eliminado en el finally`);
    }
  } catch (error) {
    await adjuntarTexto('LIMPIEZA PENDIENTE', [
      `No se pudo borrar el movimiento ${codigo}: ${(error as Error).message}`,
      'Para dejarlo como estaba, en SSMS (ver con un SELECT antes):',
      `UPDATE qa.dbo.BO_DailyExpenseItem SET Deleted = 1, Published = 0 WHERE Code = '${codigo}';`,
    ].join(SALTO));
  }
}

test.describe('Movimientos entre cajas', () => {

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  test('Movimiento entre dos cajas de la misma sucursal: sale de una, entra en la otra y cuadra', async ({ page }) => {
    test.setTimeout(900_000);
    expect(process.env.BO_USER, 'Falta BO_USER en el entorno').toBeTruthy();
    expect(process.env.BO_PASS, 'Falta BO_PASS en el entorno').toBeTruthy();

    const bo = new BackOfficePage(page);
    const caja = new CajaDiariaPage(page);
    const mov = new MovimientosEntreCajasPage(page, caja);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);
    const detalleDeLaCaja = `Caja de regresion automatica ${sello}. No operar.`;
    // El comentario va primero en la grilla (se corta a 25 caracteres) y el modal Copiar
    // no muestra el codigo: con "AUTO-QA <sello>" se ubica la fila en las dos pantallas.
    const comentario = `AUTO-QA ${sello}`;

    let codigo = '';
    let eliminado = false;
    let antesUSD!: Totales;
    let antesARS!: Totales;

    try {
      await paso(page, 'Entrar al BO, abrir la caja del dia y medir las dos cajas AUTO-QA antes de mover nada', async () => {
        await bo.ingresar(process.env.BO_USER!, process.env.BO_PASS!);
        const { id, creada } = await mov.abrirCajaDe(SUCURSAL, fechaDeHoy, detalleDeLaCaja);
        await adjuntarTexto('Caja del dia', `id ${id} — ${creada ? 'abierta por el test' : 'ya existia'} — ${fechaDeHoy}`);
        antesUSD = await medir(mov, caja, CAJA_USD, 'USD');
        antesARS = await medir(mov, caja, CAJA_ARS, 'ARS');
        await adjuntarTexto('Totales de partida', `${CAJA_USD}: ${JSON.stringify(antesUSD)}${SALTO}${CAJA_ARS}: ${JSON.stringify(antesARS)}`);
        // Volver a "Todos": el alta se verifica sobre la grilla completa.
        await mov.filtrarPorCaja('TODOS');
      });

      await paso(page, 'Validaciones del modal: sin monto y con el mismo origen y destino no se guarda nada', async () => {
        codigo = await mov.abrirModalNuevo();
        await adjuntarTexto('Codigo del movimiento', codigo);
        expect(codigo, 'El modal tiene que generar un codigo para el movimiento').toBeTruthy();
        await mov.elegirTipoMovimiento();
        await mov.completarOrigen({ moneda: 'USD', caja: CAJA_USD });
        await mov.completarComentario(comentario);

        // Sub-caso 1: sin monto de origen ni de destino -> "Debe completar Monto & Cotizacion".
        await mov.completarDestino({ moneda: 'USD', caja: CAJA_USD });
        await mov.guardarSinEsperar();
        await conResaltado(page, page.locator(mov.modal), 'Aviso de monto y cotizacion faltantes', async () => {
          await expect(mov.aviso(/Debe completar Monto & Cotizaci.n/), 'Sin monto el BO tiene que avisar que falta Monto & Cotizacion')
            .toBeVisible({ timeout: 30_000 });
        });

        // Sub-caso 2: con importes pero la misma caja de origen y destino.
        await page.locator(mov.campoMontoOrigen).fill(ALTA.origen.texto);
        await page.locator(mov.campoMontoDestino).fill(ALTA.origen.texto);
        await mov.guardarSinEsperar();
        await conResaltado(page, page.locator(mov.modal), 'Aviso de origen y destino iguales', async () => {
          await expect(mov.aviso('Origen & Destino no pueden ser los mismos'), 'Con la misma caja de origen y destino el BO tiene que rechazar el movimiento')
            .toBeVisible({ timeout: 30_000 });
        });

        // En los dos casos el modal sigue abierto y no se creo ninguna fila.
        await conResaltado(page, page.locator(mov.modal), 'El modal sigue abierto tras un rechazo', async () => {
          await expect(page.locator(mov.modal), 'Un rechazo no tiene que cerrar el modal').toBeVisible();
          await expect(mov.filasDelMovimiento(codigo), 'Un rechazo no tiene que dejar filas en la caja').toHaveCount(0);
        });
      });

      await paso(page, 'Guardar el movimiento de USD a ARS entre las dos cajas AUTO-QA', async () => {
        // Se sigue en el mismo modal, con el destino en la misma moneda: se pasa a ARS.
        await mov.completarDestino({ moneda: 'ARS', caja: CAJA_ARS, monto: ALTA.destino.texto });
        await page.locator(mov.campoMontoOrigen).fill(ALTA.origen.texto);

        // La cotizacion la propone el sistema segun la caja de origen. Si viniera vacia el BO
        // rechaza con "Debe completar Monto & Cotizacion": no es lo que se prueba aca.
        const cotizacion = importe(await page.locator(mov.campoCotizacion).inputValue()).valor ?? 0;
        await adjuntarTexto('Cotizacion propuesta', String(cotizacion));
        if (cotizacion <= 0) {
          await page.locator(mov.campoCotizacion).fill('1500,00');
          await adjuntarTexto('AVISO', 'La cotizacion venia vacia: se cargo 1500,00 a mano para poder guardar');
        }
        await mov.guardar();
      });

      await paso(page, 'Recargar la caja y verificar las dos filas del movimiento', async () => {
        await mov.recargarCaja();
        await mov.filtrarPorCaja('TODOS');
        const filas = mov.filasDelMovimiento(codigo);
        await adjuntarTexto('Filas del movimiento', (await filas.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).join(SALTO));
        await conResaltado(page, filas.first(), 'Cantidad de filas del movimiento', async () => {
          await expect(filas, 'Un movimiento entre cajas de la misma sucursal tiene que verse como dos filas con el mismo codigo').toHaveCount(2);
        });

        const origen = mov.filaEnLaCaja(codigo, CAJA_USD);
        const destino = mov.filaEnLaCaja(codigo, CAJA_ARS);
        await expect(origen, `La salida tiene que estar en ${CAJA_USD}`).toBeVisible({ timeout: 30_000 });
        await expect(destino, `La entrada tiene que estar en ${CAJA_ARS}`).toBeVisible({ timeout: 30_000 });
        const co = await mov.celdas(origen);
        const cd = await mov.celdas(destino);
        await adjuntarTexto('Salida (origen)', co.join(' | '));
        await adjuntarTexto('Entrada (destino)', cd.join(' | '));

        await conResaltado(page, origen, 'Fila de origen del movimiento', () => {
          // La grilla abrevia el tipo: P (pago), C (cobro), M (movimiento). Medido el 15/10.
          expect(co[3].toUpperCase(), 'El tipo tiene que ser Movimiento ("M" en la grilla)').toMatch(/^M(OVIMIENTO)?$/);
          expect(co[4], 'La salida tiene que estar en USD').toContain('USD');
          expect(absoluto(co[5]), 'El monto de la salida tiene que ser el de origen').toBe(ALTA.origen.valor);
          expect(importe(co[6]).valor ?? 0, 'La cotizacion tiene que ser mayor que cero').toBeGreaterThan(0);
          expect(co[2], 'La fecha tiene que ser la de hoy').toContain(fechaDeHoy);
          expect(co[10], 'El comentario tiene que ser el cargado').toContain('AUTO-QA');
        });
        await conResaltado(page, destino, 'Fila de destino del movimiento', () => {
          expect(cd[3].toUpperCase(), 'El tipo de la entrada tiene que ser Movimiento ("M" en la grilla)').toMatch(/^M(OVIMIENTO)?$/);
          expect(cd[4], 'La entrada tiene que estar en ARS').toContain('ARS');
          expect(absoluto(cd[5]), 'El monto de la entrada tiene que ser el de destino').toBe(ALTA.destino.valor);
          expect(cd[10], 'La entrada tiene que llevar el mismo comentario que la salida').toBe(co[10]);
        });

        // Quien puede hacer que con cada fila. Sale del codigo (DailyCash.aspx.cs, CanEdit/CanDelete/CanView).
        const aO = await mov.acciones(origen);
        const aD = await mov.acciones(destino);
        await adjuntarTexto('Acciones por fila', `origen: ${JSON.stringify(aO)}${SALTO}destino: ${JSON.stringify(aD)}`);
        await conResaltado(page, origen, 'Acciones de la salida', () => {
          expect(aO, 'La salida se puede copiar, editar y borrar').toMatchObject({ copiar: true, borrar: true, editar: true, ver: false });
        });
        await conResaltado(page, destino, 'Acciones de la entrada', () => {
          expect(aD, 'La entrada no se edita ni se borra: se modifica desde el origen').toMatchObject({ copiar: false, borrar: false, editar: false });
        });
      });

      await paso(page, 'Verificar el cuadre: la salida baja la caja USD y la entrada sube la caja ARS', async () => {
        const despuesUSD = await medir(mov, caja, CAJA_USD, 'USD');
        await verificarCuadre(page, CAJA_USD, antesUSD, despuesUSD, { sale: ALTA.origen.valor });
        const despuesARS = await medir(mov, caja, CAJA_ARS, 'ARS');
        await verificarCuadre(page, CAJA_ARS, antesARS, despuesARS, { entra: ALTA.destino.valor });
        await mov.filtrarPorCaja('TODOS');
      });

      await paso(page, 'Copiar: el movimiento de la misma sucursal se puede copiar y muestra origen y destino', async () => {
        await mov.abrirCopiar();
        const fila = mov.filaDelModalCopiar(comentario);
        await expect(fila, 'El modal Copiar tiene que listar el movimiento de hoy').toBeVisible({ timeout: 30_000 });
        const celdas = await mov.celdas(fila);
        await adjuntarTexto('Fila del modal Copiar', celdas.join(' | '));
        await conResaltado(page, fila, 'Movimiento copiable', async () => {
          await expect(fila.locator('input.cbx-dailycash-copy'), 'Un movimiento dentro de la misma sucursal tiene que poder copiarse').toHaveCount(1);
          const medio = celdas.join(' | ').toUpperCase();
          expect(medio, 'El Medio tiene que mostrar origen y destino separados por una flecha').toContain('→');
          expect(medio).toContain(CAJA_USD);
          expect(medio).toContain(CAJA_ARS);
        });
        // Solo se mira: copiar crearia otro movimiento que despues habria que borrar.
        await mov.cerrarCopiar();
      });

      await paso(page, 'Editar el origen: el modal trae los dos lados y al guardar se actualizan los dos', async () => {
        const origen = mov.filaEnLaCaja(codigo, CAJA_USD);
        await mov.abrirModalEdicion(origen, codigo);

        await conResaltado(page, page.locator(mov.cuerpoDelModal), 'Datos cargados en la edicion', async () => {
          expect(await mov.elegido(mov.comboCajaOrigen), 'El Medio de origen tiene que ser el guardado').toBe(CAJA_USD);
          expect(await mov.elegido(mov.comboCajaDestino), 'El Medio de destino tiene que ser el guardado').toBe(CAJA_ARS);
          expect(importe(await page.locator(mov.campoMontoOrigen).inputValue()).valor, 'Monto de origen').toBe(ALTA.origen.valor);
          expect(importe(await page.locator(mov.campoMontoDestino).inputValue()).valor, 'Monto de destino').toBe(ALTA.destino.valor);
          await expect(page.locator(mov.comboTipo), 'El tipo no se cambia al editar').toBeDisabled();
        });

        await page.locator(mov.campoMontoOrigen).fill(EDICION.origen.texto);
        await page.locator(mov.campoMontoDestino).fill(EDICION.destino.texto);
        await mov.guardar();

        await mov.filtrarPorCaja('TODOS');
        const filas = mov.filasDelMovimiento(codigo);
        await conResaltado(page, filas.first(), 'Filas tras editar', async () => {
          await expect(filas, 'Editar no tiene que duplicar el movimiento: siguen siendo dos filas').toHaveCount(2);
          expect(absoluto((await mov.celdas(mov.filaEnLaCaja(codigo, CAJA_USD)))[5]), 'La salida tiene que mostrar el monto nuevo').toBe(EDICION.origen.valor);
          expect(absoluto((await mov.celdas(mov.filaEnLaCaja(codigo, CAJA_ARS)))[5]), 'La entrada tiene que mostrar el monto nuevo').toBe(EDICION.destino.valor);
        });

        const despuesUSD = await medir(mov, caja, CAJA_USD, 'USD');
        await verificarCuadre(page, `${CAJA_USD} tras editar`, antesUSD, despuesUSD, { sale: EDICION.origen.valor });
        const despuesARS = await medir(mov, caja, CAJA_ARS, 'ARS');
        await verificarCuadre(page, `${CAJA_ARS} tras editar`, antesARS, despuesARS, { entra: EDICION.destino.valor });
        await mov.filtrarPorCaja('TODOS');
      });

      await paso(page, 'Eliminar el movimiento desde el origen: desaparecen las dos filas y las cajas vuelven a su cuadre', async () => {
        await mov.eliminar(mov.filaEnLaCaja(codigo, CAJA_USD));
        eliminado = true;
        await mov.recargarCaja();
        await mov.filtrarPorCaja('TODOS');
        await conResaltado(page, page.locator('#tblDailyExpenseItems').first(), 'Filas tras eliminar', async () => {
          await expect(mov.filasDelMovimiento(codigo), 'Borrar el origen tiene que borrar tambien la entrada').toHaveCount(0);
        });
        const despuesUSD = await medir(mov, caja, CAJA_USD, 'USD');
        await verificarCuadre(page, `${CAJA_USD} tras eliminar`, antesUSD, despuesUSD, {});
        const despuesARS = await medir(mov, caja, CAJA_ARS, 'ARS');
        await verificarCuadre(page, `${CAJA_ARS} tras eliminar`, antesARS, despuesARS, {});
      });
    } finally {
      if (codigo && !eliminado) await limpiarMovimiento(page, mov, codigo, fechaDeHoy, detalleDeLaCaja);
    }
  });

  test('Movimiento entre sucursales: la entrada vive en la caja destino, se ve en solo lectura y no se copia', async ({ page }) => {
    test.setTimeout(900_000);

    const sucursalDestino = process.env.AMV_MOV_SUCURSAL_DESTINO ?? '';
    const cajaDestino = process.env.AMV_MOV_CAJA_DESTINO ?? '';
    const monedaDestino = process.env.AMV_MOV_MONEDA_DESTINO ?? '';
    test.skip(
      !sucursalDestino || !cajaDestino || !monedaDestino,
      'Faltan AMV_MOV_SUCURSAL_DESTINO, AMV_MOV_CAJA_DESTINO y AMV_MOV_MONEDA_DESTINO: sin una caja de otra ' +
      'sucursal para usar de destino no hay movimiento entre sucursales que probar.',
    );
    expect(process.env.BO_USER, 'Falta BO_USER en el entorno').toBeTruthy();
    expect(process.env.BO_PASS, 'Falta BO_PASS en el entorno').toBeTruthy();

    const bo = new BackOfficePage(page);
    const caja = new CajaDiariaPage(page);
    const mov = new MovimientosEntreCajasPage(page, caja);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);
    const detalleDeLaCaja = `Caja de regresion automatica ${sello}. No operar.`;
    const comentario = `AUTO-QA ${sello}`;
    const MONTO = { origen: { texto: '10,00', valor: 10 }, destino: { texto: '10,00', valor: 10 } };

    let codigo = '';
    let eliminado = false;
    let antesOrigen!: Totales;
    let antesDestino!: Totales;
    let cajaDestinoVacia = false;

    try {
      await paso(page, 'Abrir la caja del dia de la sucursal destino y medir su caja', async () => {
        await bo.ingresar(process.env.BO_USER!, process.env.BO_PASS!);
        const { id, creada } = await mov.abrirCajaDe(sucursalDestino, fechaDeHoy, detalleDeLaCaja);
        await adjuntarTexto('Caja del dia destino', `id ${id} — ${creada ? 'abierta por el test' : 'ya existia'} — ${sucursalDestino}`);
        // Solo si esta vacia se intenta despues la baja de la caja (que tiene que bloquearse).
        cajaDestinoVacia = (await page.locator(mov.filasDeMovimientos).count()) === 0;
        antesDestino = await medir(mov, caja, cajaDestino, monedaDestino);
        await adjuntarTexto('Totales de partida del destino', `${cajaDestino}: ${JSON.stringify(antesDestino)}`);
      });

      await paso(page, 'Abrir la caja del dia de Argentina y medir la caja de origen', async () => {
        await mov.abrirCajaDe(SUCURSAL, fechaDeHoy, detalleDeLaCaja);
        antesOrigen = await medir(mov, caja, CAJA_USD, 'USD');
        await adjuntarTexto('Totales de partida del origen', `${CAJA_USD}: ${JSON.stringify(antesOrigen)}`);
        await mov.filtrarPorCaja('TODOS');
      });

      await paso(page, 'Guardar un movimiento de la caja USD de Argentina a la caja de la otra sucursal', async () => {
        codigo = await mov.abrirModalNuevo();
        await adjuntarTexto('Codigo del movimiento', codigo);
        await mov.elegirTipoMovimiento();
        await mov.completarOrigen({ moneda: 'USD', caja: CAJA_USD, monto: MONTO.origen.texto });
        await mov.completarDestino({ sucursal: sucursalDestino, moneda: monedaDestino, caja: cajaDestino, monto: MONTO.destino.texto });
        await mov.completarComentario(comentario);

        const cotizacion = importe(await page.locator(mov.campoCotizacion).inputValue()).valor ?? 0;
        if (cotizacion <= 0) {
          await page.locator(mov.campoCotizacion).fill('1500,00');
          await adjuntarTexto('AVISO', 'La cotizacion venia vacia: se cargo 1500,00 a mano para poder guardar');
        }
        await mov.guardar();
      });

      await paso(page, 'En la caja de Argentina solo queda la salida, con su cuadre y sin poder copiarse', async () => {
        await mov.recargarCaja();
        await mov.filtrarPorCaja('TODOS');
        const filas = mov.filasDelMovimiento(codigo);
        await conResaltado(page, filas.first(), 'Filas en la caja de origen', async () => {
          await expect(filas, 'En la caja de origen tiene que verse solo la salida: la entrada vive en la caja de la otra sucursal').toHaveCount(1);
        });
        const origen = mov.filaEnLaCaja(codigo, CAJA_USD);
        await expect(origen, `La salida tiene que estar en ${CAJA_USD}`).toBeVisible({ timeout: 30_000 });
        const celdas = await mov.celdas(origen);
        await adjuntarTexto('Salida (origen)', celdas.join(' | '));
        await conResaltado(page, origen, 'Salida entre sucursales', async () => {
          expect(absoluto(celdas[5]), 'El monto de la salida tiene que ser el de origen').toBe(MONTO.origen.valor);
          expect(await mov.acciones(origen), 'La salida se puede editar y borrar').toMatchObject({ borrar: true, editar: true, ver: false });
        });

        const despues = await medir(mov, caja, CAJA_USD, 'USD');
        await verificarCuadre(page, CAJA_USD, antesOrigen, despues, { sale: MONTO.origen.valor });
        await mov.filtrarPorCaja('TODOS');

        // Copiar: el movimiento entre sucursales se muestra pero con un "no" en lugar del tilde.
        await mov.abrirCopiar();
        const fila = mov.filaDelModalCopiar(comentario);
        await expect(fila, 'El modal Copiar tiene que listar el movimiento, aunque no se pueda copiar').toBeVisible({ timeout: 30_000 });
        const medio = (await mov.celdas(fila)).join(' | ');
        await adjuntarTexto('Fila del modal Copiar', medio);
        await conResaltado(page, fila, 'Movimiento entre sucursales en Copiar', async () => {
          await expect(fila.locator('input.cbx-dailycash-copy'), 'Un movimiento entre sucursales no tiene que poder copiarse').toHaveCount(0);
          await expect(fila.locator('i.icon-ban'), 'Tiene que mostrar el icono de "no se puede copiar"').toHaveCount(1);
          expect(medio.toUpperCase(), 'El Medio tiene que mostrar origen y destino').toContain('→');
          expect(medio.toUpperCase()).toContain(cajaDestino.toUpperCase());
          expect(medio.toUpperCase(), 'El destino tiene que indicar su sucursal').toContain(sucursalDestino.toUpperCase());
        });
        await mov.cerrarCopiar();
      });

      await paso(page, 'En la caja de la otra sucursal aparece la entrada: sin editar ni borrar, con ojo, y sube su caja', async () => {
        await mov.abrirCajaDe(sucursalDestino, fechaDeHoy, detalleDeLaCaja);
        const filas = mov.filasDelMovimiento(codigo);
        await conResaltado(page, filas.first(), 'Filas en la caja destino', async () => {
          await expect(filas, 'La caja destino tiene que mostrar la entrada').toHaveCount(1);
        });
        const entrada = filas.first();
        const celdas = await mov.celdas(entrada);
        await adjuntarTexto('Entrada (destino)', celdas.join(' | '));
        await conResaltado(page, entrada, 'Entrada entre sucursales', async () => {
          expect(celdas[4], `La entrada tiene que estar en ${monedaDestino}`).toContain(monedaDestino.toUpperCase());
          expect(absoluto(celdas[5]), 'El monto de la entrada tiene que ser el de destino').toBe(MONTO.destino.valor);
          expect(celdas[7].toUpperCase(), 'La entrada tiene que caer en la caja destino').toContain(cajaDestino.toUpperCase());
          expect(await mov.acciones(entrada), 'La entrada de otra sucursal solo se mira: ni se edita, ni se borra, ni se copia')
            .toMatchObject({ copiar: false, borrar: false, editar: false, ver: true });
        });

        const despues = await medir(mov, caja, cajaDestino, monedaDestino);
        await verificarCuadre(page, cajaDestino, antesDestino, despues, { entra: MONTO.destino.valor });
        await mov.filtrarPorCaja('TODOS');

        // El ojo abre el modal de solo lectura con el movimiento de ORIGEN.
        await mov.abrirModalVista(entrada, codigo);
        await adjuntarTexto('Modal de solo lectura', [
          `Medio origen: ${await mov.elegido(mov.comboCajaOrigen)}`,
          `Sucursal origen: ${await mov.elegido(mov.comboSucursalOrigen)}`,
          `Medio destino: ${await mov.elegido(mov.comboCajaDestino)}`,
        ].join(SALTO));
        await conResaltado(page, page.locator(mov.cuerpoDelModal), 'Modal de solo lectura', async () => {
          await expect(page.locator(mov.btnGuardar), 'En solo lectura no tiene que haber boton Guardar').toHaveCount(0);
          await expect(page.locator(mov.campoMontoOrigen), 'Los campos tienen que estar deshabilitados').toBeDisabled();
          await expect(page.locator(mov.campoMontoDestino)).toBeDisabled();
          expect(await mov.elegido(mov.comboCajaOrigen), 'Tiene que mostrar el Medio del origen').toBe(CAJA_USD);
          expect((await mov.elegido(mov.comboSucursalOrigen)).toUpperCase(), 'Tiene que mostrar la sucursal del origen').toContain(SUCURSAL.toUpperCase());
          expect(await mov.elegido(mov.comboCajaDestino), 'Tiene que mostrar el Medio del destino').toBe(cajaDestino);
          expect(importe(await page.locator(mov.campoMontoOrigen).inputValue()).valor, 'Monto de origen').toBe(MONTO.origen.valor);
        });
        await mov.cerrarModal();
      });

      await paso(page, 'La caja destino no se puede eliminar mientras tenga la entrada', async () => {
        // Solo si la caja estaba vacia antes del test: si el bloqueo fallara, la baja se llevaria
        // puestos sus movimientos (`DeleteByDailyExpense`), y no tienen que ser datos ajenos.
        if (!cajaDestinoVacia) {
          await adjuntarTexto('OMITIDO', 'La caja destino ya tenia movimientos antes del test: no se intenta la baja.');
          return;
        }
        await caja.irABandejaDeCajas();
        await mov.elegirSucursalDeLaBandeja(sucursalDestino);
        const cartel = await mov.intentarEliminarCajaDeLaBandeja(fechaDeHoy);
        await adjuntarTexto('Cartel de la baja bloqueada', cartel);
        await conResaltado(page, page.locator('#tblDailyExpenses').first(), 'Baja de caja con contraparte', () => {
          expect(cartel, 'El cartel tiene que nombrar el movimiento que bloquea la baja').toContain(codigo);
        });
        await mov.esperarBandeja();
        await expect(mov.filaDeLaBandejaDeLaFecha(fechaDeHoy), 'La caja tiene que seguir en la bandeja').toBeVisible();
      });

      await paso(page, 'Eliminar el movimiento desde Argentina: la entrada desaparece de la otra sucursal y las dos cajas vuelven al cuadre', async () => {
        await mov.abrirCajaDe(SUCURSAL, fechaDeHoy, detalleDeLaCaja);
        await mov.eliminar(mov.filaEnLaCaja(codigo, CAJA_USD));
        eliminado = true;
        await mov.recargarCaja();
        await mov.filtrarPorCaja('TODOS');
        await expect(mov.filasDelMovimiento(codigo), 'La salida tiene que desaparecer').toHaveCount(0);
        const origen = await medir(mov, caja, CAJA_USD, 'USD');
        await verificarCuadre(page, `${CAJA_USD} tras eliminar`, antesOrigen, origen, {});

        await mov.abrirCajaDe(sucursalDestino, fechaDeHoy, detalleDeLaCaja);
        await conResaltado(page, page.locator('body'), 'Entrada tras eliminar', async () => {
          await expect(mov.filasDelMovimiento(codigo), 'Borrar el origen tiene que borrar tambien la entrada de la otra sucursal').toHaveCount(0);
        });
        const destino = await medir(mov, caja, cajaDestino, monedaDestino);
        await verificarCuadre(page, `${cajaDestino} tras eliminar`, antesDestino, destino, {});
      });
    } finally {
      if (codigo && !eliminado) await limpiarMovimiento(page, mov, codigo, fechaDeHoy, detalleDeLaCaja);
    }
  });

});

/*
 * Notas para quien corra esto por primera vez
 * -------------------------------------------
 * 1. Es un BORRADOR escrito leyendo origin/qa, no se ejecuto. Los puntos mas probables de ajuste:
 *    - la espera del modal tras cada postback (`MovimientosEntreCajasPage.elegir`);
 *    - los indices de columna de la grilla (celdas[3], [4], [5], [7], [10]);
 *    - el formato de los importes (`importe()` toma el valor absoluto en la grilla; el signo
 *      se verifica en el cuadre);
 *    - la baja de una caja desde la bandeja (segundo cartel, boton "Aceptar").
 * 2. El segundo test necesita una sucursal destino con una caja propia de regresion. Mientras
 *    no exista, queda saltado (skip) y el reporte lo dice. Crear esa caja es un dato nuevo
 *    de QA, hay que anotarlo en ESTADO.md igual que las cajas 187 y 188.
 * 3. El modal tiene un boton de calculadora (`lnkSum`) para el importe de destino segun la
 *    cotizacion. No se prueba: los importes de destino se cargan a mano.
 */
