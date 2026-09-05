import { test, expect, Page, Locator } from '@playwright/test';
import { TarifarioPage } from '../../pages/tarifario.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, resaltarYCapturar, reiniciarNumeracionDePasos,
} from '../../utils/pasos';

/**
 * BLOQUE A — filtros de la cabecera y carrusel de la card.
 *
 * Cubre lo que la auditoria de cobertura del tarifario dejo pendiente: el
 * contador de resultados, el boton Limpiar, los chips de categoria de Hoteles,
 * el filtro Proveedor y las imagenes de la card, de la que hasta ahora solo se
 * validaba el `src` de la primera.
 *
 * Va en un archivo aparte a proposito: los siete tests de `tarifario.spec.ts`
 * estan terminados y en verde, y sumarles esto obligaria a editarlos. Se
 * comparte el page object, que es lo estable.
 *
 * Se trabaja sobre **Hoteles** porque es la unica pestania que tiene las cuatro
 * cosas: contador, chips de categoria, filtro de proveedor y cards con carrusel.
 *
 * El portal tiene selector de idioma pero **no tiene tema oscuro**: no aplica esa
 * consideracion transversal.
 */
test.describe('Tarifario — filtros y card', () => {

  const HOTELES = { tab: 'a-hotels', container: 'hotels-container' };
  const SALTO = String.fromCharCode(10);

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await page.goto('/online/');
    await new TarifarioPage(page).irDesdeElMenu();
  });

  async function conResaltado(
    page: Page, locator: Locator, etiqueta: string, fn: () => void | Promise<void>,
  ) {
    try {
      await fn();
    } catch (error) {
      await resaltarYCapturar(page, locator, `FALLA: ${etiqueta}`);
      expect.soft(false, (error as Error).message).toBe(true);
    }
  }

  /** Cards renderizadas en la pestania. El listado pagina, asi que no son todas. */
  const cardsVisibles = async (page: Page) =>
    page.locator(`#${HOTELES.container} .tariff-card:visible`).count();

  /**
   * Numero que muestra el contador de resultados.
   *
   * **Cuenta el resultado entero, no las cards renderizadas**: el listado pagina
   * con scroll, asi que el contador dice 100 mientras en pantalla hay 12.
   * Comparar una cosa contra la otra da un rojo que no es un defecto.
   */
  const numeroDelContador = async (page: Page): Promise<number> => {
    const texto = (await page.locator('#tariffResultCount').innerText()).replace(/\s+/g, ' ').trim();
    return Number(texto.match(/\d+/)?.[0] ?? -1);
  };

  /** Abre Hoteles con los filtros base. */
  async function abrirHoteles(page: Page): Promise<TarifarioPage> {
    const tarifario = new TarifarioPage(page);
    await paso(page, 'Filtrar por Argentina / Buenos Aires y abrir Hoteles', async () => {
      await tarifario.seleccionarPais('Argentina');
      await tarifario.seleccionarCiudad('Buenos Aires');
      await tarifario.buscar();
      const disponible = await tarifario.pestaniaEstaDisponible(HOTELES.tab);
      expect(disponible, 'La pestania Hoteles tiene que estar visible').toBe(true);
      await tarifario.abrirPestania(HOTELES.tab, HOTELES.container);
    });
    return tarifario;
  }

  /**
   * El boton de refresco de cada pestania (`.tariff-update-btn`, `arefresh-*`)
   * **no se cubre**: existe en el markup, esta cableado en `mainws.js` y tiene sus
   * estilos completos, pero `StyleTariff.css:583` lo deja en `display: none`, asi
   * que un usuario no lo puede tocar. Testearlo obligaria a forzar un clic sobre
   * algo invisible, que no es lo que hace una persona.
   */
  test('Cabecera: el contador, los chips de categoria y Limpiar acompanan al listado', async ({ page }) => {
    test.setTimeout(600_000);
    const tarifario = await abrirHoteles(page);

    const contador = page.locator(tarifario.contadorResultados);
    const limpiar = page.locator(tarifario.btnLimpiarFiltros);
    const chips = page.locator('#tariffCategoryTags');
    let totalSinFiltros = 0;

    await paso(page, 'El contador informa el resultado de la busqueda', async () => {
      totalSinFiltros = await numeroDelContador(page);
      const renderizadas = await cardsVisibles(page);
      const texto = (await contador.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Contador de resultados',
        `"${texto}" | cards renderizadas: ${renderizadas}`);

      await conResaltado(page, contador, 'Contador con resultados', () => {
        expect(totalSinFiltros,
          `El contador tiene que informar cuantos hoteles trajo la busqueda. Dice: "${texto}"`)
          .toBeGreaterThan(0);
        // El listado pagina: lo que se ve nunca puede ser mas que lo que hay.
        expect(renderizadas,
          'No puede haber mas cards renderizadas que resultados informados por el contador')
          .toBeLessThanOrEqual(totalSinFiltros);
      });

      await conResaltado(page, contador, 'Contador con la ciudad filtrada', () => {
        expect(texto, 'El contador tiene que nombrar la ciudad por la que se filtro')
          .toContain('Buenos Aires');
      });
    });

    await paso(page, 'Los chips de categoria aparecen y acotan el listado', async () => {
      await expect(
        chips,
        'Hoteles tiene que mostrar los chips de categoria: se arman con las categorias ' +
        'de los hoteles listados (renderCategoryTags)',
      ).toBeVisible({ timeout: 30_000 });

      const etiquetas = await chips.locator('button, a, span').allInnerTexts();
      const nombres = etiquetas.map((e) => e.replace(/\s+/g, ' ').trim()).filter(Boolean);
      await adjuntarTexto('Chips de categoria', nombres.join(' | '));
      expect(nombres.length, 'Tiene que haber al menos una categoria para filtrar')
        .toBeGreaterThan(0);

      const primerChip = chips.locator('button, a').first();
      const categoria = (await primerChip.innerText()).replace(/\s+/g, ' ').trim();
      await primerChip.click();
      await esperarFinDeCarga(page);

      const conCategoria = await numeroDelContador(page);
      const textoFiltrado = (await contador.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Listado filtrado por categoria',
        `${categoria}: ${conCategoria} de ${totalSinFiltros} | contador: "${textoFiltrado}"`);

      await conResaltado(page, chips, 'El chip acota el listado', () => {
        expect(conCategoria,
          `Filtrar por ${categoria} tiene que dejar menos hoteles que sin filtrar`)
          .toBeLessThan(totalSinFiltros);
        expect(conCategoria, `Filtrar por ${categoria} no puede dejar el listado vacio`)
          .toBeGreaterThan(0);
      });

      await conResaltado(page, contador, 'El contador nombra la categoria', () => {
        expect(textoFiltrado, 'El contador tiene que nombrar la categoria elegida')
          .toContain(categoria);
      });
    });

    await paso(page, 'Limpiar aparece con filtros activos y devuelve el listado completo', async () => {
      // clearBtn solo se muestra cuando hay filtros (updateMeta), asi que su sola
      // aparicion ya es parte del resultado esperado.
      await conResaltado(page, limpiar, 'Limpiar visible con filtros', async () => {
        await expect(limpiar, 'Con un filtro activo, Limpiar tiene que estar a la vista')
          .toBeVisible({ timeout: 30_000 });
      });

      await limpiar.click();
      await esperarFinDeCarga(page);

      const despues = await numeroDelContador(page);
      await adjuntarTexto('Listado despues de limpiar', `${despues} de ${totalSinFiltros}`);
      await conResaltado(page, page.locator(`#${HOTELES.container}`), 'Listado restaurado', () => {
        expect(despues, 'Limpiar tiene que devolver el listado completo')
          .toBe(totalSinFiltros);
      });

      await conResaltado(page, limpiar, 'Limpiar se esconde sin filtros', async () => {
        await expect(limpiar, 'Sin filtros activos, Limpiar tiene que dejar de mostrarse')
          .toBeHidden({ timeout: 30_000 });
      });
    });

    await paso(page, 'El filtro de Proveedor acota el listado', async () => {
      const toggle = page.locator('#tsfFilterToggle');
      // Nace con display:none y se muestra solo cuando la pestania tiene
      // proveedores para ofrecer. Si no aparece, se deja constancia en vez de
      // fallar: que no haya proveedores para filtrar no es un defecto.
      if (!(await toggle.isVisible())) {
        await adjuntarTexto('Filtro de Proveedor',
          'No se ofrece en esta pestania con estos filtros. No se valida.');
        return;
      }

      await toggle.click();
      await esperarFinDeCarga(page);
      const opciones = page.locator('.tsf-panel input[type="checkbox"], .tsf-panel li');
      const cuantas = await opciones.count();
      await adjuntarTexto('Proveedores ofrecidos', String(cuantas));
      expect(cuantas, 'Abierto el filtro, tiene que ofrecer al menos un proveedor')
        .toBeGreaterThan(0);

      await opciones.first().click();
      await esperarFinDeCarga(page);
      const conProveedor = await numeroDelContador(page);
      await adjuntarTexto('Listado filtrado por proveedor',
        `${conProveedor} de ${totalSinFiltros}`);

      await conResaltado(page, toggle, 'El proveedor acota el listado', () => {
        expect(conProveedor, 'Filtrar por proveedor no puede dejar el listado vacio')
          .toBeGreaterThan(0);
        expect(conProveedor, 'Filtrar por proveedor tiene que acotar el listado')
          .toBeLessThanOrEqual(totalSinFiltros);
      });
    });
  });

  test('Card: el carrusel trae todas las imagenes del hotel', async ({ page }) => {
    test.setTimeout(600_000);
    const tarifario = await abrirHoteles(page);

    await paso(page, 'Ubicar el hotel candidato', async () => {
      await tarifario.buscarPorNombre('Park Hyatt', 'AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau');
    });

    await paso(page, 'La card trae sus imagenes y ninguna es el placeholder', async () => {
      // El carrusel es un Repeater sobre Images.Take(3): una card puede traer
      // hasta tres. Hasta ahora se validaba solo el src de la primera.
      const card = page.locator(`#${HOTELES.container} .tariff-card`).first();
      const imagenes = card.locator('.tariff-image-view img.carousel-img');
      const cuantas = await imagenes.count();

      const srcs = await imagenes.evaluateAll((imgs) =>
        imgs.map((i) => (i as HTMLImageElement).getAttribute('src') ?? ''));
      await adjuntarTexto('Imagenes de la card', `${cuantas}${SALTO}${srcs.join(SALTO)}`);

      await conResaltado(page, card, 'Cantidad de imagenes', () => {
        expect(cuantas, 'La card del hotel tiene que traer al menos una imagen')
          .toBeGreaterThan(0);
        expect(cuantas, 'El carrusel no puede traer mas de tres imagenes (Images.Take(3))')
          .toBeLessThanOrEqual(3);
      });

      await conResaltado(page, card, 'Imagenes reales', () => {
        for (const src of srcs) {
          expect(src, 'Ninguna imagen del carrusel puede venir vacia').not.toBe('');
          expect(src.toLowerCase(),
            'Ninguna imagen del carrusel puede ser el placeholder: el hotel tiene imagenes cargadas')
            .not.toContain('no-image');
        }
        expect(new Set(srcs).size, 'El carrusel no tiene que repetir la misma imagen')
          .toBe(srcs.length);
      });
    });

    await paso(page, 'La navegacion del carrusel cambia la imagen a la vista', async () => {
      const card = page.locator(`#${HOTELES.container} .tariff-card`).first();
      const puntos = card.locator('.owl-dot');
      const cuantosPuntos = await puntos.count();
      await adjuntarTexto('Puntos de navegacion del carrusel', String(cuantosPuntos));

      if (cuantosPuntos < 2) {
        // Con una sola imagen owl no dibuja navegacion: no hay nada que probar y
        // tampoco es un defecto.
        await adjuntarTexto('Navegacion del carrusel',
          'La card trae una sola imagen: el carrusel no dibuja navegacion.');
        return;
      }

      // Se sigue el punto activo y no la imagen: owl mueve el `.owl-stage` con un
      // transform y deja varios items marcados como activos, asi que "la imagen a
      // la vista" no se puede leer de forma estable. El punto activo si.
      const activoAntes = await puntos.locator('.active, [class*="active"]').count()
        ? await card.locator('.owl-dot.active').first().getAttribute('class')
        : '';
      const indiceAntes = await card.locator('.owl-dot').evaluateAll((ds) =>
        ds.findIndex((d) => d.classList.contains('active')));

      await puntos.nth(1).click();
      await page.waitForTimeout(1200);

      const indiceDespues = await card.locator('.owl-dot').evaluateAll((ds) =>
        ds.findIndex((d) => d.classList.contains('active')));
      await adjuntarTexto('Punto activo del carrusel',
        `antes: ${indiceAntes}${SALTO}despues: ${indiceDespues}${SALTO}clase: ${activoAntes}`);

      await conResaltado(page, card, 'Navegacion del carrusel', () => {
        expect(indiceDespues, 'Pasar al segundo punto tiene que mover el carrusel')
          .not.toBe(indiceAntes);
        expect(indiceDespues, 'El punto elegido tiene que quedar como el activo').toBe(1);
      });
    });
  });
});
