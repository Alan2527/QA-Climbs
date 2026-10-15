import { test, expect, Page, BrowserContext } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, reiniciarNumeracionDePasos, conResaltado,
} from '../../utils/pasos';
import { abrirSesionDeMarkups } from '../../utils/markups';

/**
 * BLOQUE B — Historial de reservas y de cotizaciones: que ve cada agencia.
 *
 * Es de los pocos puntos del portal donde un error es una fuga de datos y no una
 * pantalla fea: el historial y el detalle de una reserva traen pasajeros, pasaportes,
 * importes y la agencia vendedora; la cotizacion trae el pasajero, la referencia y el
 * precio que la agencia le va a cobrar a su cliente. Si una agencia ve (o abre por URL)
 * lo de otra, se filtra informacion comercial y datos personales de terceros.
 *
 * Hay tres lugares donde el filtro puede romperse y por eso se miran los tres:
 * - la lista del historial (BookingHistory.aspx / QuoteHistory.aspx), que filtra por
 *   usuario o por agencia segun el tipo de usuario;
 * - la busqueda de la lista (codigo, referencia), que no tiene que traer lo ajeno;
 * - el detalle abierto por URL directa (BookingHistoryDetail.aspx?book=..., el documento
 *   de la cotizacion y su "Ver detalle"): el que los links de la lista ya filtraron, pero
 *   que alguien puede escribir a mano con el numero de otra reserva.
 *
 * Con dos sesiones a la vez:
 * - pablo1 (agencia 1): es el dueno. Se toma su reserva y su cotizacion mas recientes,
 *   se verifica que el filtro por codigo la acota a ella y se lee que marcas trae su
 *   detalle (codigo, referencia, pasajeros), que son las que se buscan despues.
 * - autoqa.markups (agencia 6334): es la agencia ajena. Su historial no tiene que listar
 *   esa reserva ni esa cotizacion, ni con filtros ni sin ellos, y el detalle abierto por
 *   URL directa no tiene que mostrar ninguna de las marcas de pablo1.
 *
 * Lo que el test EXIGE es que lo ajeno no se vea. Si el codigo deja abrir el detalle de
 * otra agencia, el test queda en rojo y es un hallazgo (no hay validacion de dueno en
 * BookingHistoryDetail.aspx.cs ni en getbook / getbookpassengers / getitemsbybook de la
 * API; tampoco en customtourquote.aspx.cs).
 *
 * Solo lee: no emite, no cancela ni guarda nada, y no deja datos en QA. No cubre dos
 * usuarios de la MISMA agencia (hotfix "en cotizaciones y reservas vemos solo lo de
 * nuestro usuario"): para eso hace falta un segundo usuario en la agencia 1.
 */
test.describe('Historial de reservas y cotizaciones por agencia', () => {
  let contexto: BrowserContext;
  let ajena: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto, pagina: ajena } = await abrirSesionDeMarkups(browser, baseURL));
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  // ---------------------------------------------------------------- utilidades

  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  const ddmmaaaa = (d: Date) => `${dosDigitos(d.getDate())}-${dosDigitos(d.getMonth() + 1)}-${d.getFullYear()}`;

  /**
   * El historial de reservas arranca mostrando solo los ultimos 30 dias. Se pide un
   * anio entero (BookingHistory.aspx.cs:413-421: el servidor exige `from` y `to`
   * juntos, aunque el `to` lo reemplaza por manana) para que "no aparece" no sea solo
   * "esta fuera de la ventana".
   */
  function urlReservas(q?: string): string {
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(desde.getDate() - 365);
    const busqueda = q ? `&q=${encodeURIComponent(q)}` : '';
    return `/online/BookingHistory.aspx?tab=booking&from=${ddmmaaaa(desde)}&to=${ddmmaaaa(hoy)}${busqueda}`;
  }

  /** El historial de cotizaciones, solapa Multidestino (qtab=circuitos), con busqueda y agencia opcionales. */
  function urlCotizaciones(q?: string, agencia?: string): string {
    const params = ['qtab=circuitos'];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (agencia) params.push(`ag=${encodeURIComponent(agencia)}`);
    return `/online/QuoteHistory.aspx?${params.join('&')}`;
  }

  type FilaReserva = { codigo: string; id: string; agencia: string; titulo: string; texto: string };
  type FilaCotizacion = {
    codigo: string; id: string; agencia: string; titulo: string; referencia: string; pasajero: string;
    hrefVerDetalle: string; texto: string;
  };

  /**
   * Las filas de la solapa Reservas (carrito) del historial: `a.bh-row` dentro de
   * `#tabBooking` (BookingHistory.aspx:58). Se leen todas juntas del DOM.
   */
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

  /**
   * Las filas de la solapa Multidestino del historial de cotizaciones: `.qh-row--ct`
   * dentro de `#tabQuoteCircuitos` (QuoteHistory.aspx:125). La agencia es el primer chip
   * de la fila; la referencia y el pasajero salen de los `.qh-fact` (rotulo + valor).
   */
  async function filasDeCotizaciones(page: Page, q?: string, agencia?: string): Promise<FilaCotizacion[]> {
    await page.goto(urlCotizaciones(q, agencia));
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
        titulo: fila.querySelector('.qh-row__title')?.textContent?.trim() ?? '',
        referencia: dato(/^ref/i),
        pasajero: dato(/^pax/i),
        hrefVerDetalle: fila.querySelector('a.qh-btn--ghost')?.getAttribute('href') ?? '',
        texto: (fila as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
      };
    }));
  }

  /**
   * Todo lo que una persona puede ver o leer en una pantalla: titulo de la pestana, el
   * texto y el valor de los campos de texto (la referencia de la cotizacion vive en un
   * input). Los hidden quedan afuera: no los ve nadie y traen ids que no son contenido.
   */
  async function contenidoVisible(page: Page): Promise<string> {
    const cuerpo = await page.locator('body').innerText().catch(() => '');
    const campos = await page.locator('input:not([type=hidden]), textarea')
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).filter(Boolean)).catch(() => [] as string[]);
    return `${await page.title().catch(() => '')}\n${cuerpo}\n${campos.join('\n')}`.replace(/\s+/g, ' ').toLowerCase();
  }

  /** Cuales de las marcas aparecen en el contenido de la pagina. */
  const marcasPresentes = (contenido: string, marcas: string[]) =>
    marcas.filter((m) => m.length >= 4 && contenido.includes(m.toLowerCase()));

  /** Abre una URL y devuelve el estado HTTP, la URL final y las marcas que se ven. */
  async function abrirYBuscarMarcas(page: Page, url: string, marcas: string[]) {
    const respuesta = await page.goto(url);
    await esperarFinDeCarga(page).catch(() => {});
    const contenido = await contenidoVisible(page);
    return {
      estado: respuesta?.status() ?? 0,
      urlFinal: page.url(),
      contenido,
      encontradas: marcasPresentes(contenido, marcas),
    };
  }

  /** Ruta + query de un link de la lista, para abrirlo contra el host de cada sesion. */
  const rutaDe = (href: string) => {
    const u = new URL(href, 'https://qa.amv.travel');
    return `${u.pathname}${u.search}`;
  };

  // ------------------------------------------------------------------- reservas

  test('Reservas: la reserva de pablo1 se acota por codigo y no se ve ni se abre desde otra agencia', async ({ page }) => {
    test.setTimeout(300_000);

    let reserva = { id: '', codigo: '', referencia: '', agencia: '' };
    let marcas: string[] = [];

    await paso(page, 'pablo1: tomar su reserva mas reciente del historial (ultimo anio)', async () => {
      // Se prefieren las que emite la suite (referencia "AUTO-QA <sello>"): tienen una
      // referencia unica por corrida. Si no hay ninguna, se toma la mas reciente a secas.
      let filas = await filasDeReservas(page, 'AUTO-QA');
      if (!filas.length) filas = await filasDeReservas(page);
      const primera = filas[0];
      expect(primera, 'pablo1 tiene que tener al menos una reserva en el historial del ultimo anio').toBeTruthy();
      reserva = {
        id: primera.id,
        codigo: primera.codigo,
        // La referencia es el titulo de la fila; si no tiene, el titulo es el pasajero.
        referencia: /^AUTO-QA/i.test(primera.titulo) ? primera.titulo : '',
        agencia: primera.agencia,
      };
      await adjuntarTexto('Reserva elegida de pablo1', JSON.stringify({ ...reserva, fila: primera.texto }, null, 1));
      expect(reserva.id, 'La fila tiene que llevar el numero de reserva en su link (book=...)').toMatch(/^\d+$/);
      expect(reserva.codigo, 'La fila tiene que mostrar el codigo de la reserva').toMatch(/^[A-Z]+\d+$/);
      expect(reserva.agencia, 'La fila tiene que mostrar la agencia vendedora').not.toBe('');
    });

    await paso(page, 'pablo1: el detalle de su reserva trae el codigo, la referencia y los pasajeros', async () => {
      await page.goto(`/online/BookingHistoryDetail.aspx?book=${reserva.id}`);
      await esperarFinDeCarga(page);
      const encabezado = page.locator('.bhd__code');
      const pasajeros = (await page.locator('.bhd-pax__name').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      // El primer dato de la ficha es la referencia (BookingHistoryDetail.aspx:62-65).
      const referencia = (await page.locator('.bhd-facts .bhd-fact .bhd-fact__value').first().innerText().catch(() => '')).trim();
      if (!reserva.referencia) reserva.referencia = referencia;
      marcas = [reserva.codigo, reserva.referencia, ...pasajeros].filter(Boolean);
      await adjuntarTexto('Marcas de la reserva de pablo1', marcas.join('\n'));
      await conResaltado(page, encabezado, 'Detalle propio', async () => {
        await expect(encabezado, 'pablo1 tiene que ver el detalle de su propia reserva').toContainText(reserva.codigo);
        expect(pasajeros.length, 'El detalle propio tiene que listar al menos un pasajero (es lo que se busca en el ajeno)').toBeGreaterThan(0);
      });
    });

    await paso(page, 'pablo1: el filtro por codigo acota el historial a esa reserva', async () => {
      const sinFiltro = await filasDeReservas(page);
      const totalSinFiltro = sinFiltro.length;
      await adjuntarTexto('Filas sin filtro (primera pagina)', String(totalSinFiltro));

      await page.locator("[id$='txtSearch']").fill(reserva.codigo);
      await page.locator("[id$='btnSearch']").click();
      await page.waitForURL(/[?&]q=/i, { timeout: 60_000 });
      await esperarFinDeCarga(page);
      const filas = page.locator('#tabBooking a.bh-row');
      await conResaltado(page, page.locator('#tabBooking'), 'Filtro por codigo', async () => {
        await expect(filas, `El filtro por ${reserva.codigo} tiene que dejar una sola reserva`).toHaveCount(1, { timeout: 30_000 });
        await expect(filas.first(), 'La unica fila tiene que ser la buscada').toContainText(reserva.codigo);
      });
      if (totalSinFiltro <= 1) {
        test.info().annotations.push({ type: 'aviso', description: 'El historial de pablo1 tiene una sola reserva: el filtro por codigo no demuestra que acote.' });
      }

      // Tambien por referencia, que es lo que mas busca la agencia.
      if (reserva.referencia.length >= 6) {
        const porReferencia = await filasDeReservas(page, reserva.referencia);
        await conResaltado(page, page.locator('#tabBooking'), 'Filtro por referencia', () => {
          expect(porReferencia.map((f) => f.codigo), `El filtro por la referencia "${reserva.referencia}" tiene que traer la reserva ${reserva.codigo}`)
            .toContain(reserva.codigo);
        });
      }
    });

    await paso(ajena, 'autoqa.markups: el historial no lista la reserva de pablo1, ni filtrando ni sin filtrar', async () => {
      const numero = String(Number(reserva.id));
      const busquedas: Array<[string, string | undefined]> = [
        ['sin filtro', undefined],
        ['por codigo', reserva.codigo],
        ['por numero', numero],
        ...(reserva.referencia.length >= 6 ? [['por referencia', reserva.referencia] as [string, string]] : []),
      ];
      const informe: string[] = [];
      for (const [como, q] of busquedas) {
        const filas = await filasDeReservas(ajena, q);
        const laDeOtro = filas.filter((f) => f.id === reserva.id || f.codigo === reserva.codigo);
        const deLaAgenciaDeOtro = filas.filter((f) => f.agencia === reserva.agencia);
        informe.push(`${como}: ${filas.length} filas, la reserva de pablo1: ${laDeOtro.length}, filas de la agencia "${reserva.agencia}": ${deLaAgenciaDeOtro.length}`);
        await conResaltado(ajena, ajena.locator('#tabBooking'), `Historial ajeno ${como}`, () => {
          expect(laDeOtro, `El historial de otra agencia (${como}) no tiene que listar la reserva ${reserva.codigo}`).toHaveLength(0);
          expect(deLaAgenciaDeOtro, `El historial de otra agencia (${como}) no tiene que listar reservas de la agencia "${reserva.agencia}"`).toHaveLength(0);
        });
      }
      await adjuntarTexto('Historial de autoqa.markups', informe.join('\n'));
    });

    await paso(ajena, 'autoqa.markups: el detalle de esa reserva, abierto por URL directa, no muestra nada de pablo1', async () => {
      const { estado, urlFinal, contenido, encontradas } = await abrirYBuscarMarcas(
        ajena, `/online/BookingHistoryDetail.aspx?book=${reserva.id}`, marcas,
      );
      await adjuntarTexto('Detalle ajeno', `HTTP ${estado}\nURL final: ${urlFinal}\nMarcas de pablo1 que se ven: ${encontradas.join(' | ') || 'ninguna'}\n\n${contenido.slice(0, 3000)}`);
      await conResaltado(ajena, ajena.locator('body'), 'Detalle ajeno', () => {
        expect(
          encontradas,
          `Otra agencia no tiene que poder ver el detalle de la reserva ${reserva.codigo} de pablo1 (se ven: ${encontradas.join(', ')})`,
        ).toHaveLength(0);
      });
    });
  });

  // ---------------------------------------------------------------- cotizaciones

  test('Cotizaciones: la cotizacion de pablo1 se acota por codigo y no se ve ni se abre desde otra agencia', async ({ page }) => {
    test.setTimeout(300_000);

    let cotizacion = { id: '', codigo: '', referencia: '', pasajero: '', agencia: '', hrefVerDetalle: '' };
    const urlDocumento = (id: string) => `/online/customtours/print/customtourquote.aspx?quote=${id}&lang=1`;
    let marcas: string[] = [];

    await paso(page, 'pablo1: tomar su cotizacion de multidestino mas reciente', async () => {
      // Misma preferencia que en reservas: las de la suite llevan "AUTO-QA COT <sello>".
      let filas = await filasDeCotizaciones(page, 'AUTO-QA COT');
      if (!filas.length) filas = await filasDeCotizaciones(page);
      const primera = filas[0];
      expect(primera, 'pablo1 tiene que tener al menos una cotizacion de multidestino en su historial').toBeTruthy();
      cotizacion = {
        id: primera.id,
        codigo: primera.codigo,
        referencia: primera.referencia,
        pasajero: primera.pasajero,
        agencia: primera.agencia,
        hrefVerDetalle: primera.hrefVerDetalle,
      };
      marcas = [cotizacion.codigo, cotizacion.referencia, cotizacion.pasajero];
      await adjuntarTexto('Cotizacion elegida de pablo1', JSON.stringify({ ...cotizacion, fila: primera.texto }, null, 1));
      expect(cotizacion.id, 'La fila tiene que llevar el numero de cotizacion en su link Editar (quote=...)').toMatch(/^\d+$/);
      expect(cotizacion.codigo, 'La fila tiene que mostrar el codigo de la cotizacion').toMatch(/^[A-Z]+\d+$/);
      expect(cotizacion.agencia, 'La fila tiene que mostrar la agencia').not.toBe('');
      expect(cotizacion.hrefVerDetalle, 'La fila tiene que ofrecer el link Ver detalle').not.toBe('');
    });

    await paso(page, 'pablo1: el filtro del historial acota a esa cotizacion', async () => {
      await page.goto(urlCotizaciones());
      await esperarFinDeCarga(page);
      const sinFiltro = await page.locator('#tabQuoteCircuitos .qh-row--ct').count();

      await page.locator('#qhSearch').fill(cotizacion.codigo);
      await page.locator('#qhSearch').press('Enter');
      await page.waitForURL(/[?&]q=/i, { timeout: 60_000 });
      await esperarFinDeCarga(page);
      const filas = page.locator('#tabQuoteCircuitos .qh-row--ct');
      await conResaltado(page, page.locator('#tabQuoteCircuitos'), 'Filtro por codigo', async () => {
        await expect(filas, `El filtro por ${cotizacion.codigo} tiene que dejar una sola cotizacion`).toHaveCount(1, { timeout: 30_000 });
        await expect(filas.first(), 'La unica fila tiene que ser la buscada').toContainText(cotizacion.codigo);
      });
      if (sinFiltro <= 1) {
        test.info().annotations.push({ type: 'aviso', description: 'El historial de pablo1 tiene una sola cotizacion: el filtro no demuestra que acote.' });
      }

      if (cotizacion.referencia.length >= 6) {
        const porReferencia = await filasDeCotizaciones(page, cotizacion.referencia);
        await conResaltado(page, page.locator('#tabQuoteCircuitos'), 'Filtro por referencia', () => {
          expect(porReferencia.map((f) => f.codigo), `El filtro por la referencia "${cotizacion.referencia}" tiene que traer la cotizacion ${cotizacion.codigo}`)
            .toContain(cotizacion.codigo);
        });
      }
    });

    // Los dos documentos que se abren por URL: el HTML del que salen el PDF y el Word
    // (el mismo que baja el historial) y el "Ver detalle" de la fila. Con pablo1 se
    // comprueba que traen alguna de las marcas; sin eso, que otra agencia no las vea no
    // probaria nada.
    const documentos: Array<{ nombre: string; url: () => string; conMarcas: boolean }> = [
      { nombre: 'documento de la cotizacion (PDF/Word)', url: () => urlDocumento(cotizacion.id), conMarcas: false },
      { nombre: 'Ver detalle de la cotizacion', url: () => rutaDe(cotizacion.hrefVerDetalle), conMarcas: false },
    ];

    await paso(page, 'pablo1: sus documentos de la cotizacion muestran las marcas que despues se buscan', async () => {
      const informe: string[] = [];
      for (const doc of documentos) {
        const r = await abrirYBuscarMarcas(page, doc.url(), marcas);
        doc.conMarcas = r.encontradas.length > 0;
        informe.push(`${doc.nombre}: HTTP ${r.estado}, marcas visibles: ${r.encontradas.join(' | ') || 'ninguna'}`);
        if (!doc.conMarcas) {
          test.info().annotations.push({ type: 'aviso', description: `El ${doc.nombre} de pablo1 no muestra codigo, referencia ni pasajero: el chequeo ajeno de ese documento no es concluyente y se omite.` });
        }
      }
      await adjuntarTexto('Documentos propios de pablo1', informe.join('\n'));
      expect(documentos.some((d) => d.conMarcas), 'Al menos un documento de la cotizacion tiene que mostrar sus marcas para poder compararlo con el ajeno').toBe(true);
    });

    await paso(ajena, 'autoqa.markups: el historial no lista la cotizacion de pablo1, ni filtrando ni sin filtrar', async () => {
      const busquedas: Array<[string, string | undefined, string | undefined]> = [
        ['sin filtro', undefined, undefined],
        ['por codigo', cotizacion.codigo, undefined],
        ['por numero', String(Number(cotizacion.id)), undefined],
        // `ag` es el filtro por nombre de agencia de la URL: se fuerza el de pablo1.
        ['forzando la agencia de pablo1 en la URL', undefined, cotizacion.agencia],
        ...(cotizacion.referencia.length >= 6 ? [['por referencia', cotizacion.referencia, undefined] as [string, string, undefined]] : []),
      ];
      const informe: string[] = [];
      for (const [como, q, ag] of busquedas) {
        const filas = await filasDeCotizaciones(ajena, q, ag);
        const laDeOtro = filas.filter((f) => f.id === cotizacion.id || f.codigo === cotizacion.codigo);
        const deLaAgenciaDeOtro = filas.filter((f) => f.agencia === cotizacion.agencia);
        informe.push(`${como}: ${filas.length} filas, la cotizacion de pablo1: ${laDeOtro.length}, filas de la agencia "${cotizacion.agencia}": ${deLaAgenciaDeOtro.length}`);
        await conResaltado(ajena, ajena.locator('#tabQuoteCircuitos'), `Historial ajeno ${como}`, () => {
          expect(laDeOtro, `El historial de otra agencia (${como}) no tiene que listar la cotizacion ${cotizacion.codigo}`).toHaveLength(0);
          expect(deLaAgenciaDeOtro, `El historial de otra agencia (${como}) no tiene que listar cotizaciones de la agencia "${cotizacion.agencia}"`).toHaveLength(0);
        });
      }
      await adjuntarTexto('Historial de cotizaciones de autoqa.markups', informe.join('\n'));
    });

    await paso(ajena, 'autoqa.markups: los documentos de esa cotizacion, abiertos por URL directa, no muestran nada de pablo1', async () => {
      for (const doc of documentos.filter((d) => d.conMarcas)) {
        const r = await abrirYBuscarMarcas(ajena, doc.url(), marcas);
        await adjuntarTexto(`Ajeno: ${doc.nombre}`, `HTTP ${r.estado}\nURL final: ${r.urlFinal}\nMarcas de pablo1 que se ven: ${r.encontradas.join(' | ') || 'ninguna'}\n\n${r.contenido.slice(0, 3000)}`);
        await conResaltado(ajena, ajena.locator('body'), `Ajeno: ${doc.nombre}`, () => {
          expect(
            r.encontradas,
            `Otra agencia no tiene que poder ver el ${doc.nombre} de la cotizacion ${cotizacion.codigo} de pablo1 (se ven: ${r.encontradas.join(', ')})`,
          ).toHaveLength(0);
        });
      }
    });
  });
});
