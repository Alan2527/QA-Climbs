import { test, expect, Page } from '@playwright/test';
import { TarifarioPage } from '../../pages/tarifario.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, reiniciarNumeracionDePasos, conResaltado,
} from '../../utils/pasos';

/**
 * BLOQUE A — multiidioma del encabezado.
 *
 * Conviene no confundirlo con las **solapas de idioma del tarifario**
 * (`srl-lang-tabs-` / `trl-lang-tabs-`), que cambian solo los importes y ya se
 * validan en los siete tests. Esto es el **selector del encabezado**, que cambia
 * `AdvisorContext.Current.WorkingLanguage` y con el el nombre y la descripcion
 * que se muestran.
 *
 * Dos cosas que se midieron antes de escribirlo, y que estaban planteadas como
 * incognitas en el traspaso:
 *
 *  1. **El idioma vive en una cookie**, `Advisor.CustomerLanguage`, con 365 dias
 *     de vigencia (`AdvisorContext.cs:265`). No se guarda por usuario del lado
 *     del servidor. Como cada test arranca de un `storageState` propio, cambiarlo
 *     aca **no contamina a los demas** y no hay que restaurarlo ni correr este
 *     test al final.
 *  2. **Cambiar el idioma recarga la pantalla** (`ReloadCurrentPage`), asi que se
 *     pierden los resultados del tarifario y hay que volver a filtrar y buscar en
 *     cada vuelta.
 *
 * Lo que se exige no es solo que el texto cambie, sino que sea **el de ese
 * idioma**: el defecto tipico es que el filtro por idioma no aplique y el
 * contenido caiga al espanol por defecto.
 *
 * El portal tiene selector de idioma pero **no tiene tema oscuro**: no aplica esa
 * consideracion transversal.
 */
test.describe('Tarifario — multiidioma del encabezado', () => {

  const EXCURSIONES = { tab: 'a-excursions', container: 'excursions-container' };

  /**
   * Lo que cada idioma tiene que mostrar, tomado de `ServiceDetail` del servicio
   * 5 en QA. Se deriva de la base y no de la pantalla: si se copiara lo que la
   * aplicacion muestra, el test daria por bueno cualquier cosa.
   */
  const IDIOMAS = [
    { id: 1, link: 'lnkEsp', codigo: 'ES', nombre: 'Español',
      titulo: 'AUTO-QA NO TOCAR - Tigre y Delta', busqueda: 'Tigre y Delta', marca: 'SALIDAS' },
    { id: 2, link: 'lnkEng', codigo: 'EN', nombre: 'Inglés',
      titulo: 'AUTO-QA NO TOCAR - Tigre and Delta', busqueda: 'Tigre and Delta', marca: 'DEPARTURES' },
    { id: 3, link: 'lnkPor', codigo: 'PT', nombre: 'Portugués',
      titulo: 'AUTO-QA NO TOCAR - TIGRE E DELTA', busqueda: 'TIGRE E DELTA', marca: 'SAÍDAS' },
  ];

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await page.goto('/online/');
  });


  /** Codigo del idioma activo, tal como lo muestra el encabezado: ES, EN o PT. */
  async function idiomaActivo(page: Page): Promise<string> {
    const etiqueta = page.locator('.ddLanguage a.header-flug span').first();
    return (await etiqueta.innerText()).replace(/\s+/g, ' ').trim().toUpperCase();
  }

  /**
   * Cambia el idioma desde el selector del encabezado.
   *
   * Es un desplegable: primero se abre y despues se elige. El link hace postback
   * y recarga la pantalla entera.
   *
   * **El control esconde el idioma activo** (`SetSelectedLanguage`): no se puede
   * elegir el que ya esta puesto, asi que si ya es el buscado no hay nada que
   * hacer. Sin esto el test se cuelga esperando una opcion que no existe.
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

  test('El contenido del tarifario se muestra en el idioma elegido', async ({ page }) => {
    test.setTimeout(900_000);

    for (const idioma of IDIOMAS) {
      await paso(page, `Pasar el sitio a ${idioma.nombre} y buscar la excursion`, async () => {
        await page.goto('/online/');
        await esperarFinDeCarga(page);
        await cambiarIdioma(page, idioma);

        // El encabezado tiene que quedar en el idioma elegido: es lo primero que
        // ve la persona y lo que gobierna el resto del contenido.
        await conResaltado(page, page.locator('.ddLanguage').first(), `Encabezado en ${idioma.nombre}`, async () => {
          expect(await idiomaActivo(page),
            `El encabezado tiene que quedar en ${idioma.codigo} despues de elegir ${idioma.nombre}`)
            .toBe(idioma.codigo);
        });

        // Cambiar el idioma recarga la pantalla, asi que hay que rehacer el
        // camino entero: entrar al tarifario, filtrar y buscar.
        //
        // Al tarifario se entra por URL y no por el menu: la etiqueta del menu se
        // traduce ("Tarifario" / "Rates"), asi que buscarla por nombre solo
        // funciona en espanol. El recorrido por el menu ya lo cubren los siete
        // tests en espanol; aca el sujeto es el idioma del contenido.
        const tarifario = new TarifarioPage(page);
        await page.goto('/online/DefaultTariff.aspx');
        await esperarFinDeCarga(page);
        await expect(
          page.locator(tarifario.comboPais),
          'El tarifario tiene que abrir con sus filtros',
        ).toBeVisible({ timeout: 60_000 });
        await tarifario.seleccionarPais('Argentina');
        await tarifario.seleccionarCiudad('Buenos Aires');
        await tarifario.buscar();
        await tarifario.abrirPestania(EXCURSIONES.tab, EXCURSIONES.container);
        await tarifario.buscarPorNombre(idioma.busqueda, idioma.titulo);
      });

      await paso(page, `El nombre y la descripcion estan en ${idioma.nombre}`, async () => {
        const tarifario = new TarifarioPage(page);
        const nombre = await tarifario.nombreDelItem(EXCURSIONES.container);
        const texto = await tarifario.textoDe(EXCURSIONES.container);
        await adjuntarTexto(`Card en ${idioma.nombre}`, `${nombre}${String.fromCharCode(10)}${texto.slice(0, 400)}`);

        await conResaltado(page, page.locator(`#${EXCURSIONES.container}`), `Nombre en ${idioma.nombre}`, () => {
          expect(nombre,
            `En ${idioma.nombre} la card tiene que mostrar el nombre de ese idioma, ` +
            'el que tiene cargado ServiceDetail')
            .toBe(idioma.titulo);
        });

        await conResaltado(page, page.locator(`#${EXCURSIONES.container}`), `Descripcion en ${idioma.nombre}`, () => {
          expect(texto.toUpperCase(),
            `En ${idioma.nombre} la descripcion tiene que ser la de ese idioma`)
            .toContain(idioma.marca);
        });

        // Y lo que realmente importa: que no haya caido al espanol por defecto.
        if (idioma.id !== 1) {
          await conResaltado(page, page.locator(`#${EXCURSIONES.container}`), `Sin caer al espanol en ${idioma.nombre}`, () => {
            expect(nombre,
              `En ${idioma.nombre} el nombre no puede ser el espanol: seria el filtro por ` +
              'idioma sin aplicar')
              .not.toBe(IDIOMAS[0].titulo);
            expect(texto.toUpperCase(),
              `En ${idioma.nombre} la descripcion no puede traer la marca del espanol`)
              .not.toContain(IDIOMAS[0].marca);
          });
        }
      });
    }

    await paso(page, 'Dejar el sitio en Español', async () => {
      // El idioma vive en una cookie del contexto, que muere con el test, asi que
      // esto no es una limpieza necesaria: es dejar la pantalla como se la
      // encontro por si alguien mira la captura del reporte.
      await page.goto('/online/');
      await esperarFinDeCarga(page);
      await cambiarIdioma(page, IDIOMAS[0]);
    });
  });

  /**
   * Los otros tres rieles del tarifario: hoteles, paquetes y ofertas.
   *
   * El primer test cubre una excursion. Este cubre el resto, y **no exige lo mismo
   * en los tres**, porque el modelo de datos no traduce lo mismo:
   *
   *   `ReceptiveTourDetail`  tiene **Name y Detail por idioma** -> paquetes y
   *                          ofertas traducen el nombre y la descripcion.
   *   `HotelDetail`          tiene **solo Detail**. El nombre del hotel vive en
   *                          `Hotel.Name`, que es uno solo para todos los idiomas.
   *
   * Por eso al hotel se le exige la **descripcion** y no el nombre: pedirle que el
   * nombre cambie de idioma seria inventar un requisito que el sistema no puede
   * cumplir. Verificado en la base del 5003: las tres filas de `HotelDetail` traen
   * el mismo `Hotel.Name` y descripciones distintas.
   *
   * Como en el primer test, lo que se exige sale de la base y no de la pantalla.
   */
  test('El tarifario muestra hoteles, paquetes y ofertas en el idioma elegido', async ({ page }) => {
    test.setTimeout(900_000);

    /**
     * Que tiene que mostrar cada item en cada idioma.
     *
     * Los nombres son los de `ReceptiveTourDetail.Name`. Las marcas de la
     * descripcion son fragmentos textuales de `HotelDetail.Detail` y
     * `ReceptiveTourDetail.Detail`: se compara un fragmento y no el texto entero
     * porque la descripcion del hotel viene con HTML de por medio.
     */
    const ITEMS = [
      {
        clave: 'hoteles',
        tab: 'a-hotels',
        container: 'hotels-container',
        ciudad: 'Buenos Aires',
        // El nombre es el mismo en los tres idiomas: `HotelDetail` no lo traduce.
        nombreUnico: 'AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau',
        busqueda: { ES: 'Park Hyatt', EN: 'Park Hyatt', PT: 'Park Hyatt' },
        nombre: null as Record<string, string> | null,
        marca: {
          ES: 'barrio selecto de Recoleta',
          EN: 'Allow Park Hyatt Buenos Aires',
          PT: 'está localizado',
        },
      },
      {
        clave: 'paquetes',
        tab: 'a-tours',
        container: 'tours-container',
        ciudad: 'Buenos Aires',
        nombreUnico: null,
        busqueda: {
          ES: 'Paquete Buenos Aires',
          EN: 'Buenos Aires and Ushuaia Package',
          PT: 'Pacote Buenos Aires',
        },
        nombre: {
          ES: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)',
          EN: 'AUTO-QA NO TOCAR - Buenos Aires and Ushuaia Package (6 days / 5 nights)',
          PT: 'AUTO-QA NO TOCAR - Pacote Buenos Aires e Ushuaia (6 dias / 5 noites)',
        },
        marca: {
          ES: 'Paquete de datos fijos para pruebas automatizadas',
          EN: 'Fixed data package for automated testing',
          PT: 'Pacote de dados fixos para testes automatizados',
        },
      },
      {
        clave: 'ofertas',
        tab: 'a-opportunities',
        container: 'opportunities-container',
        // La oferta se lista bajo Ushuaia: con Buenos Aires la pestania ni se
        // renderiza, porque es un PlaceHolder condicional.
        ciudad: 'Ushuaia',
        nombreUnico: null,
        busqueda: {
          ES: 'Oferta Buenos Aires',
          EN: 'Buenos Aires and Ushuaia Offer',
          PT: 'Oferta Buenos Aires',
        },
        nombre: {
          ES: 'AUTO-QA NO TOCAR - Oferta Buenos Aires y Ushuaia (6 días / 5 noches)',
          EN: 'AUTO-QA NO TOCAR - Buenos Aires and Ushuaia Offer (6 days / 5 nights)',
          PT: 'AUTO-QA NO TOCAR - Oferta Buenos Aires e Ushuaia (6 dias / 5 noites)',
        },
        marca: {
          ES: 'Oferta de datos fijos para pruebas automatizadas',
          EN: 'Fixed data offer for automated testing',
          PT: 'Oferta de dados fixos para testes automatizados',
        },
      },
    ];

    for (const idioma of IDIOMAS) {
      const codigo = idioma.codigo as 'ES' | 'EN' | 'PT';

      await paso(page, `Pasar el sitio a ${idioma.nombre}`, async () => {
        await page.goto('/online/');
        await esperarFinDeCarga(page);
        await cambiarIdioma(page, idioma);
        await conResaltado(page, page.locator('.ddLanguage').first(), `Encabezado en ${idioma.nombre}`, async () => {
          expect(await idiomaActivo(page),
            `El encabezado tiene que quedar en ${codigo} despues de elegir ${idioma.nombre}`)
            .toBe(codigo);
        });
      });

      for (const item of ITEMS) {
        await paso(page, `${item.clave} en ${idioma.nombre}`, async () => {
          const tarifario = new TarifarioPage(page);

          // Al tarifario se entra por URL: la etiqueta del menu tambien se traduce,
          // asi que buscarla por nombre solo funcionaria en espaniol. El recorrido
          // por el menu ya lo cubren los siete tests del tarifario.
          await page.goto('/online/DefaultTariff.aspx');
          await esperarFinDeCarga(page);
          await expect(
            page.locator(tarifario.comboPais),
            'El tarifario tiene que abrir con sus filtros',
          ).toBeVisible({ timeout: 60_000 });

          await tarifario.seleccionarPais('Argentina');
          await tarifario.seleccionarCiudad(item.ciudad);
          await tarifario.buscar();
          await tarifario.abrirPestania(item.tab, item.container);

          const esperado = item.nombre ? item.nombre[codigo] : item.nombreUnico!;
          await tarifario.buscarPorNombre(item.busqueda[codigo], esperado);

          const nombre = await tarifario.nombreDelItem(item.container);
          const texto = await tarifario.textoDe(item.container);
          await adjuntarTexto(`Card de ${item.clave} en ${idioma.nombre}`,
            `${nombre}${String.fromCharCode(10)}${texto.slice(0, 400)}`);

          const contenedor = page.locator(`#${item.container}`);

          if (item.nombre) {
            // Paquetes y ofertas: el nombre esta traducido en ReceptiveTourDetail.
            await conResaltado(page, contenedor, `Nombre de ${item.clave} en ${idioma.nombre}`, () => {
              expect(nombre,
                `En ${idioma.nombre} la card tiene que mostrar el nombre de ese idioma, ` +
                'el que tiene cargado ReceptiveTourDetail')
                .toBe(item.nombre![codigo]);
            });
            if (codigo !== 'ES') {
              await conResaltado(page, contenedor, `Sin caer al espaniol en ${item.clave} / ${idioma.nombre}`, () => {
                expect(nombre,
                  `En ${idioma.nombre} el nombre no puede ser el espaniol: seria el filtro por ` +
                  'idioma sin aplicar')
                  .not.toBe(item.nombre!.ES);
              });
            }
          } else {
            // Hoteles: el nombre no se traduce, y exigir que cambie seria pedirle
            // al sistema algo que su modelo de datos no contempla.
            await conResaltado(page, contenedor, `Nombre del hotel en ${idioma.nombre}`, () => {
              expect(nombre,
                'El nombre del hotel sale de Hotel.Name, que es uno solo para todos los ' +
                'idiomas: tiene que ser el mismo en los tres')
                .toBe(item.nombreUnico!);
            });
          }

          await conResaltado(page, contenedor, `Descripcion de ${item.clave} en ${idioma.nombre}`, () => {
            expect(texto,
              `En ${idioma.nombre} la descripcion de ${item.clave} tiene que ser la de ese idioma`)
              .toContain(item.marca[codigo]);
          });

          if (codigo !== 'ES') {
            await conResaltado(page, contenedor, `Descripcion sin caer al espaniol / ${item.clave} / ${idioma.nombre}`, () => {
              expect(texto,
                `En ${idioma.nombre} la descripcion no puede traer la marca del espaniol`)
                .not.toContain(item.marca.ES);
            });
          }
        });
      }
    }

    await paso(page, 'Dejar el sitio en Español', async () => {
      await page.goto('/online/');
      await esperarFinDeCarga(page);
      await cambiarIdioma(page, IDIOMAS[0]);
    });
  });

});
