import { test, expect, Page } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { CustomToursPage } from '../../pages/customtours.page';
import { CarritoCustomToursPage } from '../../pages/carrito-customtours.page';
import { ModalesCustomToursPage } from '../../pages/customtours-modales.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, reiniciarNumeracionDePasos, fechaDeBusqueda, conResaltado,
} from '../../utils/pasos';
import { importeDelPortal, serviciosDelItinerario } from './reservas-comun';
import { fechaDelPaquete } from '../climbs/reservas/reservas-comun';
import candidatos from '../../data/candidatos.json';
import { conBackofficeNuevo, exigirServiciosDelCircuito, exigirHotelesDelCircuito, costosDelServicio, tarifaVigente, precioEsperado } from '../../utils/markups';

const CENA = candidatos.tarifario.cenaShow;
/** Markup de servicios de la agencia de pablo1: el del precio de cada servicio del itinerario (US 4800). */
const MARKUP_AGENCIA = candidatos._usuarioTest.markupsDeLaAgencia.servicio;

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

  /** Los importes del resumen (cada hotel, la habitacion, los servicios y el total), en orden. */
  const importesDe = (lineas: string[]) => lineas.filter((c) => /^[A-Z]{3}\s*\d[\d.,]*$/.test(c));

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
    const mod = new ModalesCustomToursPage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const datos = {
      referencia: `AUTO-QA COT ${sello}`,
      pasajero: `Pasajero Cotizacion ${sello.slice(-6)}`,
      terminos: `Terminos AUTO-QA ${sello}: tarifa sujeta a disponibilidad`,
    };
    let total = { moneda: '', valor: null as number | null };
    let totalComoSeVe = '';
    let quoteId = '';
    let importesArmados: string[] = [];
    // Como en circuitos: en diciembre el traslado del paquete no opera y el Park Hyatt no tiene tarifa en las fiestas.
    const fecha = fechaDelPaquete();

    await paso(page, `Armar el paquete ${PAQUETE.id} y tomar el total del itinerario`, async () => {
      const panel = await inicio.abrirSolapa('multidestino');
      await ct.buscarPaquete(panel, { pais: 'Argentina', ciudad: PAQUETE.ciudad, paqueteId: PAQUETE.id });
      await ct.configurarViaje(fecha, 2, 1);
      await ct.irAlItinerario();
      const t = await totalDelItinerario(ct);
      total = t.total;
      totalComoSeVe = t.texto;
      importesArmados = importesDe(t.lineas);
      await adjuntarTexto('Resumen del itinerario armado', t.lineas.join('\n'));
      expect(total.valor, 'El itinerario tiene que tener un total para cotizar').toBeGreaterThan(0);
    });

    await paso(page, 'Cada servicio y cada hotel de la cotizacion cuesta lo que sale de su tarifa', async () => {
      // US 4800: el precio de cada servicio y de cada hotel de la cotizacion "tiene que calcularse con
      // el markup de servicios" / "de hoteles" de la agencia (el CustomMarkup del usuario no entra).
      const { lineas } = await totalDelItinerario(ct);
      const filas = await serviciosDelItinerario(page);
      const mk = candidatos._usuarioTest.markupsDeLaAgencia;
      const { servicios, hoteles } = await conBackofficeNuevo(page.context().browser()!, async (bo) => ({
        servicios: await exigirServiciosDelCircuito(bo, filas, mk.servicio),
        hoteles: await exigirHotelesDelCircuito(bo, lineas, fecha, 2, mk.hotel),
      }));
      await adjuntarTexto('Importes de los servicios contra el costo', servicios.join('\n'));
      await adjuntarTexto('Importes de los hoteles contra los cortes', hoteles.join('\n'));
      await conResaltado(page, ct.tablaDeTotales(), 'Importes de la cotizacion', () => {
        expect.soft(servicios.filter((l) => !l.startsWith('OK')), 'Cada servicio tiene que costar techo(costo / cotizacion / markup) por pasajero').toEqual([]);
        expect.soft(hoteles.filter((l) => !l.startsWith('OK')), 'Cada hotel tiene que costar techo(cortes DBL de sus noches x pax / markup)').toEqual([]);
      });
    });

    let idCena = '';
    let cenaEnIngles: { texto: string; valor: number | null } = { texto: '', valor: null };
    await paso(page, `Agregar la Cena Show (${CENA.id}) y elegir English en su fila: el recargo por idioma lleva el markup (US 4739)`, async () => {
      const tarifas = await conBackofficeNuevo(page.context().browser()!, (bo) => costosDelServicio(bo, CENA.id));
      const tarifa = tarifaVigente(tarifas, 'Regular', fecha, 2);
      expect(tarifa, `${CENA.nombre} tiene que tener tarifa Regular vigente el ${fecha.toLocaleDateString('es-AR')}`).toBeDefined();
      const recargo = tarifa!.recargos.find((r) => /^(English|Ingl[eé]s)$/i.test(r.idioma));
      expect(recargo, `La tarifa Regular de ${CENA.nombre} tiene que tener recargo para English`).toBeDefined();

      await mod.abrirModalDeServicios();
      await mod.buscarServicio({ termino: CENA.terminoBusqueda });
      const tarjeta = (await mod.tarjetas())[String(CENA.id)];
      expect(tarjeta?.regular, `El modal tiene que ofrecer ${CENA.nombre} en Regular`).toBeGreaterThan(0);
      const precioTarjeta = tarjeta.regular as number;
      await mod.elegirServicio(String(CENA.id), 'regular');
      const antes = await mod.idsDeServicios();
      await mod.confirmarServicios();
      await expect.poll(async () => (await mod.idsDeServicios()).length, { message: 'El itinerario tiene que sumar la Cena Show', timeout: 120_000 }).toBe(antes.length + 1);
      idCena = (await mod.idsDeServicios()).find((id) => !antes.includes(id))!;
      await mod.esperarCalma();
      await mod.cerrarAvisoDeVariacion();
      const fila = () => mod.filaDeServicio(idCena);
      const enEspanol = await mod.precioDeServicio(fila());
      const totalEspanol = (await totalDelItinerario(ct)).total;

      const combo = fila().locator('.ct-pill--lang select');
      await expect(combo, 'La fila de la Cena Show tiene que tener el combo Idioma').toBeVisible();
      const opciones = (await combo.locator('option').allInnerTexts()).map((o) => o.trim());
      const ingles = opciones.find((o) => /^(English|Ingl[eé]s)$/i.test(o));
      expect(ingles, `El combo Idioma tiene que ofrecer English. Ofrece: ${opciones.join(', ')}`).toBeDefined();
      await combo.selectOption({ label: ingles! });
      await mod.esperarCalma(60_000);
      await mod.cerrarAvisoDeVariacion();
      await expect.poll(async () => (await mod.precioDeServicio(fila())).valor, { message: 'La fila tiene que recalcular el precio al elegir English', timeout: 60_000 })
        .not.toBe(enEspanol.valor);
      cenaEnIngles = await mod.precioDeServicio(fila());
      const t = await totalDelItinerario(ct);

      const recargoPax = recargo!.tipo === 'porcentaje' ? tarifa!.costo! * recargo!.valor / 100 : recargo!.tipo === 'porPasajero' ? recargo!.valor : recargo!.valor / 2;
      const espanolEsperado = precioEsperado(tarifa!.costo!, tarifa!.moneda, MARKUP_AGENCIA)! * 2;
      const inglesEsperado = precioEsperado(tarifa!.costo! + recargoPax, tarifa!.moneda, MARKUP_AGENCIA)! * 2;
      const subio = (cenaEnIngles.valor ?? 0) - (enEspanol.valor ?? 0);
      await adjuntarTexto('Cena Show en English', [
        `Tarifa del BackOffice: ${tarifa!.vigencia} | ${tarifa!.moneda} ${tarifa!.costo} | recargos ${JSON.stringify(tarifa!.recargos)}`,
        `Tarjeta del modal: ${precioTarjeta}`,
        `Fila: Espanol ${enEspanol.texto} -> English ${cenaEnIngles.texto} (subio ${subio})`,
        `Esperado: Espanol techo(${tarifa!.costo} / ${MARKUP_AGENCIA}) x 2 = ${espanolEsperado}; English techo((${tarifa!.costo} + ${recargoPax}) / ${MARKUP_AGENCIA}) x 2 = ${inglesEsperado}`,
        `Total del itinerario: ${totalEspanol.valor} -> ${t.total.valor}`,
      ].join('\n'));
      await conResaltado(page, fila(), 'Cena Show en English', () => {
        expect(enEspanol.valor, 'En Espanol la fila tiene que tener el precio de la tarjeta del modal').toBe(precioTarjeta);
        expect.soft(enEspanol.valor, `En Espanol la fila tiene que ser techo(costo / markup de la agencia) x 2 = ${espanolEsperado}`).toBe(espanolEsperado);
        expect.soft(cenaEnIngles.valor, `En English la fila tiene que ser techo((costo + recargo) / markup de la agencia) x 2 = ${inglesEsperado} (US 4739)`).toBe(inglesEsperado);
        expect.soft((t.total.valor ?? 0) - (totalEspanol.valor ?? 0), 'El total del itinerario tiene que subir lo mismo que la fila').toBe(subio);
      });
      // La cotizacion se guarda con la Cena en English: lo que se compara despues es este total.
      total = t.total;
      totalComoSeVe = t.texto;
      importesArmados = importesDe(t.lineas);
      await adjuntarTexto('Resumen del itinerario con la Cena en English', t.lineas.join('\n'));
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
        // US 5107: "descargar el PDF desde Cotizaciones -> mismos precios que en pantalla".
        expect(texto, 'La habitacion del documento tiene que ser la del itinerario').toContain(`DBL ${importesArmados.at(-3)}`);
        expect(texto, 'Los servicios del documento tienen que ser los del itinerario').toContain(`SERVICIOS ${importesArmados.at(-2)}`);
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
      const filaCena = mod.filaDeServicio(idCena);
      await expect(filaCena, 'La cotizacion retomada tiene que traer la Cena Show').toBeVisible({ timeout: 60_000 });
      const idiomaCena = (await filaCena.locator('.ct-pill--lang select option:checked').innerText()).trim();
      const precioCena = await mod.precioDeServicio(filaCena);
      await adjuntarTexto('Cena Show al retomar', `Idioma ${idiomaCena} | ${precioCena.texto} (guardada en English ${cenaEnIngles.texto})`);
      await conResaltado(page, filaCena, 'Cena Show al retomar', () => {
        expect.soft(idiomaCena, 'La Cena Show tiene que volver con el idioma English que se eligio al armarla').toMatch(/^(English|Ingl[eé]s)$/i);
        expect.soft(precioCena.valor, 'La Cena Show tiene que volver con el precio en English con que se guardo (US 4800)').toBe(cenaEnIngles.valor);
      });
      await conResaltado(page, ct.tablaDeTotales(), 'Total al retomar', () => {
        expect(t.total, 'La cotizacion retomada tiene que tener el mismo total que cuando se guardo').toEqual(total);
        // US 4800: "al volver a abrirla despues de guardarla, los precios tienen que ser los mismos que se mostraron al armarla".
        expect(importesDe(t.lineas), 'Cada hotel, la habitacion y los servicios tienen que volver con los importes con que se guardo').toEqual(importesArmados);
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
