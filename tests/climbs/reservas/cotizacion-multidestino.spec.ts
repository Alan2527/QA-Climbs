import { test, expect, Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import { CircuitoNuevoPage } from '../../../pages/climbs/circuito.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, conResaltado } from '../../../utils/pasos';
import { importe, Importe } from './reservas-comun';

/**
 * RESERVAS — app nueva (ClimbsApp). Cotizacion de multidestino.
 *
 * El mismo test que tests/bloque-b/cotizacion-multidestino.spec.ts, con el mismo titulo: la
 * agencia arma el viaje, lo guarda como cotizacion, la baja en PDF o Word y, cuando el
 * pasajero acepta, la retoma y la lleva al carrito con el mismo precio. No se emite.
 *
 * Deja en QA la cotizacion y su viaje (el portal no tiene como borrarlas), con referencia
 * "AUTO-QA COT <sello>", igual que la suite actual.
 */
test.describe('Cotizacion de multidestino', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  const PAQUETE = { nombre: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)', corto: 'Paquete Buenos Aires y Ushuaia' };

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
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const datos = {
      referencia: `AUTO-QA COT ${sello}`,
      pasajero: `Pasajero Cotizacion ${sello.slice(-6)}`,
      terminos: `Terminos AUTO-QA ${sello}: tarifa sujeta a disponibilidad`,
    };
    let total: Importe = { moneda: '', valor: null };
    let totalComoSeVe = '';
    let quoteId = '';

    await paso(page, 'Armar el paquete y tomar el total del itinerario', async () => {
      await ct.buscarViaje('MULTIDESTINO', { pais: 'Argentina', ciudad: 'Buenos Aires', nombre: PAQUETE.nombre, fecha: fechaDeBusqueda() });
      await ct.configurarViaje(2, 1);
      await ct.irAlItinerario();
      const opcion = await ct.opcionesDeCotizacion();
      totalComoSeVe = opcion.total;
      total = importe(opcion.total);
      await adjuntarTexto('Resumen del itinerario armado', opcion.lineas.join('\n'));
      expect(total.valor, 'El itinerario tiene que tener un total para cotizar').toBeGreaterThan(0);
    });

    await paso(page, 'Cargar referencia, pasajero y terminos y guardar la cotizacion', async () => {
      await page.getByRole('tab', { name: 'Configuración', exact: true }).click();
      await page.getByRole('textbox', { name: 'Referencia', exact: true }).fill(datos.referencia);
      await page.getByRole('textbox', { name: 'Nombre de pasajero / grupo', exact: true }).fill(datos.pasajero);
      await page.getByRole('textbox', { name: /^Para hacer un salto de l[ií]nea/ }).fill(datos.terminos);
      // "Guardar cotizacion" esta al pie de "Opciones de cotizacion", en la solapa Hoteles y
      // servicios: se vuelve a ella. Guarda y va al historial, como en el portal actual.
      await page.getByRole('tab', { name: 'Hoteles y servicios', exact: true }).click();
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
        filaWord.getByRole('link', { name: 'Descargar en Word' }).click(),
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
      await expect(page.getByRole('button', { name: 'Reservar', exact: true }).last()).toBeVisible({ timeout: 120_000 });
      const opcion = await ct.opcionesDeCotizacion();
      await adjuntarTexto('Resumen del itinerario retomado', opcion.lineas.join('\n'));
      await conResaltado(page, page.locator('main'), 'Total al retomar', () => {
        expect(importe(opcion.total), 'La cotizacion retomada tiene que tener el mismo total que cuando se guardo').toEqual(total);
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
