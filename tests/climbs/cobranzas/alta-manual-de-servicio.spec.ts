import { test, expect } from '@playwright/test';
import { BackofficeNuevoPage } from '../../../pages/climbs/backoffice.page';
import { ServiciosDelDestinoPage, ItemDeLaFicha, FilaDeLaGrilla, ResultadoDelBuscador, numero } from '../../../pages/climbs/servicios-del-destino.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { reservarServicioYGenerarFile, PROVEEDOR_DE_REGRESION } from '../comun/precondiciones';
import { conBackofficeNuevo, costosDelServicio, tarifaVigente, mismoIdioma, precioEsperado } from '../../../utils/markups';
import candidatos from '../../../data/candidatos.json';

/**
 * Recargo por idioma en el alta manual (US 4739): el servicio AUTO-QA 7967 (copia de Tigre y Delta) tiene la
 * tarifa Regular en pesos y English ARS 15.000 fijos por pasajero, leidos en el BackOffice nuevo. La US pide:
 * "Al elegir un idioma en esa columna, el costo de la fila tiene que recalcularse como costo de tarifa + recargo
 * de idioma [...] generando ese recargo como un item de costo adicional propio" y "Al vender el item, el valor
 * final tiene que calcularse aplicando el markup de la agencia sobre costo + recargo en conjunto". Con la misma
 * regla que la venta del item reservado (precondicion del file): techo((costo + recargo) por persona / cotizacion /
 * markup de la agencia) x pasajeros. La agencia de pablo1 (1) tiene markup 1: con este file se verifica la
 * conversion y el redondeo del recargo, pero no se distingue si el markup se aplica tambien al recargo (los
 * tests del portal con otros markups si lo distinguen).
 */
const RP = candidatos.recargoFijoEnPesos;
/** La venta es un entero (techo por persona x pasajeros): se exige exacta. */
const TOLERANCIA_RELACION = 0.011;
/** Markup de servicios de la agencia del file (agencia 1, la de pablo1). */
const MARKUP_DE_LA_AGENCIA = 1;


/**
 * FILES — app nueva (ClimbsApp). Alta manual de un servicio en el file.
 *
 * El mismo test que tests/bloque-c/alta-manual-de-servicio.spec.ts, con el mismo titulo,
 * mirado desde lo que ve la persona: sobre un file nuevo (Tigre y Delta, 2 pasajeros) se le
 * agrega **el mismo servicio** en la misma fecha y con el mismo rooming, asi el costo y la
 * venta del item nuevo tienen dos fuentes: lo que cotiza el buscador y el item que trajo la
 * reserva. Se mira en cada eslabon: buscador -> fila de la grilla -> ficha -> cabecera del
 * destino -> panel "Totales" -> "Comprobantes y saldos" -> grilla reabierta.
 *
 * El panel "Totales" muestra lo grabado en el file, que en la app nueva no se actualiza al
 * guardar: lo recalcula un proceso aparte (cada ~30 s). Se le da hasta 2 minutos.
 * El file es de la corrida: no hay nada que limpiar.
 */
const CIUDAD = 'Buenos Aires';
const casi = (real: number, esperado: number, mensaje: string, tolerancia = 0.011) =>
  expect(Math.abs(real - esperado), `${mensaje} (real ${real}, esperado ${esperado})`).toBeLessThanOrEqual(tolerancia);

test.describe('Files — alta manual de servicio', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Alta manual: el servicio agregado a un file queda con el costo, la venta y la moneda esperados, y los totales lo reflejan', async ({ page }) => {
    test.setTimeout(1_800_000);
    const erroresJS: string[] = [];
    page.on('pageerror', (e) => erroresJS.push(e.message));
    const bo = new BackofficeNuevoPage(page);
    const sd = new ServiciosDelDestinoPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

    const base = await reservarServicioYGenerarFile(page, sello);
    let item1Antes!: ItemDeLaFicha;
    let costoDelFileAntes = 0;
    let rooming = '';
    let elegido!: ResultadoDelBuscador;
    let grillaNueva!: FilaDeLaGrilla;
    let nuevo!: ItemDeLaFicha;

    await paso(page, `Abrir el file ${base.fileCode} y tomar su estado de partida`, async () => {
      await bo.abrirFicha(base.fileId);
      await sd.verDestinosYServicios();
      const items = await sd.itemsDeLaFicha(CIUDAD);
      await adjuntarTexto('Items del destino', items.map((i) => i.texto).join('\n'));
      expect(items, 'El file recien generado tiene que traer solo el servicio reservado desde el portal').toHaveLength(1);
      item1Antes = items[0];
      rooming = item1Antes.rooming || `1-${base.cantidadPax}`;
      const totales = await sd.totalesGrabados();
      await bo.verFinanzas();
      const proveedores = await bo.cifras(bo.ladoProveedores());
      const cliente = await bo.cifras(bo.ladoCliente());
      costoDelFileAntes = numero(proveedores['Costo del file']);
      await adjuntarTexto('Partida', JSON.stringify({ item1Antes, totalesGrabados: totales.texto, cliente, proveedores }, null, 1));
      expect(item1Antes.costo.valor, 'El item reservado tiene que traer costo').toBeGreaterThan(0);
      casi(numero(cliente['Venta del file']), item1Antes.venta.valor, 'La venta del panel es la del unico item');
    });

    await paso(page, 'Entrar a los servicios del destino y buscar el servicio con su tarifa Regular', async () => {
      await page.goto(`/files/files/${base.fileId}`);
      await sd.verDestinosYServicios();
      await sd.abrirServiciosDelDestino(CIUDAD);
      await expect(sd.filasDeLaGrilla(), 'La grilla tiene que traer el servicio reservado').toHaveCount(1);
      await sd.abrirBuscador();
      // El buscador ofrece tambien "Tigre y Delta en Yate": se elige el servicio AUTO-QA.
      const resultados = await sd.buscarServicio('Tigre y Delta', /AUTO-QA NO TOCAR - Tigre y Delta(?!\s*en\b)/i, rooming, 'Regular');
      await adjuntarTexto('Resultados del buscador', resultados.map((r) => Object.entries(r.celdas).map(([k, v]) => `${k}: ${v}`).join(' | ')).join('\n'));
      const candidatas = resultados.filter((r) => /tigre y delta/i.test(r.celdas['Servicio / Hotel'] ?? '') && !(r.celdas['Servicio / Hotel'] ?? '').startsWith('*')
        && /regular/i.test(r.celdas['Tipo de tarifa'] ?? ''));
      expect(candidatas.length, 'El buscador tiene que ofrecer la tarifa Regular de Tigre y Delta para la fecha del destino').toBeGreaterThan(0);
      // Con mas de una, la del proveedor del item reservado: mismo tipo de cambio.
      elegido = candidatas.find((r) => (r.celdas['Oper. / Proveedor'] ?? '').toUpperCase().includes(PROVEEDOR_DE_REGRESION.termino)) ?? candidatas[0];
      await adjuntarTexto('Tarifa elegida', JSON.stringify(elegido.celdas, null, 1));
      // Misma fecha (el buscador arranca en la del destino), mismo servicio y pasajeros: misma cotizacion.
      expect(elegido.costo.moneda, 'El costo tiene que estar en la moneda del item reservado').toBe(item1Antes.costo.moneda);
      casi(elegido.costo.valor, item1Antes.costo.valor, 'Mismo servicio, fecha y pasajeros: el buscador tiene que cotizar el mismo costo que el item reservado');
      expect(elegido.venta.moneda, 'La venta se cotiza en la moneda del file').toBe(item1Antes.venta.moneda);
      expect(Math.abs(elegido.venta.valor - item1Antes.venta.valor),
        `Mismo servicio, fecha y markup: el buscador tiene que cotizar la venta del item reservado (${item1Antes.venta.valor}) y cotizo ${elegido.venta.valor}`).toBeLessThanOrEqual(1);
    });

    await paso(page, 'Agregar la tarifa: la fila de la grilla trae el costo, la venta y las monedas del buscador', async () => {
      await sd.agregar(elegido);
      await expect(sd.filasDeLaGrilla(), 'Agregar tiene que sumar una fila a la grilla').toHaveCount(2);
      const fila = sd.filasDeLaGrilla().last();
      grillaNueva = await sd.leerFila(fila);
      await adjuntarTexto('Fila agregada en la grilla', JSON.stringify(grillaNueva, null, 1));
      expect(grillaNueva.texto.toUpperCase(), 'La fila tiene que ser el servicio elegido, en tarifa Regular').toMatch(/TIGRE Y DELTA[\s\S]*REGULAR/);
      expect(grillaNueva.checkin, 'El check-in tiene que ser la fecha del destino').toBe(item1Antes.checkin);
      expect(grillaNueva.rooming, 'El rooming tiene que ser el cargado en el buscador').toBe(rooming);
      casi(grillaNueva.costo, elegido.costo.valor, 'El costo de la fila tiene que ser el del buscador');
      casi(grillaNueva.venta, elegido.venta.valor, 'La venta de la fila tiene que ser la del buscador');
      expect(grillaNueva.monedaDeCosto, 'La moneda del costo tiene que ser la que cotizo el buscador').toBe(elegido.costo.moneda);
      expect(grillaNueva.monedaDeVenta, 'La venta tiene que estar en la moneda del file').toBe(elegido.venta.moneda);
    });

    await paso(page, 'Guardar y volver al file', async () => {
      const { preguntoSinCambios } = await sd.guardarYVolver(base.fileId);
      await adjuntarTexto('Al volver', preguntoSinCambios
        ? 'Ya guardado (pie "Al día"), la pantalla pregunto "Hay cambios sin guardar"; se eligio "Descartar cambios".'
        : 'Volvio directo a la ficha.');
      // En el BO actual "Guardar y Volver" vuelve directo. No corta el test: lo que sigue
      // verifica que lo guardado haya quedado.
      expect.soft(preguntoSinCambios, 'Ya guardado, volver a la ficha no tiene que preguntar por cambios sin guardar').toBe(false);
    });

    let item1Despues!: ItemDeLaFicha;
    await paso(page, 'La ficha del file lista el item nuevo con el costo, la venta y la moneda esperados', async () => {
      await sd.verDestinosYServicios();
      const items = await sd.itemsDeLaFicha(CIUDAD);
      await adjuntarTexto('Items del file despues de guardar', items.map((i) => i.texto).join('\n'));
      expect(items, 'Despues de guardar el file tiene que listar los dos servicios').toHaveLength(2);
      [item1Despues, nuevo] = items;
      expect(nuevo.texto, 'El item nuevo tiene que ser el servicio elegido').toContain('Tigre y Delta');
      expect(nuevo.tarifa, 'La tarifa tiene que ser Regular').toBe('REGULAR');
      expect(nuevo.checkin, 'El check-in tiene que ser el del buscador').toBe(item1Antes.checkin);
      expect(nuevo.rooming, 'El rooming tiene que ser el cargado').toBe(rooming);
      // La ficha muestra el nombre corto del proveedor ("Expediciones") y el buscador el nombre y
      // la razon social ("Expediciones SPS EXPEDICIONES SRL"): se compara por el nombre corto.
      const proveedorElegido = (elegido.celdas['Oper. / Proveedor'] ?? '').split(' ')[0];
      expect(nuevo.texto.toUpperCase(), `El proveedor del item tiene que ser el de la tarifa elegida (${elegido.celdas['Oper. / Proveedor']})`)
        .toContain(proveedorElegido.toUpperCase());
      expect(nuevo.costo.moneda, 'El costo tiene que quedar en la moneda del servicio').toBe(elegido.costo.moneda);
      casi(nuevo.costo.valor, elegido.costo.valor, 'El costo guardado tiene que ser el cotizado');
      expect(nuevo.venta.moneda, 'La venta tiene que quedar en la moneda del file').toBe(elegido.venta.moneda);
      casi(nuevo.venta.valor, elegido.venta.valor, 'La venta guardada tiene que ser la cotizada');
      expect(item1Despues.costo, 'Agregar un servicio no puede cambiar el costo del que ya estaba').toEqual(item1Antes.costo);
      expect(item1Despues.venta, 'Agregar un servicio no puede cambiar la venta del que ya estaba').toEqual(item1Antes.venta);
      expect(item1Despues.rooming).toBe(item1Antes.rooming);
      expect(item1Despues.checkin).toBe(item1Antes.checkin);
    });

    await paso(page, 'La cabecera del destino, el panel "Totales" y "Comprobantes y saldos" suman el item nuevo', async () => {
      const ventaDeLosItems = item1Despues.venta.valor + nuevo.venta.valor;
      const cabecera = await sd.cabeceraDelDestino(CIUDAD);
      await adjuntarTexto('Cabecera del destino', cabecera.texto);
      expect(cabecera.servicios, 'La cabecera del destino tiene que contar los dos servicios').toBe(2);
      casi(cabecera.venta, ventaDeLosItems, 'La venta de la cabecera del destino tiene que ser la suma de los dos items');

      // Lo grabado en el file lo recalcula un proceso aparte: se espera hasta 2 minutos.
      let grabados = await sd.totalesGrabados();
      await expect.poll(async () => {
        await page.reload();
        await sd.verDestinosYServicios();
        grabados = await sd.totalesGrabados();
        return grabados.venta;
      }, { message: 'El panel "Totales" (lo grabado en el file) tiene que reflejar la venta de los dos items', timeout: 120_000, intervals: [10_000] })
        .toBeCloseTo(ventaDeLosItems, 1);
      // El costo grabado tambien lo recalcula ese proceso: se le dan otros 2 minutos. En la app
      // nueva el costo grabado de los files de carrito queda en 0 (hallazgo del 26/10/2026): se
      // marca sin cortar, para que se sigan verificando los paneles que lo calculan.
      await expect.configure({ soft: true }).poll(async () => {
        await page.reload();
        await sd.verDestinosYServicios();
        grabados = await sd.totalesGrabados();
        return grabados.costo;
      }, { message: 'El costo grabado del file (panel "Totales") tiene que reflejar el costo de los dos items', timeout: 120_000, intervals: [15_000] })
        .toBeGreaterThan(0);
      await adjuntarTexto('Panel Totales (grabado) despues', grabados.texto);

      await bo.verFinanzas();
      const cliente = await bo.cifras(bo.ladoCliente());
      const proveedores = await bo.cifras(bo.ladoProveedores());
      await adjuntarTexto('Comprobantes y saldos despues', JSON.stringify({ cliente, proveedores }, null, 1));
      casi(numero(cliente['Venta del file']), ventaDeLosItems, 'La venta del panel tiene que ser la suma de los dos items');
      expect(numero(cliente['Facturado']), 'No se facturo nada').toBe(0);
      expect(numero(cliente['Cobrado']), 'No se cobro nada').toBe(0);
      casi(numero(cliente['Falta cobrar']), ventaDeLosItems, 'Sin cobros, falta cobrar toda la venta');
      expect(numero(proveedores['Costo del file']), 'El costo del panel tiene que subir al sumar el item').toBeGreaterThan(costoDelFileAntes);
      // Mismo proveedor y moneda: el costo del file (pasado a la moneda del file con el tipo de
      // cambio del proveedor) se duplica. Con otro proveedor el tipo de cambio puede ser otro.
      if ((elegido.celdas['Oper. / Proveedor'] ?? '').toUpperCase().includes(item1Antes.proveedor.toUpperCase()) && item1Antes.proveedor) {
        casi(numero(proveedores['Costo del file']), costoDelFileAntes * 2, 'El costo del panel tiene que crecer lo que cuesta el item nuevo', 0.05);
      }
      expect(numero(proveedores['Facturado']), 'No se facturo nada').toBe(0);
      expect(numero(proveedores['Pagado']), 'No se pago nada').toBe(0);
      casi(numero(proveedores['Falta pagar']), numero(proveedores['Costo del file']), 'Sin pagos, falta pagar todo el costo');
      await expect(bo.ladoCliente().locator('.fa-figure--owed'), 'Falta cobrar tiene que quedar marcado como deuda').toHaveCount(1);
      await expect(bo.ladoProveedores().locator('.fa-figure--owed'), 'Falta pagar tiene que quedar marcado como deuda').toHaveCount(1);
    });

    await paso(page, 'Reabrir los servicios del destino: las dos filas conservan costo, venta y monedas', async () => {
      await page.goto(`/files/files/${base.fileId}`);
      await sd.verDestinosYServicios();
      await sd.abrirServiciosDelDestino(CIUDAD);
      await expect(sd.filasDeLaGrilla()).toHaveCount(2);
      const [original, guardada] = [await sd.leerFila(sd.filasDeLaGrilla().nth(0)), await sd.leerFila(sd.filasDeLaGrilla().nth(1))];
      await adjuntarTexto('Filas de la grilla reabierta', JSON.stringify({ original, guardada }, null, 1));
      casi(guardada.costo, elegido.costo.valor, 'El costo reabierto tiene que ser el cotizado');
      casi(guardada.venta, elegido.venta.valor, 'La venta reabierta tiene que ser la cotizada');
      expect(guardada.monedaDeCosto, 'La moneda del costo se conserva').toBe(elegido.costo.moneda);
      expect(guardada.monedaDeVenta, 'La moneda de la venta se conserva').toBe(elegido.venta.moneda);
      expect(guardada.rooming).toBe(rooming);
      casi(original.costo, item1Antes.costo.valor, 'El costo del item existente se conserva');
      casi(original.venta, item1Antes.venta.valor, 'La venta del item existente se conserva');
      expect(original.monedaDeCosto, 'La moneda del costo del item existente se conserva').toBe(item1Antes.costo.moneda);
    });

    await paso(page, 'Alta con idioma: English suma el recargo al costo, lo agrega como item adicional y la venta lleva el markup sobre costo + recargo', async () => {
      const pax = base.cantidadPax;
      const FECHA = item1Antes.checkin;
      const [dd, mm, aa] = FECHA.split('/').map(Number);
      const tarifas = await conBackofficeNuevo(page.context().browser()!, (bo) => costosDelServicio(bo, RP.id));
      const tarifa = tarifaVigente(tarifas, 'Regular', new Date(aa, mm - 1, dd), pax);
      const recargo = tarifa?.recargos.find((r) => mismoIdioma(r.idioma, 'English'));
      expect(recargo, `${RP.nombre} tiene que tener recargo English en su tarifa Regular del ${FECHA}`).toBeDefined();
      expect(recargo!.tipo, 'El recargo de English del servicio AUTO-QA es por pasajero').toBe('porPasajero');
      const recargoTotal = recargo!.valor * pax;

      await sd.abrirBuscador();
      const resultados = await sd.buscarServicio(RP.terminoBusqueda, new RegExp(RP.nombre, 'i'), rooming, 'Regular');
      const r = resultados.find((x) => new RegExp(RP.terminoBusqueda, 'i').test(x.celdas['Servicio / Hotel'] ?? '') && /regular/i.test(x.celdas['Tipo de tarifa'] ?? ''));
      expect(r, `El buscador tiene que ofrecer la tarifa Regular de ${RP.nombre}`).toBeDefined();
      const relacion = r!.venta.valor / r!.costo.valor;
      const combo = r!.fila.getByRole('combobox', { name: /^Idioma · / });
      await expect(combo, 'Con idiomas configurados, el listado tiene que mostrar el combo de la columna Idioma').toBeVisible();
      await combo.selectOption({ label: 'English' });
      const importes = (await r!.fila.locator('td').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => /^[A-Z]{3} [\d.,]+$/.test(t));
      const costoCon = numero(importes[0] ?? '');
      const ventaCon = numero(importes[1] ?? '');
      const costoEsperado = r!.costo.valor + recargoTotal;
      const ventaEsperada = precioEsperado(tarifa!.costo! + recargo!.valor, tarifa!.moneda, MARKUP_DE_LA_AGENCIA)! * pax;
      const ventaSinEsperada = precioEsperado(tarifa!.costo!, tarifa!.moneda, MARKUP_DE_LA_AGENCIA)! * pax;
      await adjuntarTexto('Alta con idioma: buscador', [
        `Tarifa del BackOffice: ${tarifa!.vigencia} | ${tarifa!.moneda} ${tarifa!.costo} | recargo ${JSON.stringify(recargo)} x ${pax} pax = ${recargoTotal}`,
        `Sin recargo: costo ${r!.costo.moneda} ${r!.costo.valor}, venta ${r!.venta.moneda} ${r!.venta.valor} (venta/costo ${relacion})`,
        `Con English: costo ${importes[0]}, venta ${importes[1]}`,
        `Esperado: costo ${costoEsperado}, venta techo((${tarifa!.costo} + ${recargo!.valor}) / cotizacion / ${MARKUP_DE_LA_AGENCIA}) x ${pax} = ${ventaEsperada} (sin idioma ${ventaSinEsperada})`,
      ].join('\n'));
      expect(r!.venta.valor, `Sin idioma, la venta del buscador tiene que ser techo(costo / cotizacion / ${MARKUP_DE_LA_AGENCIA}) x ${pax}`).toBe(ventaSinEsperada);
      expect.soft(Math.abs(costoCon - costoEsperado), `Con English el costo de la fila tiene que ser costo de tarifa + recargo (${costoEsperado}) y es ${costoCon} (US 4739)`).toBeLessThanOrEqual(0.011);
      expect.soft(Math.abs(ventaCon - ventaEsperada), `Con English la venta tiene que llevar el markup sobre costo + recargo (${ventaEsperada.toFixed(2)}) y es ${ventaCon} (US 4739)`).toBeLessThanOrEqual(TOLERANCIA_RELACION);

      const filasAntes = await sd.filasDeLaGrilla().count();
      await sd.agregar(r!);
      await expect(sd.filasDeLaGrilla(), 'Con English, Agregar tiene que sumar el servicio y su item adicional de idioma').toHaveCount(filasAntes + 2);
      const servicio = await sd.leerFila(sd.filasDeLaGrilla().nth(filasAntes));
      const adicional = await sd.leerFila(sd.filasDeLaGrilla().nth(filasAntes + 1));
      await adjuntarTexto('Alta con idioma: filas agregadas', JSON.stringify({ servicio, adicional }, null, 1));
      expect.soft(Math.abs(adicional.costo - recargoTotal), `El recargo tiene que agregarse como item de costo adicional de ${recargoTotal} (US 4739)`).toBeLessThanOrEqual(0.011);
      expect.soft(Math.abs(servicio.costo + adicional.costo - costoEsperado), 'El costo de las dos filas tiene que sumar costo de tarifa + recargo').toBeLessThanOrEqual(0.011);
      expect.soft(Math.abs(servicio.venta + adicional.venta - ventaEsperada),
        `La venta de las dos filas tiene que ser (costo + recargo) con el markup (${ventaEsperada.toFixed(2)}) y suma ${(servicio.venta + adicional.venta).toFixed(2)} (US 4739)`).toBeLessThanOrEqual(TOLERANCIA_RELACION);

      await sd.guardarYVolver(base.fileId);
      await sd.verDestinosYServicios();
      const items = await sd.itemsDeLaFicha(CIUDAD);
      await adjuntarTexto('Alta con idioma: items del file', items.map((i) => i.texto).join('\n'));
      expect(items, 'Despues de guardar, el file tiene que listar los dos servicios anteriores, el nuevo y su item adicional de idioma').toHaveLength(4);
      const ventaGuardada = items.slice(2).reduce((t, i) => t + i.venta.valor, 0);
      expect.soft(Math.abs(ventaGuardada - ventaEsperada), `En la ficha, la venta del servicio y su recargo tiene que ser ${ventaEsperada.toFixed(2)} y suma ${ventaGuardada.toFixed(2)} (US 4739)`).toBeLessThanOrEqual(TOLERANCIA_RELACION);
    });

    expect(erroresJS, 'La app nueva no tiene que tirar errores de JavaScript durante el flujo').toEqual([]);
  });
});
