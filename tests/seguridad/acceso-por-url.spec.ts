import { test, expect, Page, BrowserContext } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, reiniciarNumeracionDePasos, conResaltado,
} from '../../utils/pasos';
import { abrirSesionDeMarkups } from '../../utils/markups';

/**
 * BLOQUE SEGURIDAD — acceso a reservas y cotizaciones escribiendo la URL a mano.
 *
 * Los links del historial ya filtran lo que muestra cada agencia. Lo que se prueba
 * aca es lo otro: que alguien escriba a mano la URL del detalle de una reserva o del
 * documento de una cotizacion con el numero de OTRA agencia (o sin estar logueado) y
 * vea el contenido. El detalle trae pasajeros, pasaportes e importes; el documento de
 * la cotizacion trae el pasajero, la referencia y el precio. Si se ve, es una fuga de
 * datos personales y comerciales de terceros.
 *
 * Son tres pruebas, una por puerta:
 *  1. Agencia X abre por URL la RESERVA de la agencia Y  -> no tiene que verla.
 *  2. Agencia X abre por URL la COTIZACION de la agencia Y -> no tiene que verla.
 *  3. Un usuario SIN SESION abre por URL una reserva       -> no tiene que verla.
 *
 * Criterio (tal como lo pidio Alan): si bloquea o no deja ver nada, pasa (verde); si
 * deja entrar y se ve el contenido, esta mal (rojo). Hoy 1 y 2 estan en rojo a
 * proposito: son los hallazgos de historial confirmados por el PM (no hay validacion
 * de dueno en BookingHistoryDetail.aspx.cs ni en customtourquote.aspx.cs). Cuando se
 * corrija, pasan a verde solos.
 *
 * Dos sesiones ajenas a la de pablo1:
 *  - autoqa.markups (agencia 6334): la "agencia Y" que intenta espiar.
 *  - un contexto sin login: el visitante anonimo.
 * pablo1 (agencia 1, la sesion del proyecto) hace de agencia duena: aporta la reserva
 * y la cotizacion reales y las marcas que despues se buscan en la pantalla ajena.
 *
 * Solo lee: no emite, no cancela ni guarda nada, y no deja datos en QA.
 */
test.describe('Seguridad — acceso a reservas y cotizaciones por URL', () => {
  let contextoAjeno: BrowserContext;
  let ajena: Page;
  let contextoAnonimo: BrowserContext;
  let anonimo: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    // La agencia Y, logueada.
    ({ contexto: contextoAjeno, pagina: ajena } = await abrirSesionDeMarkups(browser, baseURL));
    // El visitante anonimo: contexto limpio, sin storageState.
    contextoAnonimo = await browser.newContext({
      baseURL,
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      storageState: { cookies: [], origins: [] },
    });
    anonimo = await contextoAnonimo.newPage();
  });

  test.afterAll(async () => {
    await contextoAjeno?.close();
    await contextoAnonimo?.close();
  });

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  // ---------------------------------------------------------------- utilidades

  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  const ddmmaaaa = (d: Date) => `${dosDigitos(d.getDate())}-${dosDigitos(d.getMonth() + 1)}-${d.getFullYear()}`;

  /** El historial de reservas de un anio entero (sino arranca en los ultimos 30 dias). */
  function urlReservas(q?: string): string {
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(desde.getDate() - 365);
    const busqueda = q ? `&q=${encodeURIComponent(q)}` : '';
    return `/online/BookingHistory.aspx?tab=booking&from=${ddmmaaaa(desde)}&to=${ddmmaaaa(hoy)}${busqueda}`;
  }

  /** El historial de cotizaciones, solapa Multidestino. */
  const urlCotizaciones = (q?: string) =>
    `/online/QuoteHistory.aspx?qtab=circuitos${q ? `&q=${encodeURIComponent(q)}` : ''}`;

  const urlDetalleReserva = (id: string) => `/online/BookingHistoryDetail.aspx?book=${id}`;
  const urlDocumentoCotizacion = (id: string) => `/online/customtours/print/customtourquote.aspx?quote=${id}&lang=1`;
  const urlDocumentoCotizacionWord = (id: string) => `/online/CustomTours/Print/CustomTourQuoteWord.aspx?quote=${id}&lang=1`;

  type FilaReserva = { codigo: string; id: string; agencia: string; titulo: string; texto: string };
  type FilaCotizacion = { codigo: string; id: string; agencia: string; referencia: string; pasajero: string; texto: string };

  async function filasDeReservas(page: Page, q?: string): Promise<FilaReserva[]> {
    await page.goto(urlReservas(q));
    await esperarFinDeCarga(page);
    await expect(page.locator('#tabBooking'), 'La solapa de reservas del historial tiene que abrirse').toBeVisible({ timeout: 30_000 });
    return page.locator('#tabBooking a.bh-row').evaluateAll((filas) => filas.map((a) => ({
      codigo: a.querySelector('.bh-row__code')?.textContent?.trim() ?? '',
      id: (a.getAttribute('href') ?? '').match(/book=(\d+)/i)?.[1] ?? '',
      agencia: a.querySelector('.bh-row__agency')?.textContent?.trim() ?? '',
      titulo: a.querySelector('.bh-row__title')?.textContent?.trim() ?? '',
      texto: (a as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
    })));
  }

  async function filasDeCotizaciones(page: Page, q?: string): Promise<FilaCotizacion[]> {
    await page.goto(urlCotizaciones(q));
    await esperarFinDeCarga(page);
    await expect(page.locator('#tabQuoteCircuitos'), 'La solapa Multidestino del historial de cotizaciones tiene que abrirse').toBeVisible({ timeout: 30_000 });
    return page.locator('#tabQuoteCircuitos .qh-row--ct').evaluateAll((filas) => filas.map((fila) => {
      const dato = (patron: RegExp) => {
        for (const f of Array.from(fila.querySelectorAll('.qh-fact'))) {
          const rotulo = f.querySelector('.qh-fact__label')?.textContent?.trim() ?? '';
          if (patron.test(rotulo)) return (f.textContent ?? '').replace(rotulo, '').trim();
        }
        return '';
      };
      return {
        codigo: fila.querySelector('.qh-row__code')?.textContent?.trim() ?? '',
        id: (fila.querySelector('a.qh-edit')?.getAttribute('href') ?? '').match(/quote=(\d+)/i)?.[1] ?? '',
        agencia: fila.querySelector('.qh-row__meta .qh-chip')?.textContent?.trim() ?? '',
        referencia: dato(/^ref/i),
        pasajero: dato(/^pax/i),
        texto: (fila as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
      };
    }));
  }

  /** Titulo + cuerpo + valor de los inputs visibles, en minuscula, para buscar marcas. */
  async function contenidoVisible(page: Page): Promise<string> {
    const cuerpo = await page.locator('body').innerText().catch(() => '');
    const campos = await page.locator('input:not([type=hidden]), textarea')
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).filter(Boolean)).catch(() => [] as string[]);
    return `${await page.title().catch(() => '')}\n${cuerpo}\n${campos.join('\n')}`.replace(/\s+/g, ' ').toLowerCase();
  }

  /** Marcas (codigo, referencia, pasajeros) que aparecen en el contenido; ignora las muy cortas. */
  const marcasPresentes = (contenido: string, marcas: string[]) =>
    marcas.filter((m) => m.length >= 4 && contenido.includes(m.toLowerCase()));

  /** Abre una URL y devuelve el estado HTTP, la URL final y las marcas que se ven. */
  async function abrirYBuscarMarcas(page: Page, url: string, marcas: string[]) {
    const respuesta = await page.goto(url).catch(() => null);
    await esperarFinDeCarga(page).catch(() => {});
    const contenido = await contenidoVisible(page);
    return {
      estado: respuesta?.status() ?? 0,
      urlFinal: page.url(),
      contenido,
      encontradas: marcasPresentes(contenido, marcas),
    };
  }

  /**
   * pablo1 toma su reserva mas reciente y lee las marcas de su detalle (codigo,
   * referencia y pasajeros). Se cachea entre pruebas: la misma reserva sirve para la
   * prueba 1 (agencia ajena) y la 3 (sin sesion).
   */
  let reserva: { id: string; codigo: string; referencia: string; agencia: string; marcas: string[] } | null = null;

  async function reservaDePablo1(page: Page) {
    if (reserva) return reserva;
    // Se prefieren las de la suite ("AUTO-QA"); si no hay, la mas reciente a secas.
    let filas = await filasDeReservas(page, 'AUTO-QA');
    if (!filas.length) filas = await filasDeReservas(page);
    const primera = filas[0];
    expect(primera, 'pablo1 tiene que tener al menos una reserva en el historial del ultimo anio').toBeTruthy();

    await page.goto(urlDetalleReserva(primera.id));
    await esperarFinDeCarga(page);
    const pasajeros = (await page.locator('.bhd-pax__name').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    const referencia = /^AUTO-QA/i.test(primera.titulo)
      ? primera.titulo
      : (await page.locator('.bhd-facts .bhd-fact .bhd-fact__value').first().innerText().catch(() => '')).trim();
    const marcas = [primera.codigo, referencia, ...pasajeros].filter(Boolean);

    expect(primera.id, 'La fila tiene que llevar el numero de reserva en su link (book=...)').toMatch(/^\d+$/);
    expect(await page.locator('.bhd__code').innerText().catch(() => ''), 'pablo1 tiene que ver el detalle de su propia reserva').toContain(primera.codigo);
    expect(pasajeros.length, 'El detalle propio tiene que listar al menos un pasajero (es lo que se busca en el ajeno)').toBeGreaterThan(0);

    reserva = { id: primera.id, codigo: primera.codigo, referencia, agencia: primera.agencia, marcas };
    return reserva;
  }

  /**
   * pablo1 toma su cotizacion de multidestino mas reciente. Se cachea entre pruebas:
   * la misma cotizacion alimenta el PDF, el Word y el "Ver detalle".
   */
  let cotizacion: { id: string; codigo: string; referencia: string; pasajero: string; marcas: string[] } | null = null;

  async function cotizacionDePablo1(page: Page) {
    if (cotizacion) return cotizacion;
    let filas = await filasDeCotizaciones(page, 'AUTO-QA COT');
    if (!filas.length) filas = await filasDeCotizaciones(page);
    const primera = filas[0];
    expect(primera, 'pablo1 tiene que tener al menos una cotizacion de multidestino en su historial').toBeTruthy();
    expect(primera.id, 'La fila tiene que llevar el numero de cotizacion en su link Editar (quote=...)').toMatch(/^\d+$/);
    cotizacion = {
      id: primera.id, codigo: primera.codigo, referencia: primera.referencia,
      pasajero: primera.pasajero,
      marcas: [primera.codigo, primera.referencia, primera.pasajero].filter(Boolean),
    };
    return cotizacion;
  }

  // ======================================================================== 1
  test('Una agencia no puede ver por URL la reserva de otra agencia', async ({ page }) => {
    test.setTimeout(300_000);
    let propia: typeof reserva;

    await paso(page, 'pablo1 (agencia duena): tomar su reserva reciente y leer las marcas de su detalle', async () => {
      propia = await reservaDePablo1(page);
      await adjuntarTexto('Reserva de pablo1', JSON.stringify(propia, null, 1));
    });

    await paso(ajena, 'autoqa.markups (otra agencia): abrir esa reserva por URL directa no tiene que mostrar nada de pablo1', async () => {
      const { estado, urlFinal, contenido, encontradas } = await abrirYBuscarMarcas(ajena, urlDetalleReserva(propia!.id), propia!.marcas);
      await adjuntarTexto('Detalle ajeno', `HTTP ${estado}\nURL final: ${urlFinal}\nMarcas de pablo1 que se ven: ${encontradas.join(' | ') || 'ninguna'}\n\n${contenido.slice(0, 3000)}`);
      await conResaltado(ajena, ajena.locator('body'), 'Reserva ajena por URL', () => {
        expect(
          encontradas,
          `Otra agencia no tiene que poder ver el detalle de la reserva ${propia!.codigo} de pablo1 (se ven: ${encontradas.join(', ')})`,
        ).toHaveLength(0);
      });
    });
  });

  // ======================================================================== 2
  test('Una agencia no puede ver por URL la cotizacion de otra agencia', async ({ page }) => {
    test.setTimeout(300_000);
    let cot: { id: string; codigo: string; marcas: string[] };

    await paso(page, 'pablo1 (agencia duena): tomar su cotizacion reciente y verificar que su PDF muestra las marcas', async () => {
      const c = await cotizacionDePablo1(page);
      // El documento propio tiene que mostrar las marcas: sin eso, que la agencia ajena
      // no las vea no probaria nada.
      const propio = await abrirYBuscarMarcas(page, urlDocumentoCotizacion(c.id), c.marcas);
      await adjuntarTexto('Cotizacion de pablo1', `${JSON.stringify(c, null, 1)}\n\nPDF propio: HTTP ${propio.estado}, marcas visibles: ${propio.encontradas.join(' | ') || 'ninguna'}`);
      expect(propio.encontradas.length, 'El PDF propio de la cotizacion tiene que mostrar sus marcas para poder compararlo con el ajeno').toBeGreaterThan(0);
      cot = { id: c.id, codigo: c.codigo, marcas: propio.encontradas };
    });

    await paso(ajena, 'autoqa.markups (otra agencia): abrir el documento de esa cotizacion por URL directa no tiene que mostrar nada de pablo1', async () => {
      const { estado, urlFinal, contenido, encontradas } = await abrirYBuscarMarcas(ajena, urlDocumentoCotizacion(cot.id), cot.marcas);
      await adjuntarTexto('Documento ajeno', `HTTP ${estado}\nURL final: ${urlFinal}\nMarcas de pablo1 que se ven: ${encontradas.join(' | ') || 'ninguna'}\n\n${contenido.slice(0, 3000)}`);
      await conResaltado(ajena, ajena.locator('body'), 'Cotizacion ajena por URL', () => {
        expect(
          encontradas,
          `Otra agencia no tiene que poder ver el documento de la cotizacion ${cot.codigo} de pablo1 (se ven: ${encontradas.join(', ')})`,
        ).toHaveLength(0);
      });
    });
  });

  // ======================================================================== 3
  test('Un usuario sin sesion no puede ver por URL una reserva', async ({ page }) => {
    test.setTimeout(300_000);
    let propia: typeof reserva;

    await paso(page, 'pablo1 (agencia duena): tomar su reserva reciente y leer las marcas de su detalle', async () => {
      propia = await reservaDePablo1(page);
      await adjuntarTexto('Reserva de pablo1', JSON.stringify(propia, null, 1));
    });

    await paso(anonimo, 'Sin iniciar sesion: abrir esa reserva por URL directa no tiene que mostrar nada y tiene que mandar al login', async () => {
      const { estado, urlFinal, contenido, encontradas } = await abrirYBuscarMarcas(anonimo, urlDetalleReserva(propia!.id), propia!.marcas);
      await adjuntarTexto('Detalle sin sesion', `HTTP ${estado}\nURL final: ${urlFinal}\nMarcas de pablo1 que se ven: ${encontradas.join(' | ') || 'ninguna'}\n\n${contenido.slice(0, 3000)}`);
      await conResaltado(anonimo, anonimo.locator('body'), 'Reserva sin sesion por URL', () => {
        expect(
          encontradas,
          `Sin sesion no tiene que poder verse el detalle de la reserva ${propia!.codigo} (se ven: ${encontradas.join(', ')})`,
        ).toHaveLength(0);
        // El bloqueo manda a la raiz con ?return=<ruta original>. Se mira la RUTA final
        // (no la URL entera): el ?return lleva "BookingHistoryDetail" adentro y no cuenta.
        const rutaFinal = new URL(urlFinal).pathname;
        expect(
          !/BookingHistoryDetail/i.test(rutaFinal),
          `Sin sesion, la URL de la reserva tiene que redirigir fuera del detalle (ruta final: ${rutaFinal})`,
        ).toBe(true);
      });
    });
  });

  // ======================================================================== 4
  test('Una agencia no puede ver por URL el Word de la cotizacion de otra agencia', async ({ page }) => {
    test.setTimeout(300_000);
    let cot: { id: string; codigo: string; marcas: string[] };

    await paso(page, 'pablo1 (agencia duena): su Word de la cotizacion muestra las marcas', async () => {
      const c = await cotizacionDePablo1(page);
      const propio = await abrirYBuscarMarcas(page, urlDocumentoCotizacionWord(c.id), c.marcas);
      await adjuntarTexto('Word propio de pablo1', `HTTP ${propio.estado}, marcas visibles: ${propio.encontradas.join(' | ') || 'ninguna'}`);
      expect(propio.encontradas.length, 'El Word propio de la cotizacion tiene que mostrar sus marcas para poder compararlo con el ajeno').toBeGreaterThan(0);
      cot = { id: c.id, codigo: c.codigo, marcas: propio.encontradas };
    });

    await paso(ajena, 'autoqa.markups (otra agencia): abrir el Word de esa cotizacion por URL directa no tiene que mostrar nada de pablo1', async () => {
      const { estado, urlFinal, contenido, encontradas } = await abrirYBuscarMarcas(ajena, urlDocumentoCotizacionWord(cot.id), cot.marcas);
      await adjuntarTexto('Word ajeno', `HTTP ${estado}\nURL final: ${urlFinal}\nMarcas de pablo1 que se ven: ${encontradas.join(' | ') || 'ninguna'}\n\n${contenido.slice(0, 3000)}`);
      await conResaltado(ajena, ajena.locator('body'), 'Word ajeno por URL', () => {
        expect(encontradas, `Otra agencia no tiene que poder ver el Word de la cotizacion ${cot.codigo} de pablo1 (se ven: ${encontradas.join(', ')})`).toHaveLength(0);
      });
    });
  });

});
