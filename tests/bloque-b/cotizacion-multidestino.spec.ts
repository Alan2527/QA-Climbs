import { test, expect, Page } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { CustomToursPage } from '../../pages/customtours.page';
import { CarritoCustomToursPage } from '../../pages/carrito-customtours.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, reiniciarNumeracionDePasos, fechaDeBusqueda, conResaltado,
} from '../../utils/pasos';
import { importeDelPortal } from './reservas-comun';

/**
 * BLOQUE B — Cotizacion de multidestino.
 *
 * Es lo que la agencia le manda al pasajero antes de vender: arma el viaje, lo guarda
 * como cotizacion, la baja en PDF o Word y, cuando el pasajero acepta, la retoma y la
 * reserva. Si se rompe, la cotizacion no vuelve con el mismo precio o no se convierte
 * en venta. Tuvo tres hotfix el 12/10 (terminos de la cotizacion, orden del carrito,
 * cotizaciones que no abrian) y no la cubria ningun test.
 *
 * Con pablo1 sobre el paquete AUTO-QA 5059:
 * 1. Arma el viaje y toma el total del itinerario.
 * 2. Lo guarda como cotizacion con referencia, pasajero y terminos propios.
 * 3. La busca en el historial por la referencia.
 * 4. El documento de la cotizacion (el que sale en PDF y Word) trae el paquete, la
 *    referencia y los terminos cargados; el PDF y el Word se descargan.
 * 5. Al retomarla, el itinerario tiene el mismo total y sigue hasta el carrito con ese
 *    total. No se emite.
 *
 * Deja en QA la cotizacion (`CT_Quote`) y su viaje (`CT_*`): el portal no tiene como
 * borrarlas y marcarlas `Deleted` no las saca del historial, solo se limpian por SQL
 * (por la referencia `AUTO-QA COT ...`).
 */
test.describe('Cotizacion de multidestino', () => {
  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  const PAQUETE = { id: '5059', ciudad: 'Buenos Aires', nombre: 'Paquete Buenos Aires y Ushuaia' };

  /** El total del resumen del itinerario: el ultimo importe del panel `.ct-sum`. */
  async function totalDelItinerario(ct: CustomToursPage) {
    const lineas = await ct.filaDeTotales();
    const conImporte = lineas.filter((c) => /[A-Z]{3}\s*\d[\d.,]*/.test(c));
    const texto = conImporte.at(-1) ?? '';
    return { lineas, texto, total: importeDelPortal(texto) };
  }

  /** La fila de la cotizacion en el historial, buscada por su referencia (unica por corrida). */
  async function filaDelHistorial(page: Page, referencia: string) {
    await page.goto(`/online/QuoteHistory.aspx?q=${encodeURIComponent(referencia)}`);
    await esperarFinDeCarga(page);
    return page.locator('.qh-row--ct').filter({ hasText: referencia });
  }

  test('Multidestino: la cotizacion guardada se descarga y al retomarla conserva el precio hasta el carrito', async ({ page }) => {
    test.setTimeout(900_000);
    const inicio = new InicioPage(page);
    const ct = new CustomToursPage(page);
    const carrito = new CarritoCustomToursPage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const datos = {
      referencia: `AUTO-QA COT ${sello}`,
      pasajero: `Pasajero Cotizacion ${sello.slice(-6)}`,
      terminos: `Terminos AUTO-QA ${sello}: tarifa sujeta a disponibilidad`,
    };
    let total = { moneda: '', valor: null as number | null };
    let totalComoSeVe = '';
    let quoteId = '';

    await paso(page, `Armar el paquete ${PAQUETE.id} y tomar el total del itinerario`, async () => {
      const panel = await inicio.abrirSolapa('multidestino');
      await ct.buscarPaquete(panel, { pais: 'Argentina', ciudad: PAQUETE.ciudad, paqueteId: PAQUETE.id });
      await ct.configurarViaje(fechaDeBusqueda(), 2, 1);
      await ct.irAlItinerario();
      const t = await totalDelItinerario(ct);
      total = t.total;
      totalComoSeVe = t.texto;
      await adjuntarTexto('Resumen del itinerario armado', t.lineas.join('\n'));
      expect(total.valor, 'El itinerario tiene que tener un total para cotizar').toBeGreaterThan(0);
    });

    await paso(page, 'Cargar referencia, pasajero y terminos y guardar la cotizacion', async () => {
      await page.locator("a[href='#config']").first().click();
      await page.locator("[id$='txtReference']").fill(datos.referencia);
      await page.locator("[id$='txtPaxName']").fill(datos.pasajero);
      await page.locator("[id$='txtTermsConditions']").fill(datos.terminos);
      // "Guardar Cotizacion" esta al pie del resumen (`.ct-sum__foot`, Detail.aspx:689-701),
      // en la solapa HOTELES & SERVICIOS: se vuelve a ella. Guarda y va al historial.
      await page.locator("a[href='#dataview']").first().click();
      await page.locator(".ct-sum__foot [id$='lnkNext']").first().click();
      await page.waitForURL(/quotehistory/i, { timeout: 120_000 });
      await esperarFinDeCarga(page);
    });

    await paso(page, 'La cotizacion figura en el historial con su referencia', async () => {
      const fila = await filaDelHistorial(page, datos.referencia);
      await conResaltado(page, fila.first(), 'Cotizacion en el historial', async () => {
        await expect(fila, `El historial tiene que listar la cotizacion ${datos.referencia}`).toHaveCount(1, { timeout: 60_000 });
        await expect(fila.first(), 'La fila tiene que mostrar el paquete cotizado').toContainText(PAQUETE.nombre);
        await expect(fila.first(), 'La fila tiene que mostrar el pasajero').toContainText(datos.pasajero);
      });
      await adjuntarTexto('Fila del historial', (await fila.first().innerText()).replace(/\s+/g, ' '));
      const editar = await fila.first().locator('a.qh-edit').getAttribute('href');
      quoteId = editar?.match(/quote=(\d+)/i)?.[1] ?? '';
      expect(quoteId, 'El link Editar tiene que llevar el numero de la cotizacion').toMatch(/^\d+$/);
    });

    await paso(page, 'El documento de la cotizacion trae el paquete, la referencia y los terminos', async () => {
      // Es el HTML del que salen el PDF y el Word (QuoteHistory.aspx.cs:447).
      await page.goto(`/online/customtours/print/customtourquote.aspx?quote=${quoteId}&lang=1`);
      await esperarFinDeCarga(page);
      const texto = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Documento de la cotizacion', texto.slice(0, 4000));
      const cuerpo = page.locator('body');
      await conResaltado(page, cuerpo, 'Documento', async () => {
        expect(texto, 'El documento tiene que nombrar el paquete').toContain(PAQUETE.nombre);
        expect(texto, 'El documento tiene que traer la referencia').toContain(datos.referencia);
        expect(texto, 'El documento tiene que traer los terminos de la cotizacion').toContain(datos.terminos);
        expect(texto, 'El total del documento tiene que ser el del itinerario').toContain(`TOTAL ${totalComoSeVe}`);
      });
    });

    await paso(page, 'El PDF y el Word de la cotizacion se descargan', async () => {
      for (const [boton, extension, firma] of [['lnkPdf', 'pdf', '%PDF'], ['lnkWord', 'docx', 'PK']] as const) {
        const fila = await filaDelHistorial(page, datos.referencia);
        const [descarga] = await Promise.all([
          page.waitForEvent('download', { timeout: 180_000 }),
          fila.first().locator(`[id$='${boton}']`).click(),
        ]);
        const ruta = await descarga.path();
        const fs = await import('fs');
        const contenido = fs.readFileSync(ruta!);
        await adjuntarTexto(`Descarga ${extension}`, `${descarga.suggestedFilename()} (${contenido.length} bytes)`);
        expect(descarga.suggestedFilename(), `El ${extension} tiene que bajar con su extension`).toMatch(new RegExp(`\\.${extension}$`, 'i'));
        expect(contenido.subarray(0, firma.length).toString('latin1'), `El archivo tiene que ser un ${extension} de verdad`).toBe(firma);
        expect(contenido.length, `El ${extension} no puede venir vacio`).toBeGreaterThan(5_000);
      }
    });

    await paso(page, 'Retomar la cotizacion: el itinerario conserva el total', async () => {
      const fila = await filaDelHistorial(page, datos.referencia);
      await fila.first().locator('a.qh-edit').click();
      await page.waitForURL(/customtours\/detail/i, { timeout: 120_000 });
      await esperarFinDeCarga(page);
      const t = await totalDelItinerario(ct);
      await adjuntarTexto('Resumen del itinerario retomado', t.lineas.join('\n'));
      await conResaltado(page, ct.tablaDeTotales(), 'Total al retomar', () => {
        expect(t.total, 'La cotizacion retomada tiene que tener el mismo total que cuando se guardo').toEqual(total);
      });
    });

    await paso(page, 'Continuar al carrito con el mismo total (sin emitir)', async () => {
      await ct.continuarAlCarrito();
      const texto = await carrito.total();
      await adjuntarTexto('Total del carrito de circuitos', texto);
      const delCarrito = importeDelPortal(texto);
      await conResaltado(page, page.locator('body'), 'Total del carrito', () => {
        expect(delCarrito, 'El carrito tiene que cobrar el total de la cotizacion').toEqual(total);
      });
    });
  });
});
