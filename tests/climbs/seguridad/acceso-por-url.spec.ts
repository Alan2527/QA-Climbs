import { test, expect, Page, BrowserContext } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';
import { textoDelDocx } from '../../../utils/docx';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import { abrirYBuscarMarcas, filasDeReservas, filasDeCotizaciones, marcasPresentes } from '../comun/historial-del-portal';

/**
 * SEGURIDAD — app nueva (ClimbsApp). Acceso a reservas y cotizaciones escribiendo la URL a mano.
 *
 * Las mismas cuatro pruebas que tests/seguridad/acceso-por-url.spec.ts, con los mismos titulos,
 * contra el portal nuevo (`/site`): que alguien escriba a mano la direccion del detalle de una
 * reserva o del documento de una cotizacion con el numero de OTRA agencia (o sin estar logueado)
 * y vea el contenido. Si se ve, es una fuga de datos personales y comerciales de terceros.
 *
 * Criterio (el de Alan): si bloquea o no deja ver nada, pasa; si se ve el contenido, rojo.
 *
 * Sesiones: la de la suite (pablo, agencia 1) hace de duena y aporta la reserva y la cotizacion
 * reales con sus marcas; autoqa.markups (agencia 6334) es la ajena; y un contexto sin login, el
 * visitante anonimo. El Word de la cotizacion se descarga (.docx): se pide su direccion con las
 * cookies de cada sesion, como al escribirla en el navegador, y se busca en su texto.
 * Solo lee: no emite, no cancela ni guarda nada.
 */
test.describe('Seguridad — acceso a reservas y cotizaciones por URL', () => {
  let contextoAjeno: BrowserContext;
  let ajena: Page;
  let contextoAnonimo: BrowserContext;
  let anonimo: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto: contextoAjeno, pagina: ajena } = await abrirSesionDeOtraAgencia(browser, baseURL));
    contextoAnonimo = await browser.newContext({ baseURL, locale: 'es-AR', viewport: { width: 1920, height: 1080 }, storageState: { cookies: [], origins: [] } });
    anonimo = await contextoAnonimo.newPage();
  });

  test.afterAll(async () => {
    await contextoAjeno?.close();
    await contextoAnonimo?.close();
  });

  test.beforeEach(() => reiniciarNumeracionDePasos());

  let reserva: { id: string; codigo: string; referencia: string; marcas: string[] } | null = null;

  /** La reserva mas reciente de pablo y las marcas de su detalle (codigo, referencia, pasajeros). */
  async function reservaDePablo(page: Page) {
    if (reserva) return reserva;
    let filas = await filasDeReservas(page, 'AUTO-QA');
    if (!filas.length) filas = await filasDeReservas(page);
    const primera = filas[0];
    expect(primera, 'pablo tiene que tener al menos una reserva en el historial del ultimo anio').toBeTruthy();
    await page.goto(`/site/bookings/${primera.id}`);
    await expect(page.getByRole('heading', { level: 1 }), 'pablo tiene que ver el detalle de su propia reserva').toContainText(primera.codigo, { timeout: 60_000 });
    const lineas = (await page.locator('main').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
    const pasajeros = lineas.filter((_, i) => /^pasaporte$/i.test(lineas[i + 1] ?? ''));
    const i = lineas.findIndex((l) => /^referencia$/i.test(l));
    const referencia = /^AUTO-QA/i.test(primera.titulo) ? primera.titulo : (i >= 0 ? lineas[i + 1] : '');
    expect(pasajeros.length, 'El detalle propio tiene que listar al menos un pasajero (es lo que se busca en el ajeno)').toBeGreaterThan(0);
    reserva = { id: primera.id, codigo: primera.codigo, referencia, marcas: [primera.codigo, referencia, ...pasajeros].filter(Boolean) };
    return reserva;
  }

  let cotizacion: { id: string; codigo: string; pdf: string; word: string; marcas: string[] } | null = null;

  async function cotizacionDePablo(page: Page) {
    if (cotizacion) return cotizacion;
    let filas = await filasDeCotizaciones(page, 'AUTO-QA COT');
    if (!filas.length) filas = await filasDeCotizaciones(page);
    const primera = filas[0];
    expect(primera, 'pablo tiene que tener al menos una cotizacion de multidestino en su historial').toBeTruthy();
    expect(primera.pdf, 'La fila tiene que ofrecer el PDF de la cotizacion').not.toBe('');
    expect(primera.word, 'La fila tiene que ofrecer el Word de la cotizacion').not.toBe('');
    cotizacion = { id: primera.id, codigo: primera.codigo, pdf: primera.pdf, word: primera.word,
      marcas: [primera.codigo, primera.referencia, primera.pasajero].filter(Boolean) };
    return cotizacion;
  }

  /** Pide el Word con las cookies de la sesion de esa pagina, como al escribir la direccion. */
  async function textoDelWord(page: Page, url: string): Promise<{ estado: number; tipo: string; texto: string }> {
    const r = await page.request.get(url);
    const tipo = r.headers()['content-type'] ?? '';
    const cuerpo = await r.body();
    const texto = /word|officedocument|octet-stream/i.test(tipo) ? textoDelDocx(cuerpo) : cuerpo.toString('utf8');
    return { estado: r.status(), tipo, texto: texto.replace(/\s+/g, ' ') };
  }

  // ======================================================================== 1
  test('Una agencia no puede ver por URL la reserva de otra agencia', async ({ page }) => {
    test.setTimeout(300_000);
    let propia: NonNullable<typeof reserva>;

    await paso(page, 'pablo1 (agencia duena): tomar su reserva reciente y leer las marcas de su detalle', async () => {
      propia = await reservaDePablo(page);
      await adjuntarTexto('Reserva de pablo1', JSON.stringify(propia, null, 1));
    });

    await paso(ajena, 'autoqa.markups (otra agencia): abrir esa reserva por URL directa no tiene que mostrar nada de pablo1', async () => {
      const { estado, urlFinal, contenido, encontradas } = await abrirYBuscarMarcas(ajena, `/site/bookings/${propia.id}`, propia.marcas);
      await adjuntarTexto('Detalle ajeno', `HTTP ${estado}\nURL final: ${urlFinal}\nMarcas de pablo1 que se ven: ${encontradas.join(' | ') || 'ninguna'}\n\n${contenido.slice(0, 3000)}`);
      await conResaltado(ajena, ajena.locator('body'), 'Reserva ajena por URL', () => {
        expect(encontradas, `Otra agencia no tiene que poder ver el detalle de la reserva ${propia.codigo} de pablo1 (se ven: ${encontradas.join(', ')})`).toHaveLength(0);
      });
    });
  });

  // ======================================================================== 2
  test('Una agencia no puede ver por URL la cotizacion de otra agencia', async ({ page }) => {
    test.setTimeout(300_000);
    let cot: { id: string; codigo: string; pdf: string; marcas: string[] };

    await paso(page, 'pablo1 (agencia duena): tomar su cotizacion reciente y verificar que su PDF muestra las marcas', async () => {
      const c = await cotizacionDePablo(page);
      const propio = await abrirYBuscarMarcas(page, c.pdf, c.marcas);
      await adjuntarTexto('Cotizacion de pablo1', `${JSON.stringify(c, null, 1)}\n\nPDF propio: HTTP ${propio.estado}, marcas visibles: ${propio.encontradas.join(' | ') || 'ninguna'}`);
      expect(propio.encontradas.length, 'El documento propio de la cotizacion tiene que mostrar sus marcas para poder compararlo con el ajeno').toBeGreaterThan(0);
      cot = { id: c.id, codigo: c.codigo, pdf: c.pdf, marcas: propio.encontradas };
    });

    await paso(ajena, 'autoqa.markups (otra agencia): abrir el documento de esa cotizacion por URL directa no tiene que mostrar nada de pablo1', async () => {
      const { estado, urlFinal, contenido, encontradas } = await abrirYBuscarMarcas(ajena, cot.pdf, cot.marcas);
      await adjuntarTexto('Documento ajeno', `HTTP ${estado}\nURL final: ${urlFinal}\nMarcas de pablo1 que se ven: ${encontradas.join(' | ') || 'ninguna'}\n\n${contenido.slice(0, 3000)}`);
      await conResaltado(ajena, ajena.locator('body'), 'Cotizacion ajena por URL', () => {
        expect(encontradas, `Otra agencia no tiene que poder ver el documento de la cotizacion ${cot.codigo} de pablo1 (se ven: ${encontradas.join(', ')})`).toHaveLength(0);
      });
    });
  });

  // ======================================================================== 3
  test('Un usuario sin sesion no puede ver por URL una reserva', async ({ page }) => {
    test.setTimeout(300_000);
    let propia: NonNullable<typeof reserva>;

    await paso(page, 'pablo1 (agencia duena): tomar su reserva reciente y leer las marcas de su detalle', async () => {
      propia = await reservaDePablo(page);
      await adjuntarTexto('Reserva de pablo1', JSON.stringify(propia, null, 1));
    });

    await paso(anonimo, 'Sin iniciar sesion: abrir esa reserva por URL directa no tiene que mostrar nada y tiene que mandar al login', async () => {
      const { estado, urlFinal, contenido, encontradas } = await abrirYBuscarMarcas(anonimo, `/site/bookings/${propia.id}`, propia.marcas);
      await adjuntarTexto('Detalle sin sesion', `HTTP ${estado}\nURL final: ${urlFinal}\nMarcas de pablo1 que se ven: ${encontradas.join(' | ') || 'ninguna'}\n\n${contenido.slice(0, 3000)}`);
      await conResaltado(anonimo, anonimo.locator('body'), 'Reserva sin sesion por URL', () => {
        expect(encontradas, `Sin sesion no tiene que poder verse el detalle de la reserva ${propia.codigo} (se ven: ${encontradas.join(', ')})`).toHaveLength(0);
        const rutaFinal = new URL(urlFinal).pathname;
        expect(!/\/site\/bookings\/\d+/.test(rutaFinal), `Sin sesion, la URL de la reserva tiene que redirigir fuera del detalle (ruta final: ${rutaFinal})`).toBe(true);
      });
    });
  });

  // ======================================================================== 4
  test('Una agencia no puede ver por URL el Word de la cotizacion de otra agencia', async ({ page }) => {
    test.setTimeout(300_000);
    let cot: { codigo: string; word: string; marcas: string[] };

    await paso(page, 'pablo1 (agencia duena): su Word de la cotizacion muestra las marcas', async () => {
      const c = await cotizacionDePablo(page);
      const propio = await textoDelWord(page, c.word);
      const encontradas = marcasPresentes(propio.texto, c.marcas);
      await adjuntarTexto('Word propio de pablo1', `HTTP ${propio.estado} (${propio.tipo}), marcas visibles: ${encontradas.join(' | ') || 'ninguna'}`);
      expect(encontradas.length, 'El Word propio de la cotizacion tiene que mostrar sus marcas para poder compararlo con el ajeno').toBeGreaterThan(0);
      cot = { codigo: c.codigo, word: c.word, marcas: encontradas };
    });

    await paso(ajena, 'autoqa.markups (otra agencia): abrir el Word de esa cotizacion por URL directa no tiene que mostrar nada de pablo1', async () => {
      const ajeno = await textoDelWord(ajena, cot.word);
      const encontradas = marcasPresentes(ajeno.texto, cot.marcas);
      await adjuntarTexto('Word ajeno', `HTTP ${ajeno.estado} (${ajeno.tipo})\nMarcas de pablo1 que se ven: ${encontradas.join(' | ') || 'ninguna'}\n\n${ajeno.texto.slice(0, 2000)}`);
      expect(encontradas, `Otra agencia no tiene que poder ver el Word de la cotizacion ${cot.codigo} de pablo1 (se ven: ${encontradas.join(', ')})`).toHaveLength(0);
    });
  });
});
