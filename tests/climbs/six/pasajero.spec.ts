import { test, expect, Page } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';
import { usarApiNueva, link, abrirLink, pasarBienvenida, escucharAutologin } from './six-comun';
import candidatos from '../../../data/candidatos.json';

const X = candidatos.six;
const H = candidatos.extensionTarifas;
const S = candidatos.tarifasServicio;

/**
 * SIX — app nueva (ClimbsApp). La app del pasajero contra la API nueva.
 *
 * Los mismos cinco tests que tests/six/pasajero.spec.ts, con los mismos titulos y los mismos
 * pasos: la app del pasajero es la de siempre, y cada pedido que le hace a la API se desvia a la
 * API mayorista de la app nueva (/api/wholesale, mismos contratos; ver six-comun.ts). Es la app
 * tal como va a quedar despues del pasaje.
 *
 * Se entra con el link de autologin del pasajero AUTO-QA del file 33379 (AMV_SIX_AUTOLOGIN_URL,
 * credencial). Si la API nueva no lo acepta, el paso de entrada lo dice con el mensaje de la API.
 * Solo lee, salvo la opinion del viaje (escribe sobre el pasajero AUTO-QA) y el idioma (vuelve a
 * espanol al terminar).
 */
test.describe('SIX — app del pasajero', () => {
  let respuestaDelAutologin: () => string = () => '';

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await usarApiNueva(page);
    respuestaDelAutologin = escucharAutologin(page);
  });

  const NUMERO_DE_RESERVA = X.fileCode.split('-').pop()!; // AMV-AR-30161 -> 30161
  const SERVICIO = S.nombre;
  const HOTEL = H.hotelNombre;

  /** Entra con el link y deja la app en el inicio del viaje. */
  async function entrar(page: Page) {
    await abrirLink(page, link(), /\/dashboard|\/login/i);
    expect(new URL(page.url()).pathname, `Con un link valido la app tiene que entrar al viaje. La API nueva respondio al autologin: ${respuestaDelAutologin()}`).toMatch(/^\/dashboard/);
    await pasarBienvenida(page);
    await expect(page.getByRole('button', { name: /Voucher/ }), 'El inicio del viaje tiene que cargar').toBeVisible({ timeout: 60_000 });
  }

  /** Texto visible de la pantalla, en una linea. */
  const textoDe = async (page: Page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');

  test('Pasajero: con el link entra a su viaje y el itinerario trae lo del file', async ({ page }) => {
    test.setTimeout(300_000);

    await paso(page, 'Entrar con el link de autologin y llegar al inicio del viaje', async () => {
      // El link no se adjunta ni se loguea: es la credencial del pasajero.
      await abrirLink(page, link(), /\/dashboard|\/login/i);
      expect(new URL(page.url()).pathname, `Con un link valido la app tiene que entrar al viaje, no volver al login. La API nueva respondio al autologin: ${respuestaDelAutologin()}`)
        .toMatch(/^\/dashboard/);
      await pasarBienvenida(page);
      await expect(page.getByRole('button', { name: 'Ver itinerario' }), 'El inicio del viaje tiene que cargar')
        .toBeVisible({ timeout: 60_000 });
    });

    await paso(page, 'El inicio muestra al pasajero, la reserva, las fechas y lo que compro', async () => {
      const cuerpo = page.locator('body');
      const texto = (await cuerpo.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Inicio del viaje', texto.slice(0, 2000));
      await conResaltado(page, cuerpo, 'Inicio del viaje', () => {
        expect(texto, 'Tiene que saludar al pasajero por su nombre').toContain('¡Hola, PasajeroSix!');
        expect(texto, 'Tiene que mostrar el numero de reserva del file').toContain(`Reserva ${NUMERO_DE_RESERVA}`);
        expect(texto, 'Tiene que mostrar las fechas del viaje').toMatch(/Lun 13 ene\s*–\s*Mié 15 ene · 3 días/);
        expect(texto, 'Tiene que mostrar el destino').toContain('Buenos Aires');
        expect(texto, 'Tiene que mostrar la excursion del file').toContain(SERVICIO);
        expect(texto, 'Tiene que mostrar el hotel del file').toContain(HOTEL);
      });
      await expect(page.getByRole('button', { name: 'Voucher' }), 'Tiene que ofrecer el voucher').toBeVisible();
    });

    await paso(page, 'Ver itinerario: el dia trae el pickup, la excursion y el hotel', async () => {
      await page.getByRole('button', { name: 'Ver itinerario' }).click();
      await page.waitForURL(/\/dashboard\/itinerary/i, { timeout: 60_000 });
      await expect(page.getByText(SERVICIO).first(), 'El itinerario tiene que cargar los servicios').toBeVisible({ timeout: 60_000 });
      const cuerpo = page.locator('body');
      const texto = (await cuerpo.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Itinerario', texto.slice(0, 2000));
      await conResaltado(page, cuerpo, 'Itinerario', () => {
        expect(texto, 'El itinerario tiene que ser el de la reserva del file').toContain(`Reserva ${NUMERO_DE_RESERVA}`);
        expect(texto, 'Tiene que mostrar el primer dia del viaje').toContain('Lunes 13 de enero');
        expect(texto, 'Tiene que mostrar el horario de pickup de la excursion').toMatch(/08:55\s*Pickup/);
        expect(texto, 'Tiene que mostrar la excursion').toContain(SERVICIO);
        expect(texto, 'Tiene que mostrar el hotel').toContain(HOTEL);
        expect(texto, 'Cada item es para los dos pasajeros del file').toContain('2 Personas');
      });
    });
  });

  test('Pasajero: con un token adulterado no entra y vuelve al login', async ({ page }) => {
    test.setTimeout(120_000);
    await paso(page, 'Entrar con el link alterado: la app tiene que mandar al login', async () => {
      const valido = new URL(link());
      const token = valido.searchParams.get('token') ?? '';
      // Se cambia el ultimo caracter de la firma: el token sigue teniendo forma valida.
      const ultimo = token.slice(-1);
      const alterado = token.slice(0, -1) + (ultimo === 'A' ? 'B' : 'A');
      await abrirLink(page, `${valido.origin}/autologin?token=${encodeURIComponent(alterado)}`, /\/login|\/dashboard/i);
      expect(new URL(page.url()).pathname, 'Con un token que no valida la app no puede entrar al viaje').toMatch(/^\/login/);
    });
  });

  /**
   * El voucher es el PDF que el pasajero presenta en destino. Lo arma la app en el
   * navegador (jsPDF, `VoucherModel.DownloadPDF`) y lo baja como MyVoucher-<file>.pdf.
   *
   * ROJO CONOCIDO (14/10): no se descarga. La API manda `FlightNumber: null` para los
   * servicios sin vuelo cargado (`AppItineraryManager.cs:370`) y la app lo escribe con
   * `pdf.text(55, y, flightNumber)`: con null jsPDF corta con `Type of text must be
   * string or Array. "55" is not recognized.` y no sale nada, ni un aviso. Medido en
   * QA: 161 de 25.647 servicios de files con pasajero de SIX tienen el detalle con el
   * vuelo en null. Se deja en rojo hasta que se corrija.
   */
  test('Pasajero: el voucher se descarga en PDF', async ({ page }) => {
    test.setTimeout(240_000);
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message.split(String.fromCharCode(10))[0]));

    await paso(page, 'Entrar al viaje', async () => {
      await entrar(page);
    });

    await paso(page, 'Voucher: se descarga un PDF con el codigo del file', async () => {
      const descarga = page.waitForEvent('download', { timeout: 60_000 }).catch(() => null);
      await page.getByRole('button', { name: /Voucher/ }).click();
      const d = await descarga;
      await adjuntarTexto('Errores de la app al pedir el voucher', errores.join(String.fromCharCode(10)) || 'ninguno');
      expect(d, `Al tocar Voucher tiene que descargarse el PDF. La app lanzo: ${errores.join(' | ') || 'ningun error'}`).not.toBeNull();
      const fs = await import('fs');
      const contenido = fs.readFileSync((await d!.path())!);
      await adjuntarTexto('Voucher descargado', `${d!.suggestedFilename()} (${contenido.length} bytes)`);
      expect(d!.suggestedFilename(), 'El voucher se nombra con el codigo del file').toContain(X.fileCode);
      expect(contenido.subarray(0, 4).toString('latin1'), 'Tiene que ser un PDF de verdad').toBe('%PDF');
    });
  });

  /**
   * Idioma: el pasajero elige ingles en Perfil > Cambiar idioma y el viaje se le muestra
   * en ingles (textos de la app y el itinerario, que se pide con langId=2). Al final
   * vuelve a espanol, aunque falle, porque los otros tests leen los textos en espanol.
   */
  test('Pasajero: al pasar a ingles el inicio y el itinerario salen en ingles', async ({ page }) => {
    test.setTimeout(300_000);
    const origen = () => new URL(link()).origin;
    const elegirIdioma = async (nombre: RegExp) => {
      await page.goto(`${origen()}/dashboard/language`);
      await page.getByRole('button', { name: nombre }).click();
      await page.waitForLoadState('networkidle').catch(() => {});
    };

    await paso(page, 'Entrar al viaje', async () => {
      await entrar(page);
    });

    try {
      await paso(page, 'Perfil > Cambiar idioma: elegir English', async () => {
        await elegirIdioma(/English/);
      });

      await paso(page, 'El inicio sale en ingles', async () => {
        await page.goto(`${origen()}/dashboard`);
        await expect(page.getByRole('button', { name: 'View itinerary' }), 'El inicio tiene que estar en ingles').toBeVisible({ timeout: 60_000 });
        const texto = await textoDe(page);
        await adjuntarTexto('Inicio en ingles', texto.slice(0, 1500));
        await conResaltado(page, page.locator('body'), 'Inicio en ingles', () => {
          expect(texto, 'El saludo en ingles').toContain('Hi, PasajeroSix!');
          expect(texto, 'La reserva en ingles').toContain(`Booking ${NUMERO_DE_RESERVA}`);
          expect(texto, 'Las fechas en ingles').toMatch(/Mon Jan 13\s*–\s*Wed Jan 15 · 3 days/);
        });
      });

      await paso(page, 'El itinerario sale en ingles', async () => {
        await page.getByRole('button', { name: 'View itinerary' }).click();
        await page.waitForURL(/\/dashboard\/itinerary/i, { timeout: 60_000 });
        await expect(page.getByText(SERVICIO).first(), 'El itinerario tiene que cargar').toBeVisible({ timeout: 60_000 });
        const texto = await textoDe(page);
        await adjuntarTexto('Itinerario en ingles', texto.slice(0, 1500));
        await conResaltado(page, page.locator('body'), 'Itinerario en ingles', () => {
          expect(texto, 'El dia en ingles').toContain('Monday January 13');
          expect(texto, 'El pickup en ingles').toMatch(/08:55\s*Pick up/);
        });
      });
    } finally {
      await paso(page, 'Volver a espanol', async () => {
        await elegirIdioma(/Español/);
        await page.goto(`${origen()}/dashboard`);
        await expect(page.getByText('¡Hola, PasajeroSix!'), 'Tiene que quedar en espanol').toBeVisible({ timeout: 60_000 });
      });
    }
  });

  /**
   * Opinion del viaje (`/dashboard/tripreview`): el puntaje y el comentario se guardan
   * (POST survey/tripReview) y al volver se ven. Se puede cambiar cuando se quiera, asi
   * que cada corrida alterna entre 4 y 5 estrellas para que el cambio se note. Escribe
   * solo sobre el pasajero AUTO-QA.
   */
  test('Pasajero: la opinion del viaje se guarda y al volver se ve lo que dejo', async ({ page }) => {
    test.setTimeout(300_000);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const comentario = `Opinion AUTO-QA ${sello}`;
    let elegido = { nombre: 'Muy bueno', puntaje: 4 };

    await paso(page, 'Entrar al viaje y abrir la opinion', async () => {
      await entrar(page);
      await page.getByRole('button', { name: /Opinar sobre el viaje|Tu opinión/ }).first().click();
      await page.waitForURL(/\/dashboard\/tripreview/i, { timeout: 60_000 });
      await expect(page.getByRole('radio', { name: 'Muy bueno' })).toBeVisible({ timeout: 60_000 });
      const actual = await page.getByRole('radio', { name: 'Muy bueno' }).getAttribute('aria-checked');
      elegido = actual === 'true' ? { nombre: '¡Excelente!', puntaje: 5 } : { nombre: 'Muy bueno', puntaje: 4 };
      await adjuntarTexto('Puntaje', `antes: ${actual === 'true' ? 'Muy bueno' : 'otro o ninguno'} -> se elige ${elegido.nombre} (${elegido.puntaje})`);
    });

    await paso(page, 'Calificar con un comentario y enviar', async () => {
      await page.getByRole('radio', { name: elegido.nombre }).click();
      await page.locator('textarea').first().fill(comentario);
      await page.getByRole('button', { name: 'Enviar' }).click();
      await expect(page.getByText('¡Gracias, PasajeroSix!'), 'Al enviar tiene que agradecer').toBeVisible({ timeout: 60_000 });
    });

    await paso(page, 'El inicio muestra el puntaje que dejo', async () => {
      await page.goto(`${new URL(link()).origin}/dashboard`);
      await expect(page.getByText(`${elegido.puntaje} · Tu opinión`), 'El inicio tiene que mostrar el puntaje guardado').toBeVisible({ timeout: 60_000 });
    });

    await paso(page, 'Al volver a la opinion se ven el puntaje y el comentario guardados', async () => {
      await page.getByRole('button', { name: /Tu opinión/ }).first().click();
      await page.waitForURL(/\/dashboard\/tripreview/i, { timeout: 60_000 });
      const radio = page.getByRole('radio', { name: elegido.nombre });
      await conResaltado(page, page.locator('body'), 'Opinion guardada', async () => {
        await expect(radio, 'Tiene que quedar marcado el puntaje enviado').toHaveAttribute('aria-checked', 'true', { timeout: 30_000 });
        await expect(page.locator('textarea').first(), 'Tiene que quedar el comentario enviado').toHaveValue(comentario);
      });
    });
  });
});
