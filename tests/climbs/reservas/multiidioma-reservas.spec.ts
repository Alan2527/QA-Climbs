import { test, expect } from '@playwright/test';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { CircuitoNuevoPage } from '../../../pages/climbs/circuito.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, conResaltado } from '../../../utils/pasos';
import { SERVICIO_DE_REGRESION } from '../comun/precondiciones';

/**
 * RESERVAS — app nueva (ClimbsApp). Multiidioma de las pantallas de reserva.
 *
 * Los mismos dos tests que tests/bloque-b/multiidioma-reservas.spec.ts, con los mismos titulos.
 * - Carrito y checkout: el carrito se arma una vez en espanol y se recorre en los tres
 *   idiomas; se exige el nombre del servicio en el idioma elegido (el que tiene cargado el
 *   servicio). Las etiquetas de la pantalla se adjuntan y no se exigen (ninguna US las define).
 * - Multidestino: armado, detalle y carrito; ahi si se exigen los textos (US 4613, Idiomas):
 *   el nombre del paquete en el idioma elegido y que no quede en espanol ningun texto de la
 *   lista que se vio en espanol en esa misma pantalla.
 * No emite. El primero vacia el carrito al final; el segundo deja la cotizacion que crea
 * cualquier armado de multidestino.
 */
test.describe('Reservas — multiidioma', () => {
  const IDIOMAS = [
    { codigo: 'ES' as const, nombre: 'Español', titulo: 'AUTO-QA NO TOCAR - Tigre y Delta' },
    { codigo: 'EN' as const, nombre: 'Inglés', titulo: 'AUTO-QA NO TOCAR - Tigre and Delta' },
    { codigo: 'PT' as const, nombre: 'Portugués', titulo: 'AUTO-QA NO TOCAR - TIGRE E DELTA' },
  ];
  const ESPANIOL = IDIOMAS[0];

  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Carrito y checkout: el servicio se muestra en el idioma elegido', async ({ page }) => {
    test.setTimeout(900_000);
    const portal = new PortalNuevoPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

    try {
      await paso(page, 'Vaciar el carrito, dejar el sitio en espanol y agregar el servicio', async () => {
        await portal.abrirInicio();
        await portal.cambiarIdioma('ES');
        await portal.vaciarCarrito();
        await portal.buscarServicios(fechaDeBusqueda());
        await portal.elegirServicio(SERVICIO_DE_REGRESION.termino, ESPANIOL.titulo);
        await portal.agregarAlCarrito(SERVICIO_DE_REGRESION.modalidad, await portal.minimoDePasajeros(SERVICIO_DE_REGRESION.modalidad));
        await expect.poll(() => portal.itemsEnElCarrito(), { timeout: 30_000 }).toBe(1);
      });

      for (const idioma of IDIOMAS) {
        await paso(page, `Pasar el sitio a ${idioma.nombre} y abrir el carrito`, async () => {
          await portal.abrirInicio();
          await portal.cambiarIdioma(idioma.codigo);
          await conResaltado(page, portal.botonDeIdioma, `Encabezado en ${idioma.nombre}`, async () => {
            expect(await portal.idiomaActivo(), `El encabezado tiene que quedar en ${idioma.codigo} despues de elegir ${idioma.nombre}`).toBe(idioma.codigo);
          });
          // Cambiar el idioma no puede vaciar el carrito: esta atado al usuario, no al idioma.
          await expect.poll(() => portal.itemsEnElCarrito(), { timeout: 30_000, message: `El carrito tiene que conservar el item al pasar a ${idioma.nombre}` }).toBe(1);
          await page.goto('/site/cart');
          const item = page.locator('main article').first();
          await expect(item, 'El carrito tiene que mostrar el item agregado').toBeVisible({ timeout: 30_000 });
          const nombre = (await item.getByRole('heading').innerText()).replace(/\s+/g, ' ').trim();
          await adjuntarTexto(`Carrito en ${idioma.nombre}`, `item: ${nombre}\n\n${(await page.locator('main').innerText()).replace(/\n{2,}/g, '\n')}`);
          await conResaltado(page, item, `Nombre en el carrito en ${idioma.nombre}`, () => {
            expect(nombre, `En ${idioma.nombre} el carrito tiene que mostrar el nombre de ese idioma, el que tiene cargado el servicio`).toContain(idioma.titulo);
            if (idioma.codigo !== 'ES') expect(nombre, `En ${idioma.nombre} el carrito no puede mostrar el nombre en espanol`).not.toContain(ESPANIOL.titulo);
          });
        });

        await paso(page, `Pasar al checkout en ${idioma.nombre}`, async () => {
          await page.locator('main').getByRole('textbox').first().fill(`AUTO-QA ${sello}`);
          await page.locator('main').getByRole('complementary').getByRole('button').nth(1).click();
          await expect(page, 'Reservar tiene que llevar a los datos de la reserva').toHaveURL(/\/site\/checkout/, { timeout: 60_000 });
          const item = page.locator('main article').first();
          await expect(item, 'El checkout tiene que mostrar el item de la reserva').toBeVisible({ timeout: 30_000 });
          const nombre = (await item.getByRole('heading').innerText()).replace(/\s+/g, ' ').trim();
          await adjuntarTexto(`Checkout en ${idioma.nombre}`, `item: ${nombre}`);
          await conResaltado(page, item, `Nombre en el checkout en ${idioma.nombre}`, () => {
            expect(nombre, `En ${idioma.nombre} el checkout tiene que mostrar el nombre de ese idioma`).toContain(idioma.titulo);
            if (idioma.codigo !== 'ES') expect(nombre, `En ${idioma.nombre} el checkout no puede mostrar el nombre en espanol`).not.toContain(ESPANIOL.titulo);
          });
        });
      }
    } finally {
      await paso(page, 'Volver el sitio a espanol y vaciar el carrito', async () => {
        await portal.abrirInicio();
        await portal.cambiarIdioma('ES');
        await portal.vaciarCarrito();
        expect(await portal.itemsEnElCarrito(), 'El test no puede dejar items en el carrito').toBe(0);
      });
    }
  });

  test('Multidestino: armado, detalle y carrito se muestran en el idioma elegido', async ({ page }) => {
    test.setTimeout(900_000);
    const portal = new PortalNuevoPage(page);
    const ct = new CircuitoNuevoPage(page);
    const PAQUETE = {
      nombre: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)',
      porIdioma: {
        ES: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia',
        EN: 'AUTO-QA NO TOCAR - Buenos Aires and Ushuaia Package',
        PT: 'AUTO-QA NO TOCAR - Pacote Buenos Aires e Ushuaia',
      } as Record<string, string>,
    };
    // La misma lista que la suite actual: solo se exigen los que se ven en espanol en la pantalla.
    const TEXTOS_EN_ESPANIOL = [
      'faltan habitaciones', 'Todavía no armaste las habitaciones', 'Opciones de visualizacion',
      'Itinerario', 'Cambiar', 'Sin hotel', 'No hay hoteles seleccionados', 'No hay servicios seleccionados',
    ];
    const normalizar = (s: string) => s.replace(/\s+/g, ' ').toLowerCase();

    /** Recorre una pantalla en los tres idiomas sin salir de ella (el cambio de idioma no recarga). */
    const revisarPantalla = async (pantalla: string, conTitulo: boolean, url: RegExp) => {
      let visiblesEnEspaniol: string[] = [];
      for (const idioma of IDIOMAS) {
        await paso(page, `${pantalla} en ${idioma.nombre}`, async () => {
          await portal.cambiarIdioma(idioma.codigo);
          await expect(page, `${pantalla} tiene que seguir abierta despues de cambiar el idioma`).toHaveURL(url);
          await page.waitForTimeout(1_500);
          const texto = normalizar(await page.locator('main').innerText());
          const presentes = TEXTOS_EN_ESPANIOL.filter((t) => texto.includes(normalizar(t)));
          if (idioma.codigo === 'ES') {
            visiblesEnEspaniol = presentes;
            await adjuntarTexto(`${pantalla}: textos de la lista a la vista en espanol`, presentes.join('\n') || '(ninguno)');
          } else {
            await adjuntarTexto(`${pantalla}: textos en espanol que siguen en ${idioma.nombre}`, presentes.join('\n') || '(ninguno)');
            await conResaltado(page, page.locator('main'), `${pantalla} sin textos en espanol`, () => {
              expect(presentes.filter((t) => visiblesEnEspaniol.includes(t)), `En ${idioma.nombre} ${pantalla} no puede mostrar textos en espanol (US 4613, Idiomas)`).toEqual([]);
            });
          }
          if (conTitulo) {
            const titulo = page.getByRole('heading', { level: 1 }).first();
            const nombre = (await titulo.innerText()).replace(/\s+/g, ' ').trim();
            await conResaltado(page, titulo, `Nombre del paquete en ${idioma.nombre}`, () => {
              expect(nombre, `En ${idioma.nombre} ${pantalla} tiene que mostrar el nombre del paquete de ese idioma`).toContain(PAQUETE.porIdioma[idioma.codigo]);
            });
          }
        });
      }
      await portal.cambiarIdioma('ES');
    };

    await paso(page, 'Dejar el sitio en espanol y abrir el armado del paquete', async () => {
      await portal.abrirInicio();
      await portal.cambiarIdioma('ES');
      await ct.buscarViaje('MULTIDESTINO', { pais: 'Argentina', ciudad: 'Buenos Aires', nombre: PAQUETE.nombre, fecha: fechaDeBusqueda() });
    });
    // El armado se revisa antes de cargar habitaciones: "faltan habitaciones" solo se ve en ese estado.
    await revisarPantalla('El armado', true, /\/site\/custom-tours\/\d+$/);

    await paso(page, 'Cargar fecha, pax y habitaciones y pasar al detalle', async () => {
      await ct.configurarViaje(2, 1);
      await ct.irAlItinerario();
    });
    await revisarPantalla('El detalle', true, /\/site\/custom-tours\/\d+\/detail/);

    await paso(page, 'Pasar al carrito del multidestino', async () => {
      await ct.continuarAlCarrito();
    });
    await revisarPantalla('El carrito', true, /\/site\/custom-tours\/\d+\/cart/);
  });
});
