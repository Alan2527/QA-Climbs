import { test, expect, Page } from '@playwright/test';
import { TarifarioPage } from '../../pages/tarifario.page';
import { paso, adjuntarTexto } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const T = candidatos.tarifario;

/**
 * Bloque A — Tarifario.
 *
 * Recorrido natural, sin atajos por URL: se entra por el menu, se eligen los
 * filtros, se presiona Buscar, se abre la pestania y se busca el item por
 * nombre en el buscador de la pantalla.
 *
 * Un test por pestania: quedan diferenciados en Allure y el fallo de uno no
 * tapa el resultado de los demas.
 */
test.describe('Tarifario', () => {

  type Config = {
    tab: string; container: string; nombre: string; id: number;
    cityIdBusqueda: number; terminoBusqueda: string;
  };

  /**
   * Ciudad a filtrar por pestania: el crucero sale de Punta Arenas/Ushuaia,
   * el resto de los candidatos son de Buenos Aires.
   */
  const CIUDAD: Record<string, string> = {
    'a-cruises': 'Ushuaia',
    // La oferta se lista bajo Ushuaia; con Buenos Aires la pestania ni se renderiza
    // (es un PlaceHolder condicional que solo aparece si hay ofertas para esa ciudad).
    'a-opportunities': 'Ushuaia',
  };

  test.beforeEach(async ({ page }) => {
    // Landing del portal despues del login; desde ahi se navega por el menu.
    await page.goto('/online/');
    await new TarifarioPage(page).irDesdeElMenu();
  });

  async function validarItem(page: Page, cfg: Config, titulo: string) {
    const tarifario = new TarifarioPage(page);
    const ciudad = CIUDAD[cfg.tab] ?? 'Buenos Aires';

    await paso(page, `1. Filtrar por Argentina / ${ciudad} y buscar`, async () => {
      await tarifario.seleccionarPais('Argentina');
      await tarifario.seleccionarCiudad(ciudad);
      const filtros = await tarifario.filtrosActuales();
      await adjuntarTexto('Filtros aplicados',
        `Pais: ${filtros.pais}\nCiudad: ${filtros.ciudad}`);
      await tarifario.buscar();
    });

    await paso(page, `2. Abrir la pestania ${titulo} y esperar tarifas`, async () => {
      const disponible = await tarifario.pestaniaEstaDisponible(cfg.tab);
      expect(disponible, `La pestania ${titulo} (#${cfg.tab}) no esta visible`).toBe(true);
      await tarifario.abrirPestania(cfg.tab, cfg.container);
    });

    await paso(page, `3. Buscar "${cfg.terminoBusqueda}" en el buscador de la pantalla`, async () => {
      await tarifario.buscarPorNombre(cfg.terminoBusqueda, cfg.nombre);
    });

    await paso(page, `4. El item aparece con su nombre exacto`, async () => {
      const texto = await tarifario.textoDe(cfg.container);
      await adjuntarTexto('Esperado', `ID: ${cfg.id}\nNombre: ${cfg.nombre}`);
      await adjuntarTexto('Obtenido en pantalla', texto.slice(0, 3000));
      expect(texto, `No se encontro "${cfg.nombre}" en #${cfg.container}`)
        .toContain(cfg.nombre);
    });

    return tarifario;
  }

  test('Paquetes: trae tarifas y muestra el paquete esperado', async ({ page }) => {
    const t = await validarItem(page, T.paquetes as Config, 'Paquetes');
    await paso(page, '5. El paquete muestra sus dos ciudades', async () => {
      const texto = await t.textoDe(T.paquetes.container);
      for (const c of T.paquetes.ciudades) {
        expect(texto, `Falta la ciudad ${c.nombre}`).toContain(c.nombre);
      }
    });
  });

  test('Excursiones: trae tarifas y muestra la excursion esperada', async ({ page }) => {
    await validarItem(page, T.excursiones as Config, 'Excursiones');
  });

  test('Hoteles: trae tarifas y muestra el hotel esperado', async ({ page }) => {
    await validarItem(page, T.hoteles as Config, 'Hoteles');
  });

  test('Traslados: trae tarifas y muestra el traslado esperado', async ({ page }) => {
    await validarItem(page, T.traslados as Config, 'Traslados');
  });

  test('Cena Show: trae tarifas y muestra el show esperado', async ({ page }) => {
    await validarItem(page, T.cenaShow as Config, 'Cena Show');
  });

  // Las cabinas no figuran en la card del listado: se ven al abrir el detalle
  // ("Ver Tarifario"). Esa validacion queda para el test de detalle.
  test('Cruceros: trae tarifas y muestra el crucero esperado', async ({ page }) => {
    await validarItem(page, T.cruceros as Config, 'Cruceros');
  });

  test('Ofertas: trae tarifas y muestra la oferta esperada', async ({ page }) => {
    const t = await validarItem(page, T.ofertas as Config, 'Ofertas');
    await paso(page, '5. La oferta muestra sus dos ciudades', async () => {
      const texto = await t.textoDe(T.ofertas.container);
      for (const c of T.ofertas.ciudades) {
        expect(texto, `Falta la ciudad ${c.nombre}`).toContain(c.nombre);
      }
    });
  });
});
