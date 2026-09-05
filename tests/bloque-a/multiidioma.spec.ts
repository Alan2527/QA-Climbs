import { test, expect, Page, Locator } from '@playwright/test';
import { TarifarioPage } from '../../pages/tarifario.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, resaltarYCapturar, reiniciarNumeracionDePasos,
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
});
