import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AgenciaNuevaPage } from '../../../pages/climbs/agencia.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { porTarifa, compararPrecios } from '../../../utils/markups';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import { leerTarifasDelPortal, tarifasDelPortal, ItemDelPortal } from '../comun/tarifario-del-portal';
import candidatos from '../../../data/candidatos.json';

const M = candidatos.markups;
const E = candidatos.extensionTarifas;
const SALTO = String.fromCharCode(10);
const HOTEL: ItemDelPortal = { solapa: 'Hoteles', nombre: E.hotelNombre, terminoBusqueda: E.terminoBusqueda };

/**
 * WEBADMIN — app nueva (ClimbsApp). Condiciones comerciales de una agencia por producto.
 *
 * El mismo test que tests/webadmin/condiciones-comerciales.spec.ts, con el mismo titulo. En la
 * app nueva "Config. de productos" es la solapa "Configuracion de productos" de la agencia en el
 * Backoffice: "Agregar configuracion" con tipo, pais, ciudad, producto y "Excluir" o un markup.
 *
 * Sobre la agencia propia 6334 y el hotel propio 15422, mirando el portal nuevo con
 * `autoqa.markups`. Un markup por producto de 0,50 tiene que duplicar el precio
 * (techo(tarifa / markups / 0,50)), como en el sistema actual. "Excluido" tiene que dejar al
 * hotel sin tarifas para esa agencia. Al terminar borra las condiciones del hotel, aunque falle.
 */
test.describe('WebAdmin — condiciones comerciales por producto', () => {
  test.describe.configure({ mode: 'serial' });

  let contexto: BrowserContext;
  let portal: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto, pagina: portal } = await abrirSesionDeOtraAgencia(browser, baseURL));
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const CONDICION = { tipo: 'Hoteles', pais: 'Argentina', ciudad: 'Buenos Aires', producto: E.hotelNombre };
  const sinMarca = (filas: string[][]) => filas.map((f) => f.map((c) => c.replace(/\s*Tarifa extendida/gi, '').trim()));

  test('Un markup por producto cambia el precio del hotel y "Excluido" lo deja sin tarifas para la agencia', async ({ page }) => {
    test.setTimeout(600_000);
    const agencia = new AgenciaNuevaPage(page);
    let antes = new Map<string, number>();

    await paso(page, `Verificar que la agencia ${M.agencia.id} no tenga condiciones para el hotel ${E.hotelId}`, async () => {
      await agencia.abrir(M.agencia.id);
      const filas = await agencia.configuracionesDeProductos(E.hotelNombre);
      await adjuntarTexto('Condiciones del hotel', filas.map((f) => f.join(' | ')).join(SALTO) || 'ninguna');
      // Si quedo alguna de una corrida que se corto, se borra antes de medir.
      if (filas.length) await agencia.borrarConfiguraciones(E.hotelNombre);
    });

    await paso(portal, 'Leer en el portal el tarifario del hotel', async () => {
      const filas = sinMarca(await tarifasDelPortal(portal, HOTEL));
      antes = porTarifa(filas);
      await adjuntarTexto('Hotel sin condiciones', filas.map((f) => f.join(' | ')).join(SALTO));
      expect(antes.size, 'El hotel tiene que tener tarifas para la agencia').toBeGreaterThan(0);
    });

    try {
      await paso(page, 'WebAdmin: cargar un markup por producto de 0,50 para el hotel', async () => {
        await agencia.agregarConfiguracion({ ...CONDICION, excluido: false, markup: 0.5 });
        const filas = await agencia.configuracionesDeProductos(E.hotelNombre);
        await adjuntarTexto('Condicion cargada', filas.map((f) => f.join(' | ')).join(SALTO));
        expect(filas.length, 'La grilla tiene que mostrar la condicion del hotel').toBe(1);
      });

      await paso(portal, 'Portal: el precio del hotel se duplica', async () => {
        const filas = sinMarca(await tarifasDelPortal(portal, HOTEL));
        const { lineas, fuera } = compararPrecios(antes, porTarifa(filas), 1, 0.5);
        await adjuntarTexto('Comparacion', 'markup por producto 1 -> 0,50' + SALTO + SALTO + lineas.join(SALTO));
        // Soft: si no se cumple, igual se mide "Excluido".
        expect.soft(fuera, 'Tarifas que no aplican el markup por producto:' + SALTO + fuera.join(SALTO)).toEqual([]);
      });

      await paso(page, 'WebAdmin: reemplazar la condicion por "Excluido"', async () => {
        await agencia.borrarConfiguraciones(E.hotelNombre);
        await agencia.agregarConfiguracion({ ...CONDICION, excluido: true });
        const filas = await agencia.configuracionesDeProductos(E.hotelNombre);
        await adjuntarTexto('Condicion cargada', filas.map((f) => f.join(' | ')).join(SALTO));
        expect(filas.length, 'La grilla tiene que mostrar la condicion del hotel').toBe(1);
        expect(filas[0].join(' '), 'La condicion tiene que figurar como excluida').toContain('Excluido');
      });

      await paso(portal, 'Portal: el hotel excluido no ofrece tarifas a la agencia', async () => {
        const estado = await leerTarifasDelPortal(portal, HOTEL);
        const importes = porTarifa(estado.filas).size;
        await adjuntarTexto('Hotel excluido en el portal',
          `ofrecido por el buscador: ${estado.ofrecido}${SALTO}importes: ${importes}${SALTO}${SALTO}${estado.detalle}`);
        expect(importes, 'Excluido, el hotel no tiene que mostrar tarifas a la agencia').toBe(0);
      });
    } finally {
      await paso(page, `Limpiar: borrar las condiciones del hotel ${E.hotelId}`, async () => {
        await agencia.abrir(M.agencia.id);
        await agencia.borrarConfiguraciones(E.hotelNombre);
      });
    }
  });
});
