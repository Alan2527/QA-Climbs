import { test, expect, Page } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import candidatos from '../../../data/candidatos.json';

/**
 * WEBADMIN — app nueva (ClimbsApp). Humo de pantallas.
 *
 * Los mismos dos tests que tests/webadmin/humo-pantallas.spec.ts, con los mismos titulos. En la
 * app nueva el WebAdmin y el BO comparten un solo menu: se recorren todas sus pantallas, como la
 * persona, abriendo cada area del menu y cada enlace (lo pendiente de migrar se ve sin enlace y no
 * se abre). Solo abre, no guarda nada.
 *
 * Cada pantalla tiene que abrir sin excepcion de JavaScript sin atrapar, sin respuestas 5xx de la
 * API, sin el aviso "No se pudo cargar" de la grilla o ficha, sin "No encontramos esta pagina" ni
 * "Ocurrio un error inesperado", y sin mandar al login (sesion perdida).
 *
 * Las fichas de los datos propios se abren solapa por solapa, en claro y en oscuro: el modo oscuro
 * se prende con el boton "Modo oscuro" del menu (la app lo aplica con `data-theme="dark"`) y se
 * exige que se aplique y que no queden bloques grandes con fondo blanco. Al final vuelve a claro.
 */
test.describe('WebAdmin — humo de pantallas', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const FICHAS: { nombre: string; url: string }[] = [
    { nombre: `Hotel ${candidatos.extensionTarifas.hotelId}`, url: `/hotels/hotels/${candidatos.extensionTarifas.hotelId}` },
    { nombre: `Habitacion ${candidatos.extensionTarifas.roomId}`, url: `/hotels/rooms/${candidatos.extensionTarifas.roomId}` },
    { nombre: `Servicio ${candidatos.tarifasServicio.servicioId}`, url: `/services/services/${candidatos.tarifasServicio.servicioId}` },
    { nombre: `Agencia ${candidatos.markups.agencia.id}`, url: `/clients/agencies/${candidatos.markups.agencia.id}` },
    { nombre: `Mercado ${candidatos.markups.mercado.id}`, url: `/finance/markets/${candidatos.markups.mercado.id}` },
    { nombre: `Serie ${candidatos.serieWebAdmin.serieId}`, url: `/series/series/${candidatos.serieWebAdmin.serieId}` },
    { nombre: `Paquete ${candidatos.serieWebAdmin.tourId}`, url: `/packages/packages/${candidatos.serieWebAdmin.tourId}` },
  ];

  type Resultado = { url: string; problemas: string[]; tema?: string };

  /** Junta lo que este mal mientras corre `accion`. No falla aca: el test lista todo junto al final. */
  async function revisar(page: Page, url: string, accion: () => Promise<void>): Promise<Resultado> {
    const problemas: string[] = [];
    const alError = (e: Error) => problemas.push(`Excepcion de JavaScript: ${e.message.split('\n')[0]}`);
    const alResponder = (r: { url(): string; status(): number }) => {
      if (r.url().includes('/api/') && r.status() >= 500) problemas.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`);
    };
    page.on('pageerror', alError);
    page.on('response', alResponder);
    try {
      await accion().catch((e: Error) => problemas.push(`No abrio: ${e.message.split('\n')[0]}`));
      await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => problemas.push('Quedo cargando mas de 60 s'));
      await page.waitForTimeout(500);
      if (/\/login/.test(new URL(page.url()).pathname)) problemas.push(`Mando al login: ${page.url()}`);
      const errorDeCarga = page.locator('.empty--error').filter({ visible: true });
      if (await errorDeCarga.count()) problemas.push(`No se pudo cargar: ${(await errorDeCarga.first().innerText()).replace(/\s+/g, ' ').slice(0, 200)}`);
      for (const aviso of ['No encontramos esta página', 'Ocurrió un error inesperado']) {
        if (await page.getByText(aviso).first().isVisible().catch(() => false)) problemas.push(`Aviso: ${aviso}`);
      }
    } finally {
      page.off('pageerror', alError);
      page.off('response', alResponder);
    }
    return { url, problemas };
  }

  /** Las pantallas del menu: cada area se abre con su boton y lista sus enlaces. */
  async function pantallasDelMenu(page: Page): Promise<string[]> {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Áreas' });
    await expect(nav).toBeVisible({ timeout: 60_000 });
    const fuera = /^(Favoritos|Idioma|Modo oscuro|Modo claro|Ir al inicio)$/;
    // Los botones de area son iconos: su nombre va en aria-label.
    const areas = (await nav.getByRole('button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') ?? '')))
      .filter((t) => t && !fuera.test(t));
    const rutas = new Set<string>();
    for (const area of areas) {
      await nav.getByRole('button', { name: area, exact: true }).click();
      const panel = page.getByRole('complementary', { name: area });
      await expect(panel).toBeVisible();
      for (const href of await panel.getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) {
        if (href.startsWith('/')) rutas.add(href);
      }
    }
    return [...rutas];
  }

  async function estadoDelTema(page: Page): Promise<string> {
    return page.evaluate(() => {
      const oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
      const fondo = getComputedStyle(document.body).backgroundColor;
      const blancos = Array.from(document.querySelectorAll<HTMLElement>('div, table, thead, th, section, [role=dialog]'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 300 && r.height > 60 && el.offsetParent !== null && getComputedStyle(el).backgroundColor === 'rgb(255, 255, 255)';
        }).length;
      return `dark=${oscuro} fondo=${fondo} bloquesBlancos=${blancos}`;
    });
  }

  /** El boton del menu alterna el tema: se toca hasta que quede el pedido. */
  async function ponerTema(page: Page, tema: 'light' | 'dark') {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Áreas' });
    await expect(nav).toBeVisible({ timeout: 60_000 });
    const actual = async () => ((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark' ? 'dark' : 'light');
    if ((await actual()) !== tema) await nav.getByRole('button', { name: /^Modo (oscuro|claro)/ }).click();
    await expect.poll(actual, { message: `El tema tiene que quedar en ${tema}` }).toBe(tema);
  }

  function informe(resultados: Resultado[]) {
    return resultados.map((r) => [
      `${r.problemas.length ? 'MAL' : 'ok '} ${r.url}${r.tema ? `  [${r.tema}]` : ''}`,
      ...r.problemas.map((p) => `      ${p}`),
    ].join('\n')).join('\n');
  }

  test('Todas las pantallas del menu abren sin error', async ({ page }) => {
    test.setTimeout(1_800_000);
    const resultados: Resultado[] = [];
    let rutas: string[] = [];

    await paso(page, 'Recorrer las areas del menu y juntar sus pantallas', async () => {
      rutas = await pantallasDelMenu(page);
      await adjuntarTexto('Pantallas del menu', rutas.join('\n'));
      expect(rutas.length, 'El menu tiene que ofrecer pantallas').toBeGreaterThan(20);
    });

    await paso(page, `Abrir las ${rutas.length} pantallas del menu`, async () => {
      for (const ruta of rutas) resultados.push(await revisar(page, ruta, async () => { await page.goto(ruta, { timeout: 90_000 }); }));
      await adjuntarTexto('Pantallas del menu', informe(resultados));
    });

    await paso(page, 'Ninguna pantalla cae en error', async () => {
      const mal = resultados.filter((r) => r.problemas.length);
      expect(mal.map((r) => `${r.url}: ${r.problemas.join('; ')}`), 'Pantallas del menu que no abren bien').toEqual([]);
    });
  });

  test('Las fichas de los datos propios abren todas sus solapas, en claro y en oscuro', async ({ page }) => {
    test.setTimeout(1_800_000);
    const resultados: Resultado[] = [];

    try {
      for (const tema of ['light', 'dark'] as const) {
        await paso(page, `Abrir las fichas y sus solapas en modo ${tema === 'dark' ? 'oscuro' : 'claro'}`, async () => {
          await ponerTema(page, tema);
          const desde = resultados.length;
          for (const ficha of FICHAS) {
            const apertura = await revisar(page, ficha.url, async () => {
              await page.goto(ficha.url, { timeout: 90_000 });
              await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 60_000 });
            });
            const dialogo = page.getByRole('dialog').first();
            const solapas = (await dialogo.getByRole('tablist').first().getByRole('tab').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
            if (!solapas.length) resultados.push({ ...apertura, url: `${ficha.nombre} (${ficha.url})` });
            for (const [i, solapa] of solapas.entries()) {
              const r = await revisar(page, `${ficha.nombre} › ${solapa}`, async () => {
                await dialogo.getByRole('tablist').first().getByRole('tab').nth(i).click();
              });
              if (i === 0) r.problemas.unshift(...apertura.problemas);
              if (tema === 'dark') {
                r.tema = await estadoDelTema(page).catch(() => 'sin medir');
                if (!/dark=true/.test(r.tema)) r.problemas.push('No aplico el modo oscuro');
                const blancos = Number(r.tema.match(/bloquesBlancos=(\d+)/)?.[1] ?? 0);
                if (blancos) r.problemas.push(`En modo oscuro quedan ${blancos} bloques grandes con fondo blanco`);
              }
              resultados.push(r);
            }
          }
          await adjuntarTexto(`Fichas en modo ${tema}`, informe(resultados.slice(desde)));
        });
      }
    } finally {
      await ponerTema(page, 'light').catch(() => {});
    }

    await paso(page, 'Ninguna solapa cae en error', async () => {
      const mal = resultados.filter((r) => r.problemas.length);
      expect(mal.map((r) => `${r.url}${r.tema ? ' (oscuro)' : ''}: ${r.problemas.join('; ')}`), 'Solapas de las fichas que no abren bien').toEqual([]);
    });
  });
});
