import { test, expect, Page, BrowserContext } from '@playwright/test';
import { WebAdminConfigProductosPage } from '../../pages/webadmin-config-productos.page';
import { TarifarioPage } from '../../pages/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, esperarFinDeCarga } from '../../utils/pasos';
import { abrirSesionDeMarkups, tarifasDe, porTarifa, compararPrecios, ItemDelTarifario } from '../../utils/markups';
import candidatos from '../../data/candidatos.json';

const M = candidatos.markups;
const E = candidatos.extensionTarifas;
const SALTO = String.fromCharCode(10);
const HOTEL: ItemDelTarifario = {
  tab: 'a-hotels', container: 'hotels-container', nombre: E.hotelNombre, terminoBusqueda: E.terminoBusqueda,
};

/**
 * WebAdmin — condiciones comerciales de una agencia por producto ("Config. de productos").
 *
 * Es lo que define que vende cada agencia y a que precio, producto por producto: un
 * markup propio para un hotel o un servicio, o excluirlo. Si se rompe, una agencia ve
 * un producto que no tendria que vender o lo ve con otro precio.
 *
 * Sobre la agencia propia 6334 y el hotel propio 15422, mirando el portal con
 * `autoqa.markups`. Un markup por producto de 0,50 divide el precio otra vez
 * (techo(tarifa / markups / 0,50)): tiene que duplicarse. "Excluido" tiene que dejar
 * al hotel sin tarifas para esa agencia. Al terminar borra las condiciones del hotel,
 * aunque falle.
 */
test.describe('WebAdmin — condiciones comerciales por producto', () => {
  test.describe.configure({ mode: 'serial' });

  let contexto: BrowserContext;
  let portal: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    const sesion = await abrirSesionDeMarkups(browser, baseURL);
    contexto = sesion.contexto;
    portal = sesion.pagina;
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const CONDICION = { tipo: '1', pais: '10', ciudad: '5000', producto: String(E.hotelId) };

  /**
   * Que muestra el portal del hotel: si el buscador del tarifario lo ofrece y, si lo
   * ofrece, cuantos importes trae su tarifario. No se exige nada: lo decide el paso.
   */
  async function queMuestraElPortal(): Promise<{ ofrecido: boolean; importes: number; detalle: string }> {
    const t = new TarifarioPage(portal);
    await portal.goto('/online/');
    await t.irDesdeElMenu();
    await t.seleccionarPais('Argentina');
    await t.seleccionarCiudad('Buenos Aires');
    await t.buscar();
    await t.abrirPestania(HOTEL.tab, HOTEL.container);
    try {
      await t.buscarPorNombre(HOTEL.terminoBusqueda, HOTEL.nombre);
    } catch (e) {
      return { ofrecido: false, importes: 0, detalle: String(e).slice(0, 300) };
    }
    await t.verTarifario(HOTEL.container).catch(() => {});
    await esperarFinDeCarga(portal);
    const filas = await t.leerTablaTarifas(HOTEL.container).catch(() => [] as string[][]);
    await t.cerrarExplorador().catch(() => {});
    return { ofrecido: true, importes: porTarifa(filas).size, detalle: filas.map((f) => f.join(' | ')).join(SALTO) };
  }

  test('Un markup por producto cambia el precio del hotel y "Excluido" lo deja sin tarifas para la agencia', async ({ page }) => {
    test.setTimeout(600_000);
    const admin = new WebAdminConfigProductosPage(page);
    let antes = new Map<string, number>();

    await paso(page, `Verificar que la agencia ${M.agencia.id} no tenga condiciones para el hotel ${E.hotelId}`, async () => {
      await admin.abrir(M.agencia.id);
      const filas = await admin.leerFilas(E.hotelNombre);
      await adjuntarTexto('Condiciones del hotel', filas.map((f) => f.join(' | ')).join(SALTO) || 'ninguna');
      // Si quedo alguna de una corrida que se corto, se borra antes de medir.
      if (filas.length) await admin.borrar(E.hotelNombre);
    });

    await paso(portal, 'Leer en el portal el tarifario del hotel', async () => {
      const filas = await tarifasDe(portal, HOTEL);
      antes = porTarifa(filas);
      await adjuntarTexto('Hotel sin condiciones', filas.map((f) => f.join(' | ')).join(SALTO));
      expect(antes.size, 'El hotel tiene que tener tarifas para la agencia').toBeGreaterThan(0);
    });

    try {
      await paso(page, 'WebAdmin: cargar un markup por producto de 0,50 para el hotel', async () => {
        await admin.agregar({ ...CONDICION, excluido: false, markup: 0.5 });
        const filas = await admin.leerFilas(E.hotelNombre);
        await adjuntarTexto('Condicion cargada', filas.map((f) => f.join(' | ')).join(SALTO));
        expect(filas.length, 'La grilla tiene que mostrar la condicion del hotel').toBe(1);
      });

      await paso(portal, 'Portal: el precio del hotel se duplica', async () => {
        const filas = await tarifasDe(portal, HOTEL);
        const { lineas, fuera } = compararPrecios(antes, porTarifa(filas), 1, 0.5);
        await adjuntarTexto('Comparacion', 'markup por producto 1 -> 0,50' + SALTO + SALTO + lineas.join(SALTO));
        expect(fuera, 'Tarifas que no aplican el markup por producto:' + SALTO + fuera.join(SALTO)).toEqual([]);
      });

      await paso(page, 'WebAdmin: reemplazar la condicion por "Excluido"', async () => {
        await admin.borrar(E.hotelNombre);
        await admin.agregar({ ...CONDICION, excluido: true, markup: 1 });
        const filas = await admin.leerFilas(E.hotelNombre);
        await adjuntarTexto('Condicion cargada', filas.map((f) => f.join(' | ')).join(SALTO));
        expect(filas.length, 'La grilla tiene que mostrar la condicion del hotel').toBe(1);
        expect(filas[0], 'La condicion tiene que figurar como excluida').toContain('SI');
      });

      await paso(portal, 'Portal: el hotel excluido no ofrece tarifas a la agencia', async () => {
        const estado = await queMuestraElPortal();
        await adjuntarTexto('Hotel excluido en el portal',
          `ofrecido por el buscador: ${estado.ofrecido}${SALTO}importes: ${estado.importes}${SALTO}${SALTO}${estado.detalle}`);
        expect(estado.importes, 'Excluido, el hotel no tiene que mostrar tarifas a la agencia').toBe(0);
      });
    } finally {
      await paso(page, `Limpiar: borrar las condiciones del hotel ${E.hotelId}`, async () => {
        await admin.abrir(M.agencia.id);
        await admin.borrar(E.hotelNombre);
      });
    }
  });
});
