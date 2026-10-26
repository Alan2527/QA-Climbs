import { test, expect, Page, BrowserContext } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';

/**
 * RESERVAS — app nueva (ClimbsApp). Historial de reservas y de cotizaciones: que ve cada agencia.
 *
 * Los mismos dos tests que tests/bloque-b/historial-por-usuario.spec.ts, con los mismos
 * titulos. Es una fuga de datos si falla: el detalle trae pasajeros, pasaportes e importes,
 * y la cotizacion el precio que la agencia le cobra a su cliente. Con dos sesiones:
 * - pablo1 (agencia AMV. TRAVEL): el dueno. Se toma su reserva y su cotizacion mas
 *   recientes y se leen sus marcas (codigo, referencia, pasajeros).
 * - autoqa.markups (agencia AUTO-QA NO TOCAR - MARKUPS): la ajena. Su historial no tiene
 *   que listarlas, ni filtrando ni sin filtrar, y abiertas por URL no tienen que mostrar
 *   ninguna marca de pablo1.
 * Solo lee: no emite, no cancela ni guarda nada.
 */
test.describe('Historial de reservas y cotizaciones por agencia', () => {
  let contexto: BrowserContext;
  let ajena: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto, pagina: ajena } = await abrirSesionDeOtraAgencia(browser, baseURL));
  });
  test.afterAll(async () => { await contexto?.close(); });
  test.beforeEach(() => reiniciarNumeracionDePasos());

  type Fila = { codigo: string; id: string; agencia: string; titulo: string; lineas: string[]; texto: string };

  /** Lo que una persona ve: titulo, texto y valor de los campos. */
  async function contenidoVisible(page: Page): Promise<string> {
    const cuerpo = await page.locator('body').innerText().catch(() => '');
    const campos = await page.locator('input:not([type=hidden]), textarea')
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).filter(Boolean)).catch(() => [] as string[]);
    return `${await page.title().catch(() => '')}\n${cuerpo}\n${campos.join('\n')}`.replace(/\s+/g, ' ').toLowerCase();
  }
  const marcasPresentes = (contenido: string, marcas: string[]) => marcas.filter((m) => m.length >= 4 && contenido.includes(m.toLowerCase()));

  async function abrirYBuscarMarcas(page: Page, url: string, marcas: string[]) {
    const respuesta = await page.goto(url);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    const contenido = await contenidoVisible(page);
    return { estado: respuesta?.status() ?? 0, urlFinal: page.url(), contenido, encontradas: marcasPresentes(contenido, marcas) };
  }

  /** Escribe en el buscador del historial y busca; sin termino, deja la lista como esta. */
  async function buscar(page: Page, q?: string) {
    if (q === undefined) return;
    await page.locator('main').getByRole('searchbox').first().fill(q);
    await page.locator('main').getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  }

  /** Las filas de la solapa "Carrito de compras" del historial de reservas, en el ultimo anio. */
  async function filasDeReservas(page: Page, q?: string): Promise<Fila[]> {
    await page.goto('/site/bookings');
    await page.getByRole('tab', { name: 'Carrito de compras', exact: true }).click();
    // El historial arranca en 30 dias: se pide el anio, para que "no aparece" no sea "fuera de la ventana".
    await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: '1 año' }).click();
    await page.waitForLoadState('networkidle');
    await buscar(page, q);
    await page.waitForTimeout(1000);
    return page.getByRole('tabpanel').getByRole('link').evaluateAll((links) => links.map((a) => {
      const lineas = (a as HTMLElement).innerText.split('\n').map((l) => l.trim()).filter(Boolean);
      // La agencia va justo antes de "usuario · ciudad, pais".
      const iUsuario = lineas.findIndex((l) => /·\s*[^·]+,\s*[^,]+$/.test(l) && !/pax$/.test(l));
      return {
        codigo: lineas.find((l) => /^BO\d{8}$/.test(l)) ?? '',
        id: (a.getAttribute('href') ?? '').match(/\/bookings\/(\d+)/)?.[1] ?? '',
        agencia: iUsuario > 0 ? lineas[iUsuario - 1] : '',
        titulo: lineas[2] ?? '',
        lineas,
        texto: lineas.join(' '),
      };
    }));
  }

  /** Las filas de la solapa "Multidestino" del historial de cotizaciones. */
  async function filasDeCotizaciones(page: Page, q?: string): Promise<(Fila & { verDetalle: string })[]> {
    await page.goto('/site/quotes');
    await page.getByRole('tab', { name: 'Multidestino', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await buscar(page, q);
    await page.waitForTimeout(1000);
    // Cada cotizacion es un bloque con su codigo y sus links (Editar, Ver detalle, PDF, Word).
    return page.getByRole('tabpanel').getByRole('link', { name: 'Ver detalle' }).evaluateAll((links) => links.map((a) => {
      let fila: HTMLElement = a as HTMLElement;
      while (fila.parentElement && !/CC\d{8}/.test(fila.innerText)) fila = fila.parentElement;
      const lineas = fila.innerText.split('\n').map((l) => l.trim()).filter(Boolean);
      const despuesDe = (r: RegExp) => { const i = lineas.findIndex((l) => r.test(l)); return i >= 0 ? lineas[i + 1] ?? '' : ''; };
      const iFecha = lineas.findIndex((l) => /^\d{2}\/\d{2}\/\d{4}/.test(l));
      return {
        codigo: lineas.find((l) => /^CC\d{8}$/.test(l)) ?? '',
        id: (a.getAttribute('href') ?? '').match(/\/quote\/(\d+)/)?.[1] ?? '',
        agencia: iFecha >= 0 ? lineas[iFecha + 2] ?? '' : '',
        titulo: iFecha >= 0 ? lineas[iFecha + 1] ?? '' : '',
        referencia: despuesDe(/^Referencia$/i),
        pasajero: despuesDe(/^Pax$/i),
        verDetalle: a.getAttribute('href') ?? '',
        lineas,
        texto: lineas.join(' '),
      };
    }));
  }

  // ------------------------------------------------------------------- reservas

  test('Reservas: la reserva de pablo1 se acota por codigo y no se ve ni se abre desde otra agencia', async ({ page }) => {
    test.setTimeout(300_000);
    let reserva = { id: '', codigo: '', referencia: '', agencia: '' };
    let marcas: string[] = [];

    await paso(page, 'pablo1: tomar su reserva mas reciente del historial (ultimo anio)', async () => {
      // Se prefieren las que emite la suite: referencia "AUTO-QA <sello>", unica por corrida.
      let filas = await filasDeReservas(page, 'AUTO-QA');
      if (!filas.length) filas = await filasDeReservas(page);
      const primera = filas[0];
      expect(primera, 'pablo1 tiene que tener al menos una reserva en el historial del ultimo anio').toBeTruthy();
      reserva = { id: primera.id, codigo: primera.codigo, referencia: /^AUTO-QA/i.test(primera.titulo) ? primera.titulo : '', agencia: primera.agencia };
      await adjuntarTexto('Reserva elegida de pablo1', JSON.stringify({ ...reserva, fila: primera.texto }, null, 1));
      expect(reserva.id, 'La fila tiene que llevar el numero de reserva en su link').toMatch(/^\d+$/);
      expect(reserva.codigo, 'La fila tiene que mostrar el codigo de la reserva').toMatch(/^BO\d{8}$/);
      expect(reserva.agencia, 'La fila tiene que mostrar la agencia vendedora').not.toBe('');
    });

    await paso(page, 'pablo1: el detalle de su reserva trae el codigo, la referencia y los pasajeros', async () => {
      await page.goto(`/site/bookings/${reserva.id}`);
      const encabezado = page.getByRole('heading', { level: 1 });
      await expect(encabezado, 'pablo1 tiene que ver el detalle de su propia reserva').toContainText(reserva.codigo, { timeout: 60_000 });
      const lineas = (await page.locator('main').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
      // Cada pasajero es la linea que precede a su "Pasaporte".
      const pasajeros = lineas.filter((_, i) => /^pasaporte$/i.test(lineas[i + 1] ?? ''));
      if (!reserva.referencia) { const i = lineas.findIndex((l) => /^referencia$/i.test(l)); reserva.referencia = i >= 0 ? lineas[i + 1] : ''; }
      marcas = [reserva.codigo, reserva.referencia, ...pasajeros].filter(Boolean);
      await adjuntarTexto('Marcas de la reserva de pablo1', marcas.join('\n'));
      await conResaltado(page, encabezado, 'Detalle propio', () => {
        expect(pasajeros.length, 'El detalle propio tiene que listar al menos un pasajero (es lo que se busca en el ajeno)').toBeGreaterThan(0);
      });
    });

    await paso(page, 'pablo1: el filtro por codigo acota el historial a esa reserva', async () => {
      const sinFiltro = await filasDeReservas(page);
      await adjuntarTexto('Filas sin filtro', String(sinFiltro.length));
      const porCodigo = await filasDeReservas(page, reserva.codigo);
      await conResaltado(page, page.getByRole('tabpanel'), 'Filtro por codigo', () => {
        expect(porCodigo.map((f) => f.codigo), `El filtro por ${reserva.codigo} tiene que dejar una sola reserva, la buscada`).toEqual([reserva.codigo]);
      });
      if (sinFiltro.length <= 1) test.info().annotations.push({ type: 'aviso', description: 'El historial de pablo1 tiene una sola reserva: el filtro por codigo no demuestra que acote.' });
      if (reserva.referencia.length >= 6) {
        const porReferencia = await filasDeReservas(page, reserva.referencia);
        await conResaltado(page, page.getByRole('tabpanel'), 'Filtro por referencia', () => {
          expect(porReferencia.map((f) => f.codigo), `El filtro por la referencia "${reserva.referencia}" tiene que traer la reserva ${reserva.codigo}`).toContain(reserva.codigo);
        });
      }
    });

    await paso(ajena, 'autoqa.markups: el historial no lista la reserva de pablo1, ni filtrando ni sin filtrar', async () => {
      const busquedas: Array<[string, string | undefined]> = [
        ['sin filtro', undefined], ['por codigo', reserva.codigo], ['por numero', reserva.id],
        ...(reserva.referencia.length >= 6 ? [['por referencia', reserva.referencia] as [string, string]] : []),
      ];
      const informe: string[] = [];
      for (const [como, q] of busquedas) {
        const filas = await filasDeReservas(ajena, q);
        const laDeOtro = filas.filter((f) => f.id === reserva.id || f.codigo === reserva.codigo);
        const deLaAgenciaDeOtro = filas.filter((f) => f.agencia === reserva.agencia);
        informe.push(`${como}: ${filas.length} filas, la reserva de pablo1: ${laDeOtro.length}, filas de la agencia "${reserva.agencia}": ${deLaAgenciaDeOtro.length}`);
        await conResaltado(ajena, ajena.locator('main'), `Historial ajeno ${como}`, () => {
          expect(laDeOtro, `El historial de otra agencia (${como}) no tiene que listar la reserva ${reserva.codigo}`).toHaveLength(0);
          expect(deLaAgenciaDeOtro, `El historial de otra agencia (${como}) no tiene que listar reservas de la agencia "${reserva.agencia}"`).toHaveLength(0);
        });
      }
      await adjuntarTexto('Historial de autoqa.markups', informe.join('\n'));
    });

    await paso(ajena, 'autoqa.markups: el detalle de esa reserva, abierto por URL directa, no muestra nada de pablo1', async () => {
      const { estado, urlFinal, contenido, encontradas } = await abrirYBuscarMarcas(ajena, `/site/bookings/${reserva.id}`, marcas);
      await adjuntarTexto('Detalle ajeno', `HTTP ${estado}\nURL final: ${urlFinal}\nMarcas de pablo1 que se ven: ${encontradas.join(' | ') || 'ninguna'}\n\n${contenido.slice(0, 3000)}`);
      await conResaltado(ajena, ajena.locator('body'), 'Detalle ajeno', () => {
        expect(encontradas, `Otra agencia no tiene que poder ver el detalle de la reserva ${reserva.codigo} de pablo1 (se ven: ${encontradas.join(', ')})`).toHaveLength(0);
      });
    });
  });

  // ---------------------------------------------------------------- cotizaciones

  test('Cotizaciones: la cotizacion de pablo1 se acota por codigo y no se ve ni se abre desde otra agencia', async ({ page }) => {
    test.setTimeout(300_000);
    let cotizacion = { id: '', codigo: '', referencia: '', pasajero: '', agencia: '', verDetalle: '' };
    let marcas: string[] = [];

    await paso(page, 'pablo1: tomar su cotizacion de multidestino mas reciente', async () => {
      // Se prefieren las de la suite: referencia "AUTO-QA COT <sello>".
      let filas = await filasDeCotizaciones(page, 'AUTO-QA COT');
      if (!filas.length) filas = await filasDeCotizaciones(page);
      const primera = filas[0];
      expect(primera, 'pablo1 tiene que tener al menos una cotizacion de multidestino en su historial').toBeTruthy();
      cotizacion = { id: primera.id, codigo: primera.codigo, referencia: (primera as any).referencia, pasajero: (primera as any).pasajero, agencia: primera.agencia, verDetalle: primera.verDetalle };
      marcas = [cotizacion.codigo, cotizacion.referencia, cotizacion.pasajero].filter(Boolean);
      await adjuntarTexto('Cotizacion elegida de pablo1', JSON.stringify({ ...cotizacion, fila: primera.texto }, null, 1));
      expect(cotizacion.id, 'La fila tiene que llevar el numero de cotizacion en su link Ver detalle').toMatch(/^\d+$/);
      expect(cotizacion.codigo, 'La fila tiene que mostrar el codigo de la cotizacion').toMatch(/^CC\d{8}$/);
      expect(cotizacion.agencia, 'La fila tiene que mostrar la agencia').not.toBe('');
    });

    await paso(page, 'pablo1: el filtro del historial acota a esa cotizacion', async () => {
      const sinFiltro = await filasDeCotizaciones(page);
      const porCodigo = await filasDeCotizaciones(page, cotizacion.codigo);
      await conResaltado(page, page.getByRole('tabpanel'), 'Filtro por codigo', () => {
        expect(porCodigo.map((f) => f.codigo), `El filtro por ${cotizacion.codigo} tiene que dejar una sola cotizacion, la buscada`).toEqual([cotizacion.codigo]);
      });
      if (sinFiltro.length <= 1) test.info().annotations.push({ type: 'aviso', description: 'El historial de pablo1 tiene una sola cotizacion: el filtro no demuestra que acote.' });
      if (cotizacion.referencia.length >= 6) {
        const porReferencia = await filasDeCotizaciones(page, cotizacion.referencia);
        await conResaltado(page, page.getByRole('tabpanel'), 'Filtro por referencia', () => {
          expect(porReferencia.map((f) => f.codigo), `El filtro por la referencia "${cotizacion.referencia}" tiene que traer la cotizacion ${cotizacion.codigo}`).toContain(cotizacion.codigo);
        });
      }
    });

    // El documento (del que salen el PDF y el Word) y el "Ver detalle" de la fila. Con pablo1
    // se comprueba que traen alguna marca; sin eso, que la ajena no las vea no probaria nada.
    const documentos: Array<{ nombre: string; url: () => string; conMarcas: boolean }> = [
      { nombre: 'documento de la cotizacion (PDF/Word)', url: () => `/site/custom-tours/quotes/${cotizacion.id}/print`, conMarcas: false },
      { nombre: 'Ver detalle de la cotizacion', url: () => cotizacion.verDetalle, conMarcas: false },
    ];

    await paso(page, 'pablo1: sus documentos de la cotizacion muestran las marcas que despues se buscan', async () => {
      const informe: string[] = [];
      for (const doc of documentos) {
        const r = await abrirYBuscarMarcas(page, doc.url(), marcas);
        doc.conMarcas = r.encontradas.length > 0;
        informe.push(`${doc.nombre}: HTTP ${r.estado}, marcas visibles: ${r.encontradas.join(' | ') || 'ninguna'}`);
        if (!doc.conMarcas) test.info().annotations.push({ type: 'aviso', description: `El ${doc.nombre} de pablo1 no muestra codigo, referencia ni pasajero: el chequeo ajeno de ese documento no es concluyente y se omite.` });
      }
      await adjuntarTexto('Documentos propios de pablo1', informe.join('\n'));
      expect(documentos.some((d) => d.conMarcas), 'Al menos un documento de la cotizacion tiene que mostrar sus marcas para poder compararlo con el ajeno').toBe(true);
    });

    await paso(ajena, 'autoqa.markups: el historial no lista la cotizacion de pablo1, ni filtrando ni sin filtrar', async () => {
      const busquedas: Array<[string, string | undefined]> = [
        ['sin filtro', undefined], ['por codigo', cotizacion.codigo], ['por numero', cotizacion.id],
        ...(cotizacion.referencia.length >= 6 ? [['por referencia', cotizacion.referencia] as [string, string]] : []),
      ];
      const informe: string[] = [];
      for (const [como, q] of busquedas) {
        const filas = await filasDeCotizaciones(ajena, q);
        const laDeOtro = filas.filter((f) => f.id === cotizacion.id || f.codigo === cotizacion.codigo);
        const deLaAgenciaDeOtro = filas.filter((f) => f.agencia === cotizacion.agencia);
        informe.push(`${como}: ${filas.length} filas, la cotizacion de pablo1: ${laDeOtro.length}, filas de la agencia "${cotizacion.agencia}": ${deLaAgenciaDeOtro.length}`);
        await conResaltado(ajena, ajena.locator('main'), `Historial ajeno ${como}`, () => {
          expect(laDeOtro, `El historial de otra agencia (${como}) no tiene que listar la cotizacion ${cotizacion.codigo}`).toHaveLength(0);
          expect(deLaAgenciaDeOtro, `El historial de otra agencia (${como}) no tiene que listar cotizaciones de la agencia "${cotizacion.agencia}"`).toHaveLength(0);
        });
      }
      // El filtro "Agencia" del historial: la persona solo puede elegir lo que el combo le ofrece.
      const combo = ajena.locator('main').getByRole('combobox', { name: 'Agencia' });
      const ofrece = (await combo.count()) ? (await combo.locator('option').allInnerTexts()).map((t) => t.trim()) : [];
      informe.push(`Filtro Agencia de la ajena: ${ofrece.length ? ofrece.join(', ') : 'no lo tiene'}`);
      await conResaltado(ajena, ajena.locator('main'), 'Filtro Agencia de la ajena', () => {
        expect(ofrece, `El filtro de agencia de otra agencia no tiene que ofrecer "${cotizacion.agencia}"`).not.toContain(cotizacion.agencia);
      });
      await adjuntarTexto('Historial de cotizaciones de autoqa.markups', informe.join('\n'));
    });

    await paso(ajena, 'autoqa.markups: los documentos de esa cotizacion, abiertos por URL directa, no muestran nada de pablo1', async () => {
      for (const doc of documentos.filter((d) => d.conMarcas)) {
        const r = await abrirYBuscarMarcas(ajena, doc.url(), marcas);
        await adjuntarTexto(`Ajeno: ${doc.nombre}`, `HTTP ${r.estado}\nURL final: ${r.urlFinal}\nMarcas de pablo1 que se ven: ${r.encontradas.join(' | ') || 'ninguna'}\n\n${r.contenido.slice(0, 3000)}`);
        await conResaltado(ajena, ajena.locator('body'), `Ajeno: ${doc.nombre}`, () => {
          expect(r.encontradas, `Otra agencia no tiene que poder ver el ${doc.nombre} de la cotizacion ${cotizacion.codigo} de pablo1 (se ven: ${r.encontradas.join(', ')})`).toHaveLength(0);
        });
      }
    });
  });
});
