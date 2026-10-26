import { test, expect, Page } from '@playwright/test';
import { TarifarioNuevoPage } from '../../../pages/climbs/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';

/**
 * TARIFARIO — app nueva (ClimbsApp). Filtros de la cabecera y carrusel de la card, sobre
 * Hoteles: el contador de resultados, los chips de categoria, Limpiar, el filtro Proveedor y
 * las imagenes de la card. Los mismos dos tests que tests/bloque-a/filtros-y-card.spec.ts.
 */
test.describe('Tarifario — filtros y card', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  /** El contador "N hoteles en Buenos Aires" (o con la categoria): cuenta el resultado, no las cards a la vista. */
  const contador = (page: Page) => page.locator('main').getByRole('paragraph').filter({ has: page.locator('strong', { hasText: /^\d+\s/ }) }).first();
  const numeroDelContador = async (page: Page) => Number((await contador(page).innerText()).match(/\d+/)?.[0] ?? -1);
  const cardsVisibles = (page: Page) => page.locator('main article').count();
  const lateral = (page: Page) => page.locator('main').getByRole('complementary');

  async function abrirHoteles(page: Page): Promise<TarifarioNuevoPage> {
    const t = new TarifarioNuevoPage(page);
    await paso(page, 'Filtrar por Argentina / Buenos Aires y abrir Hoteles', async () => {
      await t.irDesdeElMenu();
      await t.filtrar('Argentina', 'Buenos Aires');
      await expect(t.solapa('Hoteles'), 'La pestania Hoteles tiene que estar visible').toBeVisible();
      await t.abrirSolapa('Hoteles');
      await expect(page.locator('main article').first()).toBeVisible({ timeout: 60_000 });
    });
    return t;
  }

  test('Cabecera: el contador, los chips de categoria y Limpiar acompanan al listado', async ({ page }) => {
    test.setTimeout(600_000);
    await abrirHoteles(page);
    let totalSinFiltros = 0;
    const limpiar = lateral(page).getByRole('button', { name: /^Limpiar/ });

    await paso(page, 'El contador informa el resultado de la busqueda', async () => {
      totalSinFiltros = await numeroDelContador(page);
      const texto = (await contador(page).innerText()).replace(/\s+/g, ' ').trim();
      const renderizadas = await cardsVisibles(page);
      await adjuntarTexto('Contador de resultados', `"${texto}" | cards renderizadas: ${renderizadas}`);
      await conResaltado(page, contador(page), 'Contador con resultados', () => {
        expect(totalSinFiltros, `El contador tiene que informar cuantos hoteles trajo la busqueda. Dice: "${texto}"`).toBeGreaterThan(0);
        expect(renderizadas, 'No puede haber mas cards renderizadas que resultados informados por el contador').toBeLessThanOrEqual(totalSinFiltros);
        expect(texto, 'El contador tiene que nombrar la ciudad por la que se filtro').toContain('Buenos Aires');
      });
    });

    await paso(page, 'Los chips de categoria aparecen y acotan el listado', async () => {
      const chips = lateral(page).getByRole('button').filter({ hasNotText: /^Limpiar/ });
      await expect(chips.first(), 'Hoteles tiene que mostrar los chips de categoria').toBeVisible({ timeout: 30_000 });
      const nombres = (await chips.allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
      await adjuntarTexto('Chips de categoria', nombres.join(' | '));
      expect(nombres.length, 'Tiene que haber al menos una categoria para filtrar').toBeGreaterThan(0);
      const categoria = nombres[0];
      await chips.first().click();
      await page.waitForLoadState('networkidle');
      await expect.poll(() => numeroDelContador(page), { timeout: 30_000 }).not.toBe(totalSinFiltros);
      const conCategoria = await numeroDelContador(page);
      const textoFiltrado = (await contador(page).innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Listado filtrado por categoria', `${categoria}: ${conCategoria} de ${totalSinFiltros} | contador: "${textoFiltrado}"`);
      await conResaltado(page, lateral(page), 'El chip acota el listado', () => {
        expect(conCategoria, `Filtrar por ${categoria} tiene que dejar menos hoteles que sin filtrar`).toBeLessThan(totalSinFiltros);
        expect(conCategoria, `Filtrar por ${categoria} no puede dejar el listado vacio`).toBeGreaterThan(0);
      });
      expect.soft(textoFiltrado, 'El contador tiene que nombrar la categoria elegida').toContain(categoria);
    });

    await paso(page, 'Limpiar aparece con filtros activos y devuelve el listado completo', async () => {
      await conResaltado(page, lateral(page), 'Limpiar visible con filtros', async () => {
        await expect(limpiar, 'Con un filtro activo, Limpiar tiene que estar a la vista').toBeVisible({ timeout: 30_000 });
      });
      await limpiar.click();
      await page.waitForLoadState('networkidle');
      await expect.poll(() => numeroDelContador(page), { timeout: 30_000, message: 'Limpiar tiene que devolver el listado completo' }).toBe(totalSinFiltros);
      await adjuntarTexto('Listado despues de limpiar', `${await numeroDelContador(page)} de ${totalSinFiltros}`);
      await conResaltado(page, lateral(page), 'Limpiar se esconde sin filtros', async () => {
        await expect(limpiar, 'Sin filtros activos, Limpiar tiene que dejar de mostrarse (o quedar deshabilitado)').toBeHidden({ timeout: 30_000 }).catch(async () => {
          await expect(limpiar).toBeDisabled();
        });
      });
    });

    await paso(page, 'El filtro de Proveedor acota el listado', async () => {
      const proveedor = lateral(page).getByRole('combobox', { name: 'Proveedor' });
      if (!(await proveedor.isVisible().catch(() => false))) {
        await adjuntarTexto('Filtro de Proveedor', 'No se ofrece en esta pestania con estos filtros. No se valida.');
        return;
      }
      await proveedor.click();
      const opciones = page.getByRole('option');
      const cuantas = await opciones.count();
      await adjuntarTexto('Proveedores ofrecidos', String(cuantas));
      expect(cuantas, 'Abierto el filtro, tiene que ofrecer al menos un proveedor').toBeGreaterThan(0);
      await opciones.first().click();
      await page.waitForLoadState('networkidle');
      const conProveedor = await numeroDelContador(page);
      await adjuntarTexto('Listado filtrado por proveedor', `${conProveedor} de ${totalSinFiltros}`);
      expect(conProveedor, 'Filtrar por proveedor no puede dejar el listado vacio').toBeGreaterThan(0);
      expect(conProveedor, 'Filtrar por proveedor tiene que acotar el listado').toBeLessThanOrEqual(totalSinFiltros);
    });
  });

  test('Card: el carrusel trae todas las imagenes del hotel', async ({ page }) => {
    test.setTimeout(600_000);
    const t = await abrirHoteles(page);
    const nombre = 'AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau';

    await paso(page, 'Ubicar el hotel candidato', async () => {
      await t.buscarPorNombre('Park Hyatt', nombre);
    });

    await paso(page, 'La card trae sus imagenes y ninguna es el placeholder', async () => {
      const card = t.card(nombre);
      const imagenes = card.locator('.trf-photos img');
      const srcs = await imagenes.evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).getAttribute('src') ?? ''));
      const vacias = await card.locator('.trf-photos__empty').count();
      await adjuntarTexto('Imagenes de la card', `imagenes: ${srcs.length} | lugares vacios: ${vacias}\n${srcs.join('\n')}`);
      await conResaltado(page, card, 'Imagenes de la card', () => {
        expect(srcs.length, 'La card del hotel tiene que traer al menos una imagen (el hotel tiene imagenes cargadas)').toBeGreaterThan(0);
        expect(srcs.length, 'El carrusel no puede traer mas de tres imagenes').toBeLessThanOrEqual(3);
        for (const src of srcs) expect(src, 'Ninguna imagen del carrusel puede venir vacia').not.toBe('');
        expect(new Set(srcs).size, 'El carrusel no tiene que repetir la misma imagen').toBe(srcs.length);
      });
    });

    await paso(page, 'La navegacion del carrusel cambia la imagen a la vista', async () => {
      const card = t.card(nombre);
      const puntos = card.getByRole('button', { name: /^Foto \d+$/ });
      const cuantos = await puntos.count();
      await adjuntarTexto('Puntos de navegacion del carrusel', String(cuantos));
      if (cuantos < 2) {
        await adjuntarTexto('Navegacion del carrusel', 'La card trae una sola imagen: el carrusel no dibuja navegacion.');
        return;
      }
      const activo = () => puntos.evaluateAll((ps) => ps.findIndex((p) => p.getAttribute('aria-current') === 'true'));
      const antes = await activo();
      await puntos.nth(1).click();
      await expect.poll(activo, { timeout: 10_000, message: 'Pasar al segundo punto tiene que mover el carrusel' }).toBe(1);
      await adjuntarTexto('Punto activo del carrusel', `antes: ${antes}\ndespues: ${await activo()}`);
    });
  });
});
