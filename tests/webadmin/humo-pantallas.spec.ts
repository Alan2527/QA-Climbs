import { test, expect, Page } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, esperarFinDeCarga } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

/**
 * WebAdmin — humo de pantallas.
 *
 * El WebAdmin es lo que mas cambia (Admin.Master, los componentes y el modo oscuro se
 * tocan casi a diario) y una pantalla caida no la ve ningun otro test: `rooms/detail`
 * estuvo dando 500 por la tabla de la estadia minima (4870) hasta que alguien la abrio.
 *
 * Solo abre, no guarda nada: cada entrada del menu (`Admin.sitemap`) y cada solapa de
 * las fichas de los datos propios, y exige que ninguna caiga en error del servidor,
 * en el aviso de error de la pantalla, en una excepcion de JavaScript sin atrapar ni
 * en el login (sesion perdida). Las fichas se abren en claro y en oscuro: el tema lo
 * aplica `Admin.Master` desde `localStorage['admin-theme']`, y en oscuro se exige que
 * se haya aplicado y que no queden bloques grandes con fondo blanco.
 *
 * Abrir el Dashboard no regenera nada (lo hacen sus botones): se incluye.
 */
test.describe('WebAdmin — humo de pantallas', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  /** Las entradas del menu, tal cual las lista `Admin.sitemap` en la rama qa. */
  const MENU = [
    'default.aspx', 'dashboard/default.aspx',
    'agencies/', 'agencies/passengergalleries.aspx', 'customers/', 'businessgroups/', 'markets/default.aspx',
    'collaborators/default.aspx', 'contacts/default.aspx', 'correspondents/default.aspx',
    'corporate/corpcompanies.aspx', 'corporate/corpcustomers.aspx', 'opportunities/',
    'hotels/default.aspx', 'hotels/hotelcategories.aspx', 'hotels/mealtypes.aspx', 'hotels/breakfasttypes.aspx',
    'hotels/integration.aspx', 'rooms/default.aspx',
    'services/default.aspx', 'services/servicetypes.aspx', 'services/charasteristicsadmin.aspx', 'services/tags.aspx',
    'receptivetours/', 'customtours/', 'series/', 'offers/offerdetail.aspx',
    'cruises/cruises.aspx', 'cruises/cruisenavies.aspx', 'cruisecabs/default.aspx', 'cruisecabs/cruisecabtypes.aspx',
    'restaurants/', 'restaurants/foodtypes.aspx', 'meetingsalons/', 'eventconferences/default.aspx',
    'vehicletypes/default.aspx', 'destinations/default.aspx', 'cities/', 'regions/default.aspx',
    'booking/default.aspx', 'booking/defaultcancel.aspx', 'budgets/default.aspx', 'budgets/defaultsingle.aspx',
    'travelsale/', 'loyaltypoints/default.aspx', 'rewards/default.aspx', 'rewards/benefitdefault.aspx',
    'gifts/default.aspx', 'incentives/Servicedefault.aspx', 'benchmarks/', 'benchmarks/benchmarktypes.aspx',
    'Currency/Currency.aspx', 'CurrencyExchange/CurrencyExchange.aspx', 'ChangeRate/ChangeRate.aspx', 'Taxes/Taxes.aspx',
    'types/amenities.aspx', 'types/serviceamenities.aspx', 'types/country.aspx', 'types/districts.aspx',
    'types/ratetypes.aspx', 'types/roomtypes.aspx', 'types/usertypes.aspx',
    'configuration/banner.aspx', 'configuration/contentPage.aspx', 'showcases/default.aspx', 'popup/default.aspx',
    'news/default.aspx', 'newslettersubscriptions/default.aspx', 'comments/default.aspx', 'ourteam/default.aspx',
    'surveys/default.aspx', 'signaturelink/', 'systempolicies/', 'appmobile/default.aspx',
    'widget/default.aspx', 'widget/booking/default.aspx', 'localization/localeStringResources.aspx',
    'reports/webusage.aspx', 'audit/default.aspx', 'settings/Default.aspx',
  ];

  /** Las fichas de los datos propios, con sus solapas (los `pnl*` que son solapa, no modal). */
  const FICHAS: { nombre: string; url: string; solapas: string[] }[] = [
    {
      nombre: `Hotel ${candidatos.extensionTarifas.hotelId}`,
      url: `hotels/detail.aspx?hotel=${candidatos.extensionTarifas.hotelId}`,
      solapas: ['pnlHotelDetails', 'pnlHotelRooms', 'pnlAmenities', 'pnlPolicies', 'pnlHotelImages', 'pnlVideos',
        'pnlHotelProviders', 'pnlHotelTechnicalSheet', 'pnlBenchmarks', 'pnlIntegrationMatch'],
    },
    {
      nombre: `Habitacion ${candidatos.extensionTarifas.roomId}`,
      url: `rooms/detail.aspx?room=${candidatos.extensionTarifas.roomId}`,
      solapas: ['pnlRoomDetails', 'pnlRoomRates', 'pnlRoomRatesResident', 'pnlTariffs', 'pnlTariffsResident',
        'pnlTariffDetails', 'pnlTariffDetailsResident', 'pnlFreeSale', 'pnlMinStay'],
    },
    {
      nombre: `Servicio ${candidatos.tarifasServicio.servicioId}`,
      url: `services/detail.aspx?service=${candidatos.tarifasServicio.servicioId}`,
      solapas: ['pnlServicioDetails', 'pnlRates', 'pnlResidentRates', 'pnlCalendar', 'pnlTime', 'pnlObservations',
        'pnlIncludedAmenities', 'pnlCharasteristics', 'pnlAdditional', 'pnlProviders', 'pnlImages', 'pnlVideos'],
    },
    {
      nombre: `Agencia ${candidatos.markups.agencia.id}`,
      url: `agencies/detail.aspx?agency=${candidatos.markups.agencia.id}`,
      solapas: ['pnlDetails', 'pnlWebUsers', 'pnlProductSetting', 'pnlAgencyACL', 'pnlClients', 'pnlVendors',
        'pnlFiles', 'pnlSixLetter'],
    },
    {
      nombre: `Mercado ${candidatos.markups.mercado.id}`,
      url: `markets/detail.aspx?market=${candidatos.markups.mercado.id}`,
      solapas: ['pnlDetails'],
    },
    {
      nombre: `Serie ${candidatos.serieWebAdmin.serieId}`,
      url: `series/detail.aspx?SerieID=${candidatos.serieWebAdmin.serieId}`,
      solapas: ['pnlDetails', 'pnlPackage', 'pnlSeriesDepartures', 'pnlSeriesQuotas', 'pnlSeriesTariffs', 'pnlSeriesOptionals'],
    },
    {
      nombre: `Paquete ${candidatos.serieWebAdmin.tourId}`,
      url: `receptivetours/detail.aspx?tour=${candidatos.serieWebAdmin.tourId}`,
      solapas: ['pnlDetails', 'pnlDestinations', 'pnlHotels', 'pnlServices', 'pnlTarrifCut', 'pnlImagenes', 'pnlVideos'],
    },
  ];

  const ERROR_DEL_SERVIDOR = /Server Error in|Error de servidor en la aplicaci|Runtime Error|Error en tiempo de ejecuci|Object reference not set|Referencia a objeto no establecida/i;

  /**
   * Pantallas que muestran errores como contenido: Auditoria lista los errores de la
   * API (con su "Object reference not set..."). Ahi no se busca el texto del error,
   * solo el resto de los chequeos.
   */
  const LISTAN_ERRORES = ['audit/default.aspx'];

  /**
   * Excepciones de JavaScript que ya estaban, medidas el 14/10 sin efecto visible.
   * Se ignoran para que el test marque lo nuevo, no lo de siempre:
   * - Habitacion: `RoomRateControl.ascx.cs:98` registra la llamada a
   *   `setCheckBoxesRoomRate()` antes de que el control la defina (hotfix 4354, 08/07).
   *   El "seleccionar todas" de la grilla de tarifas igual funciona (7 de 7 filas).
   * - Agencia: la ficha carga el `bootstrap.min.js` del widget (desde 2024) sobre el
   *   jQuery 1.8.1 del sitio, y Bootstrap exige 1.9.1 o mayor.
   */
  const EXCEPCIONES_CONOCIDAS: { pantalla: RegExp; mensaje: RegExp }[] = [
    { pantalla: /^rooms\/detail\.aspx/, mensaje: /setCheckBoxesRoomRate is not defined/ },
    { pantalla: /^agencies\/detail\.aspx/, mensaje: /Bootstrap's JavaScript requires jQuery version 1\.9\.1/ },
  ];

  type Resultado = { url: string; problemas: string[]; consola: string[]; tema?: string };

  /**
   * Abre una direccion y junta lo que este mal. No falla aca: devuelve los problemas
   * para que el test los liste todos juntos al final, en vez de cortar en el primero.
   */
  async function abrir(page: Page, ruta: string): Promise<Resultado> {
    const problemas: string[] = [];
    const consola: string[] = [];
    const alError = (e: Error) => {
      const mensaje = e.message.split('\n')[0];
      const conocida = EXCEPCIONES_CONOCIDAS.some((x) => x.pantalla.test(ruta) && x.mensaje.test(mensaje));
      if (!conocida) problemas.push(`Excepcion de JavaScript: ${mensaje}`);
    };
    const alMensaje = (m: { type(): string; text(): string }) => {
      if (m.type() === 'error') consola.push(m.text().slice(0, 200));
    };
    page.on('pageerror', alError);
    page.on('console', alMensaje);
    try {
      const resp = await page.goto(`/administration/${ruta}`, { timeout: 90_000 }).catch((e: Error) => {
        problemas.push(`No abrio: ${e.message.split('\n')[0]}`);
        return null;
      });
      if (resp && resp.status() >= 500) problemas.push(`HTTP ${resp.status()}`);
      await esperarFinDeCarga(page).catch(() => problemas.push('Quedo cargando mas de 60 s'));
      await page.waitForTimeout(500);

      if (/login/i.test(new URL(page.url()).pathname)) problemas.push(`Mando al login: ${page.url()}`);
      const cuerpo = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
      const caida = LISTAN_ERRORES.includes(ruta) ? null : cuerpo.match(ERROR_DEL_SERVIDOR);
      if (caida) problemas.push(`Error del servidor: "${caida[0]}"`);
      const aviso = page.locator('.messageBox.messageBoxError').filter({ visible: true });
      if (await aviso.count()) problemas.push(`Aviso de error: ${(await aviso.first().innerText()).trim().slice(0, 200)}`);
    } finally {
      page.off('pageerror', alError);
      page.off('console', alMensaje);
    }
    return { url: ruta, problemas, consola };
  }

  /** Para el oscuro: si el tema quedo aplicado y cuantos bloques grandes quedaron en blanco puro. */
  async function estadoDelTema(page: Page): Promise<string> {
    return page.evaluate(() => {
      const oscuro = document.documentElement.classList.contains('dark');
      const fondo = getComputedStyle(document.body).backgroundColor;
      const blancos = Array.from(document.querySelectorAll<HTMLElement>('div, table, thead, th, section, .card, .modal-content'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 300 && r.height > 60 && el.offsetParent !== null
            && getComputedStyle(el).backgroundColor === 'rgb(255, 255, 255)';
        }).length;
      return `dark=${oscuro} fondo=${fondo} bloquesBlancos=${blancos}`;
    });
  }

  function informe(resultados: Resultado[]) {
    return resultados.map((r) => [
      `${r.problemas.length ? 'MAL' : 'ok '} ${r.url}${r.tema ? `  [${r.tema}]` : ''}`,
      ...r.problemas.map((p) => `      ${p}`),
      ...(r.consola.length ? [`      consola (${r.consola.length}): ${r.consola.slice(0, 3).join(' | ')}`] : []),
    ].join('\n')).join('\n');
  }

  test('Todas las pantallas del menu abren sin error', async ({ page }) => {
    test.setTimeout(1_800_000);
    const resultados: Resultado[] = [];

    await paso(page, `Abrir las ${MENU.length} pantallas del menu`, async () => {
      for (const ruta of MENU) resultados.push(await abrir(page, ruta));
      await adjuntarTexto('Pantallas del menu', informe(resultados));
    });

    await paso(page, 'Ninguna pantalla cae en error', async () => {
      const mal = resultados.filter((r) => r.problemas.length);
      expect(mal.map((r) => `${r.url}: ${r.problemas.join('; ')}`),
        'Pantallas del menu que no abren bien').toEqual([]);
    });
  });

  test('Las fichas de los datos propios abren todas sus solapas, en claro y en oscuro', async ({ page }) => {
    test.setTimeout(1_800_000);
    const resultados: Resultado[] = [];

    for (const tema of ['light', 'dark'] as const) {
      await paso(page, `Abrir las fichas y sus solapas en modo ${tema === 'dark' ? 'oscuro' : 'claro'}`, async () => {
        await page.goto('/administration/default.aspx');
        await page.evaluate((t) => localStorage.setItem('admin-theme', t), tema);
        const desde = resultados.length;
        for (const ficha of FICHAS) {
          for (const solapa of ficha.solapas) {
            const r = await abrir(page, `${ficha.url}&TabID=${solapa}`);
            if (tema === 'dark') {
              r.tema = await estadoDelTema(page).catch(() => 'sin medir');
              // Medido el 14/10: las 59 solapas aplican el tema y ninguna deja bloques grandes en blanco.
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

    await page.evaluate(() => localStorage.setItem('admin-theme', 'light')).catch(() => {});

    await paso(page, 'Ninguna solapa cae en error', async () => {
      const mal = resultados.filter((r) => r.problemas.length);
      expect(mal.map((r) => `${r.url}${r.tema ? ' (oscuro)' : ''}: ${r.problemas.join('; ')}`),
        'Solapas de las fichas que no abren bien').toEqual([]);
    });
  });
});
