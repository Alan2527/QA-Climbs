import { test, expect, Page } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage } from '../../pages/carrito.page';
import { CustomToursPage } from '../../pages/customtours.page';
import {
  paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda,
  formatearFecha, esperarFinDeCarga, conResaltado,
} from '../../utils/pasos';
import { SALTO } from './reservas-comun';

/**
 * Bloque B - multiidioma de las pantallas de reserva: carrito y checkout.
 *
 * El carrito se arma **una sola vez, en espanol**, por el mismo camino que el
 * test de Servicio, y despues se recorre en los tres idiomas. No se busca en
 * cada idioma a proposito: el buscador elige pais, ciudad y tipo por su
 * etiqueta, que se traduce, y el sujeto de este test no es el buscador —que ya
 * cubre el Bloque A— sino las pantallas donde se reserva.
 *
 * Que se exige y que no, con el mismo criterio que el resto de la suite:
 *
 * - **Se exige el nombre del servicio en el idioma elegido.** El carrito lo pide
 *   a la API con el idioma de trabajo (`ShoppingCartPage.aspx.cs:60`) y la API lo
 *   toma de `ServiceDetail` de ese idioma (`WholesalerBookingService.cs:815`). Es
 *   el mismo dato que ya exige el Bloque A en la card del tarifario, asi que los
 *   valores esperados son los de la base, no los de la pantalla.
 * - **Las etiquetas de la pantalla se adjuntan y no se exigen.** Salen del
 *   diccionario `Online/js/i18n.js`, y ninguna historia define que tengan que
 *   estar traducidas: compararlas seria inventar un resultado esperado, igual
 *   que se decidio en el asistente de series.
 *
 * No emite: llega al checkout y se detiene antes de confirmar. Lo unico que deja
 * es el item en el carrito, y el ultimo paso lo vacia.
 *
 * Va en el Bloque B, en un archivo propio pero dentro del mismo proyecto
 * secuencial: el carrito es del lado del servidor y esta atado a la sesion, asi
 * que este test no puede correr en paralelo con los que reservan.
 */
test.describe('Reservas — multiidioma', () => {

  /** Nombre del servicio 5 en cada idioma, tomado de `ServiceDetail` en QA. */
  const IDIOMAS = [
    { link: 'lnkEsp', codigo: 'ES', nombre: 'Español', titulo: 'AUTO-QA NO TOCAR - Tigre y Delta' },
    { link: 'lnkEng', codigo: 'EN', nombre: 'Inglés', titulo: 'AUTO-QA NO TOCAR - Tigre and Delta' },
    { link: 'lnkPor', codigo: 'PT', nombre: 'Portugués', titulo: 'AUTO-QA NO TOCAR - TIGRE E DELTA' },
  ];

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  /** Codigo del idioma activo, tal como lo muestra el encabezado. */
  async function idiomaActivo(page: Page): Promise<string> {
    return (await page.locator('.ddLanguage a.header-flug span').first().innerText())
      .replace(/\s+/g, ' ').trim().toUpperCase();
  }

  /**
   * Cambia el idioma desde el encabezado. El control esconde el idioma activo,
   * asi que si ya es el buscado no hay nada que hacer.
   */
  async function cambiarIdioma(page: Page, idioma: { link: string; codigo: string; nombre: string }) {
    if (await idiomaActivo(page) === idioma.codigo) return;
    await page.locator('.ddLanguage a.header-flug').first().click();
    const opcion = page.locator(`[id$='${idioma.link}']`).first();
    await expect(opcion, `El selector tiene que ofrecer ${idioma.nombre}`)
      .toBeVisible({ timeout: 30_000 });
    await opcion.click();
    await page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(page);
  }

  /** Clave y texto de cada etiqueta traducida por `i18n.js`, para el reporte. */
  async function etiquetasTraducidas(page: Page): Promise<string> {
    const pares = await page.locator('[data-i18n]').evaluateAll((els) =>
      els.map((e) => `${e.getAttribute('data-i18n')}: ${(e as HTMLElement).innerText.trim()}`));
    return pares.join(SALTO);
  }

  test('Carrito y checkout: el servicio se muestra en el idioma elegido', async ({ page }) => {
    test.setTimeout(900_000);

    const inicio = new InicioPage(page);
    const servicio = new ServicioPage(page);
    const carrito = new CarritoPage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda();
    const ESPANIOL = IDIOMAS[0];

    await paso(page, 'Vaciar el carrito, dejar el sitio en espanol y agregar el servicio', async () => {
      await cambiarIdioma(page, ESPANIOL);
      await carrito.vaciar();
      await inicio.abrir();
      const panel = await inicio.abrirSolapa('servicios');
      await servicio.buscar({
        panel, pais: 'Argentina', ciudad: 'Buenos Aires', tipo: 'Excursión', fecha,
      });
      await servicio.buscarPorNombre('Tigre y Delta', ESPANIOL.titulo);
      await servicio.abrirFicha(ESPANIOL.titulo.slice(0, 24));

      const bloque = servicio.bloqueDeModalidad('Regular');
      await expect(
        bloque,
        `La ficha tiene que ofrecer la modalidad Regular para el ${formatearFecha(fecha)}`,
      ).toBeVisible({ timeout: 30_000 });
      const texto = (await bloque.innerText()).replace(/\s+/g, ' ');
      const cantidad = Number(texto.match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
      await bloque.locator(servicio.comboPax).selectOption(String(cantidad));
      await esperarFinDeCarga(page);
      await page.locator("[id$='lnkBookService']").first().click();
      await esperarFinDeCarga(page);

      await expect.poll(() => carrito.paxEnElCarrito(), { timeout: 30_000 }).toBe(1);
    });

    for (const idioma of IDIOMAS) {
      await paso(page, `Pasar el sitio a ${idioma.nombre} y abrir el carrito`, async () => {
        await page.goto('/online/');
        await esperarFinDeCarga(page);
        await cambiarIdioma(page, idioma);

        await conResaltado(page, page.locator('.ddLanguage').first(), `Encabezado en ${idioma.nombre}`, async () => {
          expect(await idiomaActivo(page),
            `El encabezado tiene que quedar en ${idioma.codigo} despues de elegir ${idioma.nombre}`)
            .toBe(idioma.codigo);
        });

        // Cambiar el idioma no puede vaciar el carrito: esta atado a la sesion,
        // no al idioma.
        await expect.poll(() => carrito.paxEnElCarrito(), {
          timeout: 30_000,
          message: `El carrito tiene que conservar el item al pasar a ${idioma.nombre}`,
        }).toBe(1);

        await carrito.irAlCarrito();
        const fila = page.locator(carrito.filas).first();
        await expect(fila, 'El carrito tiene que mostrar el item agregado').toBeVisible();
        const nombre = (await fila.locator('.ct-row__name').innerText()).replace(/\s+/g, ' ').trim();
        await adjuntarTexto(`Carrito en ${idioma.nombre}`,
          `item: ${nombre}${SALTO}${SALTO}${await etiquetasTraducidas(page)}`);

        await conResaltado(page, fila, `Nombre en el carrito en ${idioma.nombre}`, () => {
          expect(nombre,
            `En ${idioma.nombre} el carrito tiene que mostrar el nombre de ese idioma, ` +
            'el que tiene cargado ServiceDetail')
            .toContain(idioma.titulo);
          if (idioma.codigo !== ESPANIOL.codigo) {
            expect(nombre, `En ${idioma.nombre} el carrito no puede mostrar el nombre en espanol`)
              .not.toContain(ESPANIOL.titulo);
          }
        });
      });

      await paso(page, `Pasar al checkout en ${idioma.nombre}`, async () => {
        await carrito.crearReserva(
          `AUTO-QA ${sello}`,
          `Prueba de multiidioma ${sello}. No se emite.`,
        );
        const fila = page.locator('.ct-row').filter({ has: page.locator('.ct-row__name') }).first();
        await expect(fila, 'El checkout tiene que mostrar el item de la reserva').toBeVisible();
        const nombre = (await fila.locator('.ct-row__name').innerText()).replace(/\s+/g, ' ').trim();
        await adjuntarTexto(`Checkout en ${idioma.nombre}`,
          `item: ${nombre}${SALTO}${SALTO}${await etiquetasTraducidas(page)}`);

        await conResaltado(page, fila, `Nombre en el checkout en ${idioma.nombre}`, () => {
          expect(nombre,
            `En ${idioma.nombre} el checkout tiene que mostrar el nombre de ese idioma`)
            .toContain(idioma.titulo);
          if (idioma.codigo !== ESPANIOL.codigo) {
            expect(nombre, `En ${idioma.nombre} el checkout no puede mostrar el nombre en espanol`)
              .not.toContain(ESPANIOL.titulo);
          }
        });
      });
    }

    await paso(page, 'Volver el sitio a espanol y vaciar el carrito', async () => {
      await page.goto('/online/');
      await esperarFinDeCarga(page);
      await cambiarIdioma(page, ESPANIOL);
      await carrito.vaciar();
      expect(await carrito.paxEnElCarrito(), 'El test no puede dejar items en el carrito').toBe(0);
    });
  });

  /**
   * Multidestino: Armado, Detalle y Carrito en los tres idiomas.
   *
   * A diferencia del test de arriba, aca **los textos de la pantalla si se
   * exigen**, porque hay historia que lo define. La US 4613, seccion Idiomas:
   * "Los textos de las pantallas de multidestino tienen que traducirse a espanol,
   * ingles y portugues, incluidos los que se dibujan dentro de los paneles que se
   * refrescan sin recargar la pagina."
   *
   * Lo que se exige no inventa ninguna traduccion:
   *
   * - **El nombre del paquete** en el idioma elegido, tomado de
   *   `ReceptiveTourDetail` del 5059 en QA. La pantalla lo corta en el primer
   *   parentesis (`Main.aspx.cs:77`), asi que se compara esa parte.
   * - **Que no quede en espanol ningun texto de la lista** que se vio en espanol
   *   en esa misma pantalla. No se exige que sea tal palabra en ingles: se exige
   *   que no sea la espaniola. Todos salen de recursos con texto por defecto en
   *   espanol, y la lista no incluye datos, como "SERV. VARIOS", que es el nombre
   *   de un tipo de servicio.
   *
   * No emite. Deja la cotizacion que crea cualquier armado de multidestino, igual
   * que los tests de reserva de este riel.
   */
  test('Multidestino: armado, detalle y carrito se muestran en el idioma elegido', async ({ page }) => {
    test.setTimeout(900_000);

    const inicio = new InicioPage(page);
    const ct = new CustomToursPage(page);
    const fecha = fechaDeBusqueda();

    const PAQUETE = {
      id: '5059',
      nombre: {
        ES: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia',
        EN: 'AUTO-QA NO TOCAR - Buenos Aires and Ushuaia Package',
        PT: 'AUTO-QA NO TOCAR - Pacote Buenos Aires e Ushuaia',
      } as Record<string, string>,
    };

    const TEXTOS_EN_ESPANIOL = [
      'faltan habitaciones', 'Todavía no armaste las habitaciones', 'Opciones de visualizacion',
      'Itinerario', 'Cambiar', 'Sin hotel', 'No hay hoteles seleccionados',
      'No hay servicios seleccionados',
    ];
    const normalizar = (s: string) => s.replace(/\s+/g, ' ').toLowerCase();

    /**
     * Recorre una pantalla en los tres idiomas sin salir de ella.
     *
     * Cambiar el idioma recarga la pagina actual, asi que el armado no se pierde.
     * En espanol se anota que textos de la lista estan a la vista, y en ingles y
     * portugues se exige que ninguno de esos siga ahi.
     */
    const revisarPantalla = async (pantalla: string, conTitulo: boolean) => {
      let visiblesEnEspaniol: string[] = [];
      for (const idioma of IDIOMAS) {
        await paso(page, `${pantalla} en ${idioma.nombre}`, async () => {
          await cambiarIdioma(page, idioma);
          await expect(page, `${pantalla} tiene que seguir abierta despues de cambiar el idioma`)
            .toHaveURL(/customtours/i);
          expect(await idiomaActivo(page), `El encabezado tiene que quedar en ${idioma.codigo}`)
            .toBe(idioma.codigo);

          const texto = normalizar(await page.locator('body').innerText());
          const presentes = TEXTOS_EN_ESPANIOL.filter((t) => texto.includes(normalizar(t)));

          if (idioma.codigo === ESPANIOL.codigo) {
            visiblesEnEspaniol = presentes;
            await adjuntarTexto(`${pantalla}: textos de la lista a la vista en espanol`,
              presentes.join(SALTO) || '(ninguno)');
          } else {
            await adjuntarTexto(`${pantalla}: textos en espanol que siguen en ${idioma.nombre}`,
              presentes.join(SALTO) || '(ninguno)');
            await conResaltado(page, page.locator('body'), `${pantalla} sin textos en espanol`, () => {
              expect(presentes.filter((t) => visiblesEnEspaniol.includes(t)),
                `En ${idioma.nombre} ${pantalla} no puede mostrar textos en espanol (US 4613, Idiomas)`)
                .toEqual([]);
            });
          }

          if (conTitulo) {
            const titulo = page.locator('.ct-page__title').first();
            const nombre = (await titulo.innerText()).replace(/\s+/g, ' ').trim();
            await conResaltado(page, titulo, `Nombre del paquete en ${idioma.nombre}`, () => {
              expect(nombre,
                `En ${idioma.nombre} ${pantalla} tiene que mostrar el nombre del paquete de ese ` +
                'idioma, el que tiene cargado ReceptiveTourDetail')
                .toContain(PAQUETE.nombre[idioma.codigo]);
            });
          }
        });
      }
      await cambiarIdioma(page, ESPANIOL);
    };

    const ESPANIOL = IDIOMAS[0];

    await paso(page, 'Dejar el sitio en espanol y abrir el armado del paquete', async () => {
      await cambiarIdioma(page, ESPANIOL);
      const panel = await inicio.abrirSolapa('multidestino');
      await ct.buscarViaje(panel, {
        pais: 'Argentina', ciudad: 'Buenos Aires', id: PAQUETE.id, combo: 'ddSelectedTour',
      });
      await expect(page).toHaveURL(new RegExp(`tour=${PAQUETE.id}`));
    });

    // El armado se revisa antes de cargar habitaciones: los avisos de
    // "faltan habitaciones" solo se ven en ese estado.
    await revisarPantalla('El armado', true);

    await paso(page, 'Cargar fecha, pax y habitaciones y pasar al detalle', async () => {
      await ct.configurarViaje(fecha, 2, 1);
      await ct.irAlItinerario();
    });
    await revisarPantalla('El detalle', true);

    await paso(page, 'Pasar al carrito del multidestino', async () => {
      await ct.continuarAlCarrito();
    });
    // El titulo del carrito es un recurso ("Reserva"), no el nombre del paquete.
    await revisarPantalla('El carrito', false);
  });

});
