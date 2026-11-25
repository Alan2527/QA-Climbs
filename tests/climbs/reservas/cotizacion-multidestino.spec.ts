import { test, expect, Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import { CircuitoNuevoPage } from '../../../pages/climbs/circuito.page';
import { ModalesMultidestinoPage } from '../../../pages/climbs/modales-multidestino.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, conResaltado, formatearFecha } from '../../../utils/pasos';
import { importe, Importe, fechaDelPaquete } from './reservas-comun';
import candidatos from '../../../data/candidatos.json';
import { conBackofficeNuevo, exigirServiciosDelCircuito, exigirHotelesDelCircuito, costosDelServicio, tarifaVigente, precioEsperado } from '../../../utils/markups';

const CENA = candidatos.tarifario.cenaShow;
/** Markup de servicios de la agencia de pablo1: el del precio de cada servicio del itinerario (US 4800). */
const MARKUP_AGENCIA = candidatos._usuarioTest.markupsDeLaAgencia.servicio;
const CIUDAD = 'Buenos Aires';

/**
 * RESERVAS — app nueva (ClimbsApp). Cotizacion de multidestino.
 *
 * El mismo test que tests/bloque-b/cotizacion-multidestino.spec.ts, con el mismo titulo: la
 * agencia arma el viaje, lo guarda como cotizacion, la baja en PDF o Word y, cuando el
 * pasajero acepta, la retoma y la lleva al carrito con el mismo precio. No se emite.
 *
 * Recargo por idioma (US 4739): antes de guardar se agrega la Cena Show AUTO-QA (163), con English USD 15 fijos
 * por pasajero en su tarifa Regular, y se elige English en su fila. La US pide: "el valor final tiene que
 * calcularse aplicando el markup de la agencia sobre costo + recargo en conjunto, nunca sobre el costo solo".
 * La fila es el total de los 2 pasajeros: en Espanol techo(costo / markup de la agencia) x pax (el precio de su
 * tarjeta) y en English techo((costo + recargo) / markup de la agencia) x pax. El markup de servicios de la
 * agencia de pablo1 es 1: aca se verifica que el recargo entre en la fila y se conserve, pero no se distingue si
 * lleva el markup (eso lo distingue multidestino-agregar con el markup 0,8 de la cotizacion). Al retomar la
 * cotizacion la fila tiene que volver en English con el mismo precio, y el documento y el carrito con el total
 * que ya incluye el recargo.
 *
 * Deja en QA la cotizacion y su viaje (el portal no tiene como borrarlas), con referencia
 * "AUTO-QA COT <sello>", igual que la suite actual.
 */
test.describe('Cotizacion de multidestino', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  const PAQUETE = { nombre: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)', corto: 'Paquete Buenos Aires y Ushuaia' };

  /** Los importes del resumen (cada hotel, la habitacion, los servicios y el total), en orden. */
  const importesDe = (lineas: string[]) => lineas.filter((c) => /^[A-Z]{3}\s*\d[\d.,]*$/.test(c));

  /** El bloque de la cotizacion en el historial (solapa Multidestino), buscada por su referencia. */
  async function filaDelHistorial(page: Page, referencia: string): Promise<Locator> {
    await page.goto('/site/quotes');
    await page.getByRole('tab', { name: 'Multidestino', exact: true }).click();
    await page.locator('main').getByRole('searchbox').first().fill(referencia);
    await page.locator('main').getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.waitForLoadState('networkidle');
    // El bloque es el elemento mas chico que tiene la referencia y el link "Ver detalle".
    return page.getByRole('tabpanel').locator('div, article, li')
      .filter({ hasText: referencia }).filter({ has: page.getByRole('link', { name: 'Ver detalle' }) }).last();
  }

  test('Multidestino: la cotizacion guardada se descarga y al retomarla conserva el precio hasta el carrito', async ({ page }) => {
    test.setTimeout(900_000);
    const ct = new CircuitoNuevoPage(page);
    const mod = new ModalesMultidestinoPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const datos = {
      referencia: `AUTO-QA COT ${sello}`,
      pasajero: `Pasajero Cotizacion ${sello.slice(-6)}`,
      terminos: `Terminos AUTO-QA ${sello}: tarifa sujeta a disponibilidad`,
    };
    let total: Importe = { moneda: '', valor: null };
    let totalComoSeVe = '';
    let quoteId = '';
    let importesArmados: string[] = [];
    const fecha = fechaDelPaquete();

    await paso(page, 'Armar el paquete y tomar el total del itinerario', async () => {
      await ct.buscarViaje('MULTIDESTINO', { pais: 'Argentina', ciudad: 'Buenos Aires', nombre: PAQUETE.nombre, fecha });
      await ct.configurarViaje(2, 1);
      await ct.irAlItinerario();
      const opcion = await ct.opcionesDeCotizacion();
      totalComoSeVe = opcion.total;
      total = importe(opcion.total);
      importesArmados = importesDe(opcion.lineas);
      await adjuntarTexto('Resumen del itinerario armado', opcion.lineas.join('\n'));
      expect(total.valor, 'El itinerario tiene que tener un total para cotizar').toBeGreaterThan(0);
    });

    await paso(page, 'Cada servicio y cada hotel de la cotizacion cuesta lo que sale de su tarifa', async () => {
      // US 4800: el precio de cada servicio y de cada hotel de la cotizacion "tiene que calcularse con
      // el markup de servicios" / "de hoteles" de la agencia (el CustomMarkup del usuario no entra).
      const opcion = await ct.opcionesDeCotizacion();
      const filas = await ct.serviciosDelItinerario(fecha);
      const mk = candidatos._usuarioTest.markupsDeLaAgencia;
      const { servicios, hoteles } = await conBackofficeNuevo(page.context().browser()!, async (bo) => ({
        servicios: await exigirServiciosDelCircuito(bo, filas, mk.servicio),
        hoteles: await exigirHotelesDelCircuito(bo, opcion.lineas, fecha, 2, mk.hotel),
      }));
      await adjuntarTexto('Importes de los servicios contra el costo', servicios.join('\n'));
      await adjuntarTexto('Importes de los hoteles contra los cortes', hoteles.join('\n'));
      await conResaltado(page, page.locator('main'), 'Importes de la cotizacion', () => {
        expect.soft(servicios.filter((l) => !l.startsWith('OK')), 'Cada servicio tiene que costar techo(costo / cotizacion / markup) por pasajero').toEqual([]);
        expect.soft(hoteles.filter((l) => !l.startsWith('OK')), 'Cada hotel tiene que costar techo(cortes DBL de sus noches x pax / markup)').toEqual([]);
      });
    });

    let cenaEnIngles: number | null = null;
    const esCena = (n: string) => /Angelitos/i.test(n);
    const filaDeLaCena = () => mod.destino(CIUDAD).locator('article').filter({ hasText: /Angelitos/i }).last();
    const precioDeLaCena = async () => (await mod.itemsDelDestino(CIUDAD, 'Servicios')).filter((i) => esCena(i.nombre)).at(-1)!;
    await paso(page, `Agregar la Cena Show (${CENA.id}) y elegir English en su fila: el recargo por idioma lleva el markup (US 4739)`, async () => {
      const tarifas = await conBackofficeNuevo(page.context().browser()!, (bo) => costosDelServicio(bo, CENA.id));
      const tarifa = tarifaVigente(tarifas, 'Regular', fecha, 2);
      expect(tarifa, `${CENA.nombre} tiene que tener tarifa Regular vigente el ${formatearFecha(fecha)}`).toBeDefined();
      const recargo = tarifa!.recargos.find((r) => /^(English|Ingl[eé]s)$/i.test(r.idioma));
      expect(recargo, `La tarifa Regular de ${CENA.nombre} tiene que tener recargo para English`).toBeDefined();

      await mod.abrirModalDeServicios(CIUDAD);
      await mod.buscarServicio(CENA.terminoBusqueda, fecha);
      const nombre = Object.keys(await mod.tarjetas()).find(esCena);
      expect(nombre, `El modal tiene que ofrecer ${CENA.nombre} el ${formatearFecha(fecha)}`).toBeDefined();
      const precioTarjeta = (await mod.tarjetas())[nombre!].regular as number;
      const antes = (await mod.itemsDelDestino(CIUDAD, 'Servicios')).filter((i) => esCena(i.nombre)).length;
      await mod.elegirServicio(nombre!, 'Regular');
      await mod.confirmar(mod.modalDeServicios);
      await expect.poll(async () => (await mod.itemsDelDestino(CIUDAD, 'Servicios')).filter((i) => esCena(i.nombre)).length,
        { message: 'El itinerario tiene que sumar la Cena Show', timeout: 120_000 }).toBe(antes + 1);
      await page.waitForLoadState('networkidle');
      const enEspanol = await precioDeLaCena();
      const totalEspanol = importe((await ct.opcionesDeCotizacion()).total);

      const combo = filaDeLaCena().getByRole('combobox', { name: 'Idioma', exact: true });
      await expect(combo, 'La fila de la Cena Show tiene que tener el combo Idioma').toBeVisible();
      const opciones = (await combo.locator('option').allInnerTexts()).map((o) => o.trim());
      const ingles = opciones.find((o) => /^(English|Ingl[eé]s)$/i.test(o));
      expect(ingles, `El combo Idioma tiene que ofrecer English. Ofrece: ${opciones.join(', ')}`).toBeDefined();
      await combo.selectOption({ label: ingles! });
      await expect.poll(async () => (await precioDeLaCena()).importe, { message: 'La fila tiene que recalcular el precio al elegir English', timeout: 60_000 })
        .not.toBe(enEspanol.importe);
      await page.waitForLoadState('networkidle');
      const enIngles = await precioDeLaCena();
      cenaEnIngles = enIngles.importe;
      const opcion = await ct.opcionesDeCotizacion();

      const recargoPax = recargo!.tipo === 'porcentaje' ? tarifa!.costo! * recargo!.valor / 100 : recargo!.tipo === 'porPasajero' ? recargo!.valor : recargo!.valor / 2;
      const espanolEsperado = precioEsperado(tarifa!.costo!, tarifa!.moneda, MARKUP_AGENCIA)! * 2;
      const inglesEsperado = precioEsperado(tarifa!.costo! + recargoPax, tarifa!.moneda, MARKUP_AGENCIA)! * 2;
      const subio = (enIngles.importe ?? 0) - (enEspanol.importe ?? 0);
      await adjuntarTexto('Cena Show en English', [
        `Tarifa del BackOffice: ${tarifa!.vigencia} | ${tarifa!.moneda} ${tarifa!.costo} | recargos ${JSON.stringify(tarifa!.recargos)}`,
        `Tarjeta del modal: ${precioTarjeta}`,
        `Fila: Espanol ${enEspanol.texto} -> English ${enIngles.texto} (subio ${subio})`,
        `Esperado: Espanol techo(${tarifa!.costo} / ${MARKUP_AGENCIA}) x 2 = ${espanolEsperado}; English techo((${tarifa!.costo} + ${recargoPax}) / ${MARKUP_AGENCIA}) x 2 = ${inglesEsperado}`,
        `Total del itinerario: ${totalEspanol.valor} -> ${importe(opcion.total).valor}`,
      ].join('\n'));
      await conResaltado(page, filaDeLaCena(), 'Cena Show en English', () => {
        expect(enEspanol.importe, 'En Espanol la fila tiene que tener el precio de la tarjeta del modal').toBe(precioTarjeta);
        expect.soft(enEspanol.importe, `En Espanol la fila tiene que ser techo(costo / markup de la agencia) x 2 = ${espanolEsperado}`).toBe(espanolEsperado);
        expect.soft(enIngles.importe, `En English la fila tiene que ser techo((costo + recargo) / markup de la agencia) x 2 = ${inglesEsperado} (US 4739)`).toBe(inglesEsperado);
        expect.soft((importe(opcion.total).valor ?? 0) - (totalEspanol.valor ?? 0), 'El total del itinerario tiene que subir lo mismo que la fila').toBe(subio);
      });
      // La cotizacion se guarda con la Cena en English: lo que se compara despues es este total.
      totalComoSeVe = opcion.total;
      total = importe(opcion.total);
      importesArmados = importesDe(opcion.lineas);
      await adjuntarTexto('Resumen del itinerario con la Cena en English', opcion.lineas.join('\n'));
    });

    await paso(page, 'Cargar referencia, pasajero y terminos y guardar la cotizacion', async () => {
      await page.getByRole('tab', { name: 'Configuración', exact: true }).click();
      await page.getByRole('textbox', { name: 'Referencia', exact: true }).fill(datos.referencia);
      await page.getByRole('textbox', { name: 'Nombre de pasajero / grupo', exact: true }).fill(datos.pasajero);
      await page.getByRole('textbox', { name: /^(Términos y condiciones )?Para hacer un salto de l[ií]nea/ }).fill(datos.terminos);
      // "Guardar cotizacion" esta al pie de "Opciones de cotizacion", en la solapa Hoteles y
      // servicios: se vuelve a ella. Guarda y va al historial, como en el portal actual.
      await page.getByRole('tab', { name: /^Hoteles (y|&) [Ss]ervicios$/ }).click();
      await page.getByRole('button', { name: 'Guardar cotización', exact: true }).click();
      await expect(page, 'Guardar la cotizacion tiene que llevar al historial de cotizaciones').toHaveURL(/\/site\/quotes$/, { timeout: 120_000 });
    });

    await paso(page, 'La cotizacion figura en el historial con su referencia', async () => {
      const fila = await filaDelHistorial(page, datos.referencia);
      await conResaltado(page, fila, 'Cotizacion en el historial', async () => {
        await expect(fila, `El historial tiene que listar la cotizacion ${datos.referencia}`).toBeVisible({ timeout: 60_000 });
        await expect(fila, 'La fila tiene que mostrar el paquete cotizado').toContainText(PAQUETE.corto);
        await expect(fila, 'La fila tiene que mostrar el pasajero').toContainText(datos.pasajero);
      });
      await adjuntarTexto('Fila del historial', (await fila.innerText()).replace(/\s+/g, ' '));
      const verDetalle = await fila.getByRole('link', { name: 'Ver detalle' }).getAttribute('href');
      quoteId = verDetalle?.match(/\/quote\/(\d+)/)?.[1] ?? '';
      expect(quoteId, 'El link Ver detalle tiene que llevar el numero de la cotizacion').toMatch(/^\d+$/);
    });

    await paso(page, 'El documento de la cotizacion trae el paquete, la referencia y los terminos', async () => {
      // Es la pagina de la que salen el PDF y el Word.
      await page.goto(`/site/custom-tours/quotes/${quoteId}/print`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body'), 'El documento tiene que cargar la cotizacion').toContainText(datos.referencia, { timeout: 60_000 });
      const texto = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Documento de la cotizacion', texto.slice(0, 4000));
      await conResaltado(page, page.locator('body'), 'Documento', () => {
        expect(texto, 'El documento tiene que nombrar el paquete').toContain(PAQUETE.corto);
        expect(texto, 'El documento tiene que traer la referencia').toContain(datos.referencia);
        expect(texto, 'El documento tiene que traer los terminos de la cotizacion').toContain(datos.terminos);
        expect(texto.toUpperCase(), 'El total del documento tiene que ser el del itinerario').toContain(`TOTAL ${totalComoSeVe}`.toUpperCase());
        // US 5107: "descargar el PDF desde Cotizaciones -> mismos precios que en pantalla".
        expect(texto.toUpperCase(), 'La habitacion del documento tiene que ser la del itinerario').toContain(`DBL ${importesArmados.at(-3)}`.toUpperCase());
        expect(texto.toUpperCase(), 'Los servicios del documento tienen que ser los del itinerario').toContain(`SERVICIOS ${importesArmados.at(-2)}`.toUpperCase());
      });
    });

    await paso(page, 'El PDF y el Word de la cotizacion se descargan', async () => {
      // El PDF ya no es una descarga: "Descargar en PDF" abre el documento para imprimir y la
      // pagina indica elegir "Guardar como PDF" en el dialogo de impresion del navegador (en
      // el portal actual bajaba el archivo). Se exige lo que ofrece: el documento de esta
      // cotizacion, listo para imprimir.
      const fila = await filaDelHistorial(page, datos.referencia);
      const [ventana] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 15_000 }).catch(() => null),
        fila.getByRole('link', { name: 'Descargar en PDF' }).click(),
      ]);
      const impresion = ventana ?? page;
      await expect(impresion, '"Descargar en PDF" tiene que abrir el documento para imprimir').toHaveURL(new RegExp(`/quotes/${quoteId}/print\\?pdf=1`), { timeout: 60_000 });
      await expect(impresion.locator('body'), 'El documento para imprimir tiene que ser el de esta cotizacion').toContainText(datos.referencia, { timeout: 60_000 });
      const indicacion = (await impresion.locator('body').innerText()).match(/En el di[aá]logo de impresi[oó]n[^.]*\./)?.[0] ?? '';
      await adjuntarTexto('PDF', `Abre ${impresion.url()} — ${indicacion || '(sin indicacion)'}`);
      if (ventana) await ventana.close();

      // El Word sigue siendo una descarga.
      const filaWord = await filaDelHistorial(page, datos.referencia);
      const [descarga] = await Promise.all([
        page.waitForEvent('download', { timeout: 180_000 }),
        // Desde noviembre el Word es un boton (antes un link).
        filaWord.getByRole('link', { name: 'Descargar en Word' }).or(filaWord.getByRole('button', { name: 'Descargar en Word' })).first().click(),
      ]);
      const contenido = fs.readFileSync((await descarga.path())!);
      await adjuntarTexto('Descarga docx', `${descarga.suggestedFilename()} (${contenido.length} bytes)`);
      expect(descarga.suggestedFilename(), 'El Word tiene que bajar con su extension').toMatch(/\.docx$/i);
      expect(contenido.subarray(0, 2).toString('latin1'), 'El archivo tiene que ser un docx de verdad').toBe('PK');
      expect(contenido.length, 'El Word no puede venir vacio').toBeGreaterThan(5_000);
    });

    await paso(page, 'Retomar la cotizacion: el itinerario conserva el total', async () => {
      const fila = await filaDelHistorial(page, datos.referencia);
      await fila.getByRole('link', { name: 'Editar' }).click();
      await expect(page).toHaveURL(/\/site\/custom-tours\/\d+\/detail\?quote=/, { timeout: 120_000 });
      await expect(page.getByRole('button', { name: /^(Reservar|Continuar)$/ }).last()).toBeVisible({ timeout: 120_000 });
      const opcion = await ct.opcionesDeCotizacion();
      await adjuntarTexto('Resumen del itinerario retomado', opcion.lineas.join('\n'));
      await expect(filaDeLaCena(), 'La cotizacion retomada tiene que traer la Cena Show').toBeVisible({ timeout: 60_000 });
      const combo = filaDeLaCena().getByRole('combobox', { name: 'Idioma', exact: true });
      const idiomaCena = (await combo.locator('option:checked').innerText()).trim();
      const precioCena = await precioDeLaCena();
      await adjuntarTexto('Cena Show al retomar', `Idioma ${idiomaCena} | ${precioCena.texto} (guardada en English ${cenaEnIngles})`);
      await conResaltado(page, filaDeLaCena(), 'Cena Show al retomar', () => {
        expect.soft(idiomaCena, 'La Cena Show tiene que volver con el idioma English que se eligio al armarla').toMatch(/^(English|Ingl[eé]s)$/i);
        expect.soft(precioCena.importe, 'La Cena Show tiene que volver con el precio en English con que se guardo (US 4800)').toBe(cenaEnIngles);
      });
      await conResaltado(page, page.locator('main'), 'Total al retomar', () => {
        expect(importe(opcion.total), 'La cotizacion retomada tiene que tener el mismo total que cuando se guardo').toEqual(total);
        // US 4800: "al volver a abrirla despues de guardarla, los precios tienen que ser los mismos que se mostraron al armarla".
        expect(importesDe(opcion.lineas), 'Cada hotel, la habitacion y los servicios tienen que volver con los importes con que se guardo').toEqual(importesArmados);
      });
    });

    await paso(page, 'Continuar al carrito con el mismo total (sin emitir)', async () => {
      await ct.continuarAlCarrito();
      const texto = await ct.total();
      await adjuntarTexto('Total del carrito de circuitos', texto);
      await conResaltado(page, page.locator('main'), 'Total del carrito', () => {
        expect(importe(texto), 'El carrito tiene que cobrar el total de la cotizacion').toEqual(total);
      });
    });
  });
});
