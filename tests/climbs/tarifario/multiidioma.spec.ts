import { test, expect, Page } from '@playwright/test';
import { TarifarioNuevoPage } from '../../../pages/climbs/tarifario.page';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';

/**
 * TARIFARIO — app nueva (ClimbsApp). Multiidioma del encabezado: el selector de idioma cambia
 * el nombre y la descripcion que muestra el tarifario. Los mismos dos tests que
 * tests/bloque-a/multiidioma.spec.ts. Lo que se exige sale de la base (nombres y fragmentos de
 * la descripcion en cada idioma), no de la pantalla. Los rotulos de la pantalla se traducen,
 * asi que las solapas y los filtros se ubican por su posicion. Deja el sitio en espanol.
 */
test.describe('Tarifario — multiidioma del encabezado', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  const IDIOMAS = [
    { codigo: 'ES' as const, nombre: 'Español', titulo: 'AUTO-QA NO TOCAR - Tigre y Delta', busqueda: 'Tigre y Delta', marca: 'SALIDAS' },
    { codigo: 'EN' as const, nombre: 'Inglés', titulo: 'AUTO-QA NO TOCAR - Tigre and Delta', busqueda: 'Tigre and Delta', marca: 'DEPARTURES' },
    { codigo: 'PT' as const, nombre: 'Portugués', titulo: 'AUTO-QA NO TOCAR - TIGRE E DELTA', busqueda: 'TIGRE E DELTA', marca: 'SAÍDAS' },
  ];

  /** Titulo de la card sin las pastillas, y con lo del parentesis como pastilla. */
  async function tituloYPastillas(t: TarifarioNuevoPage, nombre: string) {
    const { nombre: n, pastillas } = await t.tituloDeLaCard(t.card(nombre));
    return { nombre: n, pastillas, conPastilla: pastillas.length ? `${n} (${pastillas.join(' ')})` : n };
  }

  async function irAlTarifario(page: Page, idioma: (typeof IDIOMAS)[number], solapa: string, destino: string) {
    const portal = new PortalNuevoPage(page);
    const t = new TarifarioNuevoPage(page);
    await portal.abrirInicio();
    await portal.cambiarIdioma(idioma.codigo);
    expect(await portal.idiomaActivo(), `El encabezado tiene que quedar en ${idioma.codigo} despues de elegir ${idioma.nombre}`).toBe(idioma.codigo);
    await page.getByRole('banner').locator('nav a[href^="/site/tariff"]').click();
    await expect(page.locator('main').getByRole('tablist').first()).toBeVisible({ timeout: 60_000 });
    await t.filtrar('Argentina', destino);
    await t.abrirSolapa(solapa);
    return t;
  }

  test('El contenido del tarifario se muestra en el idioma elegido', async ({ page }) => {
    test.setTimeout(900_000);
    try {
      for (const idioma of IDIOMAS) {
        let t!: TarifarioNuevoPage;
        await paso(page, `Pasar el sitio a ${idioma.nombre} y buscar la excursion`, async () => {
          t = await irAlTarifario(page, idioma, 'Excursiones', 'Buenos Aires');
          await t.buscarPorNombre(idioma.busqueda, idioma.titulo);
        });
        await paso(page, `El nombre y la descripcion estan en ${idioma.nombre}`, async () => {
          const card = t.card(idioma.titulo);
          const { nombre } = await tituloYPastillas(t, idioma.titulo);
          const texto = await card.innerText();
          await adjuntarTexto(`Card en ${idioma.nombre}`, `${nombre}\n${texto.slice(0, 400)}`);
          await conResaltado(page, card, `Nombre en ${idioma.nombre}`, () => {
            expect(nombre, `En ${idioma.nombre} la card tiene que mostrar el nombre de ese idioma`).toBe(idioma.titulo);
            expect(texto.toUpperCase(), `En ${idioma.nombre} la descripcion tiene que ser la de ese idioma`).toContain(idioma.marca);
            if (idioma.codigo !== 'ES') {
              expect(nombre, `En ${idioma.nombre} el nombre no puede ser el espanol`).not.toBe(IDIOMAS[0].titulo);
              expect(texto.toUpperCase(), `En ${idioma.nombre} la descripcion no puede traer la marca del espanol`).not.toContain(IDIOMAS[0].marca);
            }
          });
        });
      }
    } finally {
      await new PortalNuevoPage(page).abrirInicio().catch(() => {});
      await new PortalNuevoPage(page).cambiarIdioma('ES').catch(() => {});
    }
  });

  test('El tarifario muestra hoteles, paquetes y ofertas en el idioma elegido', async ({ page }) => {
    test.setTimeout(900_000);
    const ITEMS = [
      {
        clave: 'hoteles', solapa: 'Hoteles', destino: 'Buenos Aires',
        // El nombre del hotel es uno solo para todos los idiomas: se exige la descripcion.
        nombreUnico: 'AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau',
        busqueda: { ES: 'Park Hyatt', EN: 'Park Hyatt', PT: 'Park Hyatt' },
        nombre: null as Record<string, string> | null,
        marca: { ES: 'barrio selecto de Recoleta', EN: 'Allow Park Hyatt Buenos Aires', PT: 'está localizado' },
      },
      {
        clave: 'paquetes', solapa: 'Paquetes', destino: 'Buenos Aires', nombreUnico: null,
        busqueda: { ES: 'Paquete Buenos Aires', EN: 'Buenos Aires and Ushuaia Package', PT: 'Pacote Buenos Aires' },
        nombre: {
          ES: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)',
          EN: 'AUTO-QA NO TOCAR - Buenos Aires and Ushuaia Package (6 days / 5 nights)',
          PT: 'AUTO-QA NO TOCAR - Pacote Buenos Aires e Ushuaia (6 dias / 5 noites)',
        } as Record<string, string> | null,
        marca: { ES: 'Paquete de datos fijos para pruebas automatizadas', EN: 'Fixed data package for automated testing', PT: 'Pacote de dados fixos para testes automatizados' },
      },
      {
        clave: 'ofertas', solapa: 'Ofertas', destino: 'Ushuaia', nombreUnico: null,
        busqueda: { ES: 'Oferta Buenos Aires', EN: 'Buenos Aires and Ushuaia Offer', PT: 'Oferta Buenos Aires' },
        nombre: {
          ES: 'AUTO-QA NO TOCAR - Oferta Buenos Aires y Ushuaia (6 días / 5 noches)',
          EN: 'AUTO-QA NO TOCAR - Buenos Aires and Ushuaia Offer (6 days / 5 nights)',
          PT: 'AUTO-QA NO TOCAR - Oferta Buenos Aires e Ushuaia (6 dias / 5 noites)',
        } as Record<string, string> | null,
        marca: { ES: 'Oferta de datos fijos para pruebas automatizadas', EN: 'Fixed data offer for automated testing', PT: 'Oferta de dados fixos para testes automatizados' },
      },
    ];
    try {
      for (const idioma of IDIOMAS) {
        const codigo = idioma.codigo;
        for (const item of ITEMS) {
          await paso(page, `${item.clave} en ${idioma.nombre}`, async () => {
            const t = await irAlTarifario(page, idioma, item.solapa, item.destino);
            const esperado = item.nombre ? item.nombre[codigo] : item.nombreUnico!;
            await t.buscarPorNombre(item.busqueda[codigo], esperado);
            const card = t.card(esperado);
            const { nombre, conPastilla } = await tituloYPastillas(t, esperado);
            const texto = await card.innerText();
            await adjuntarTexto(`Card de ${item.clave} en ${idioma.nombre}`, `${conPastilla}\n${texto.slice(0, 400)}`);
            await conResaltado(page, card, `${item.clave} en ${idioma.nombre}`, () => {
              if (item.nombre) {
                // La card muestra la duracion del parentesis como pastilla: mismo nombre con otra forma.
                expect([nombre, conPastilla], `En ${idioma.nombre} la card tiene que mostrar el nombre de ese idioma`).toContain(item.nombre[codigo]);
                if (codigo !== 'ES') expect(conPastilla, `En ${idioma.nombre} el nombre no puede ser el espanol`).not.toBe(item.nombre.ES);
              } else {
                expect(nombre, 'El nombre del hotel es uno solo para todos los idiomas: tiene que ser el mismo en los tres').toBe(item.nombreUnico);
              }
              expect(texto, `En ${idioma.nombre} la descripcion de ${item.clave} tiene que ser la de ese idioma`).toContain(item.marca[codigo]);
              if (codigo !== 'ES') expect(texto, `En ${idioma.nombre} la descripcion no puede traer la marca del espanol`).not.toContain(item.marca.ES);
            });
          });
        }
      }
    } finally {
      await new PortalNuevoPage(page).abrirInicio().catch(() => {});
      await new PortalNuevoPage(page).cambiarIdioma('ES').catch(() => {});
    }
  });
});
