import { test as setup, expect } from '@playwright/test';
import { TarifarioPage } from '../pages/tarifario.page';
import { SeriePage } from '../pages/serie.page';
import { adjuntarTexto, esperarFinDeCarga } from '../utils/pasos';
import candidatos from '../data/candidatos.json';

/**
 * Precondiciones de los datos AUTO-QA.
 *
 * Corre una sola vez, despues del login y antes de los tres bloques. No valida
 * nada del sistema: valida que **esten los datos con los que la suite trabaja**.
 *
 * El motivo es de diagnostico. Si alguien borra, renombra o despublica un
 * candidato, hasta ahora el test fallaba diez pasos adentro con un timeout de
 * locator —"no encontre el boton"— y habia que abrir el trace para descubrir que
 * en realidad faltaba el dato. Ahora la corrida corta al principio diciendo cual
 * falta.
 *
 * Es deliberadamente barato: mira el listado del tarifario y las dos pantallas de
 * series, sin entrar al BackOffice. No pretende ser exhaustivo; pretende que el
 * primer error sea el verdadero.
 */

/**
 * Ciudad por pestania.
 *
 * **No todos los candidatos viven en Buenos Aires.** El crucero sale de Ushuaia, y
 * la oferta se lista ahi tambien: filtrando por Buenos Aires su pestania ni
 * siquiera se renderiza, porque es un PlaceHolder condicional. Es la misma tabla
 * que usa el Bloque A.
 */
const CIUDAD: Record<string, string> = {
  'a-cruises': 'Ushuaia',
  'a-opportunities': 'Ushuaia',
};

/**
 * Los siete candidatos del tarifario, tomados de `data/candidatos.json`.
 *
 * Se leen de ahi y no de una lista escrita aca: ese archivo ya es la fuente de
 * verdad del Bloque A, con la pestania y el contenedor de cada item. Si manana se
 * cambia un candidato, esto lo sigue solo.
 */
const DEL_TARIFARIO = Object.entries(candidatos.tarifario)
  .filter(([, v]) => v && typeof v === 'object' && 'tab' in (v as object))
  .map(([clave, v]) => {
    const item = v as { tab: string; container: string; nombre: string };
    return {
      clave, pestania: item.tab, contenedor: item.container, nombre: item.nombre,
      ciudad: CIUDAD[item.tab] ?? 'Buenos Aires',
    };
  })
  .sort((a, b) => a.ciudad.localeCompare(b.ciudad));


/**
 * Datos propios del riel de series.
 *
 * El cupo de las dos salidas preparadas se verifica aparte porque es la
 * precondicion mas facil de romper sin querer: son dos filas de `SerieQuota` que
 * parecen un dato mal cargado y **no hay que subirlas a 200**. Si alguien las
 * "arregla", dos casos del test negativo dejan de probar lo que dicen probar.
 */
const SERIE = {
  nombre: 'AUTO-QA NO TOCAR - Serie de regresion',
  circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noches)',
  categorias: 4,
  cupos: { '2027-09-20': 3, '2027-09-27': 0 },
};

setup('Precondiciones: los datos AUTO-QA estan en QA', async ({ page }) => {
  setup.setTimeout(300_000);
  const faltantes: string[] = [];

  const tarifario = new TarifarioPage(page);
  await page.goto('/online/');
  await tarifario.irDesdeElMenu();
  await tarifario.seleccionarPais('Argentina');

  // Los candidatos vienen ordenados por ciudad para filtrar una sola vez por cada
  // una: cambiar el filtro rehace la busqueda entera.
  let ciudadFiltrada = '';

  /**
   * Se pregunta por el **buscador de la pestania**, no por el contenido de la
   * grilla: el listado pagina con scroll, asi que un candidato puede estar
   * perfectamente cargado y no aparecer entre las cards renderizadas. El buscador,
   * en cambio, ofrece todo lo que hay.
   *
   * Se tipea "AUTO-QA", que es el prefijo comun de todos los datos de prueba, y se
   * mira que el nombre exacto este entre las opciones ofrecidas.
   */
  for (const item of DEL_TARIFARIO) {
    try {
      if (item.ciudad !== ciudadFiltrada) {
        await tarifario.seleccionarCiudad(item.ciudad);
        await tarifario.buscar();
        ciudadFiltrada = item.ciudad;
      }
      await tarifario.abrirPestania(item.pestania, item.contenedor);
      await page.locator(tarifario.buscadorControl).click();
      const buscador = page.locator(tarifario.buscadorInput);
      await buscador.fill('');
      await buscador.pressSequentially('AUTO-QA', { delay: 30 });

      const opciones = page.locator(tarifario.buscadorOpciones);
      await expect(opciones.first(),
        `El buscador de ${item.clave} no ofrecio ninguna opcion AUTO-QA`)
        .toBeVisible({ timeout: 30_000 });
      const ofrecidas = (await opciones.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());

      if (!ofrecidas.some((o) => o.includes(item.nombre))) {
        faltantes.push(
          `tarifario / ${item.clave}: no aparece "${item.nombre}". ` +
          `El buscador ofrecio: ${ofrecidas.slice(0, 6).join(' | ') || '(nada)'}`);
      }
      await page.keyboard.press('Escape');
    } catch (error) {
      faltantes.push(
        `tarifario / ${item.clave}: no se pudo verificar en la pestania ${item.pestania} ` +
        `filtrando por ${item.ciudad} ` +
        `(${(error as Error).message.split(String.fromCharCode(10))[0]})`);
    }
  }

  // --- Series ---
  const serie = new SeriePage(page);
  await serie.abrirListado();
  const series = await serie.seriesDelListado();
  if (!series.join(' | ').includes(SERIE.nombre)) {
    faltantes.push(`series: falta la serie "${SERIE.nombre}" en serieall.aspx`);
  } else {
    await serie.abrirSerie(SERIE.nombre);
    const circuitos = await serie.circuitosDeLaSerie();
    if (!circuitos.join(' | ').includes(SERIE.circuito)) {
      faltantes.push(`series: falta el circuito "${SERIE.circuito}"`);
    } else {
      await serie.abrirCircuito(SERIE.circuito);
      await esperarFinDeCarga(page);

      const categorias = await serie.categorias();
      if (categorias.length !== SERIE.categorias) {
        faltantes.push(
          `series: el circuito tiene ${categorias.length} categorias y tendria que tener ` +
          `${SERIE.categorias}. Sin ReceptiveTourTariffCutDetail el portal lo muestra sin ` +
          'disponibilidad aunque tenga salidas, tarifas y cupo.');
      }

      const { cupos } = await serie.datosDelCalendario();
      for (const [fecha, esperado] of Object.entries(SERIE.cupos)) {
        if (cupos[fecha] !== esperado) {
          faltantes.push(
            `series: la salida ${fecha} tiene cupo ${cupos[fecha]} y tendria que tener ` +
            `${esperado}. Es la precondicion de un caso del test negativo: no hay que ` +
            'volverla a 200.');
        }
      }
      await adjuntarTexto('Cupo de las salidas preparadas',
        Object.entries(SERIE.cupos)
          .map(([f, e]) => `${f}: esperado ${e}, en QA ${cupos[f]}`).join(String.fromCharCode(10)));
    }
  }

  await adjuntarTexto('Precondiciones verificadas',
    faltantes.length ? faltantes.join(String.fromCharCode(10)) : 'Todos los datos AUTO-QA estan.');

  expect(
    faltantes.join(String.fromCharCode(10)),
    'Faltan datos AUTO-QA en QA. La suite no puede correr sin ellos: lo que sigue serian ' +
    'timeouts de locator que no dicen cual es el problema real.',
  ).toBe('');
});
