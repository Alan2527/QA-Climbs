import { test, expect, Page } from '@playwright/test';
import { TarifarioPage } from '../../pages/tarifario.page';
import { paso, adjuntarTexto, precioMostrado, importeANumero } from '../../utils/pasos';
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

  const SALTO = String.fromCharCode(10);

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

    await paso(page, '5. Desplegar el tarifario del item', async () => {
      await tarifario.verTarifario(cfg.container);
      const filas = await tarifario.leerTablaTarifas(cfg.container);
      await adjuntarTexto(
        'Tarifas que muestra la pantalla',
        filas.map((f) => f.join(' | ')).join(SALTO),
      );
      expect(filas.length, 'El tarifario no mostro ninguna fila').toBeGreaterThan(1);

      const precios = await tarifario.preciosDelTarifario(cfg.container);
      expect(precios.length, 'El tarifario no muestra ningun importe').toBeGreaterThan(0);
    });

    return tarifario;
  }

  test('Paquetes: trae tarifas y muestra el paquete esperado', async ({ page }) => {
    const t = await validarItem(page, T.paquetes as Config, 'Paquetes');
    await paso(page, '6. El paquete muestra sus dos ciudades', async () => {
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

  test('Cena Show: trae tarifas y coinciden con las de la base', async ({ page }) => {
    const cfg = T.cenaShow;
    const t = await validarItem(page, cfg as Config, 'Cena Show');

    await paso(page, '6. Las tarifas coinciden con las de la base de datos', async () => {
      // Se lee de la pantalla para no dar falso positivo si alguien lo cambia;
      // si no se puede leer, se cae al valor documentado en candidatos.json.
      const leido = await t.markupActivo();
      const markup = leido ?? candidatos._formulaPrecio.markupPorDefecto;
      await adjuntarTexto(
        'Markup aplicado',
        leido !== null ? `leido de la pantalla: ${leido}` : `no se pudo leer; se usa el documentado: ${markup}`,
      );
      expect(markup, 'No hay markup con el que calcular').toBeGreaterThan(0);

      // Precio mostrado = Math.ceil(TotalRate / markup)  -- ver utils/pasos.ts
      const esperados = cfg.tarifasBase.map((x) => ({
        tipo: x.tipo,
        base: x.totalRate,
        esperado: precioMostrado(x.totalRate, markup),
      }));

      const filas = await t.leerTablaTarifas(cfg.container);

      // Cada fila es: FECHAS | TIPO DE SERVICIO | [PAX] | PRECIO
      // Se empareja tipo con precio y no solo el conjunto de importes: si un
      // cambio intercambiara los precios entre tipos, el conjunto seria el mismo
      // y el test pasaria igual.
      const enPantalla = filas.slice(1).map((f) => ({
        tipo: (f[1] ?? '').trim(),
        precio: importeANumero((f[f.length - 1] ?? '').replace(/[^0-9.,]/g, '')),
      }));

      await adjuntarTexto(
        'Comparacion base vs pantalla',
        `markup: ${markup}` + SALTO + SALTO +
          esperados
            .map((e) => `${e.tipo.padEnd(20)} base ${e.base}  ->  esperado ${e.esperado}`)
            .join(SALTO) +
          SALTO + SALTO + 'en pantalla:' + SALTO +
          enPantalla.map((x) => `${x.tipo.padEnd(20)} ${x.precio}`).join(SALTO),
      );

      // Cada tarifa de la base tiene que estar en pantalla con SU tipo y su precio.
      for (const e of esperados) {
        const coincide = enPantalla.some(
          (x) => x.tipo.toLowerCase() === e.tipo.toLowerCase() && x.precio === e.esperado,
        );
        expect(
          coincide,
          `No hay fila "${e.tipo}" con precio ${e.esperado} (base ${e.base}). ` +
            `Pantalla: ${enPantalla.map((x) => `${x.tipo}=${x.precio}`).join(', ')}`,
        ).toBe(true);
      }

      // Y la pantalla no debe mostrar tarifas que la base no tenga.
      expect(
        enPantalla.length,
        'La pantalla muestra mas tarifas que las cargadas en la base',
      ).toBe(esperados.length);
    });
  });

  // Las cabinas no figuran en la card del listado: se ven al abrir el detalle
  // ("Ver Tarifario"). Esa validacion queda para el test de detalle.
  test('Cruceros: trae tarifas y muestra el crucero esperado', async ({ page }) => {
    await validarItem(page, T.cruceros as Config, 'Cruceros');
  });

  test('Ofertas: trae tarifas y muestra la oferta esperada', async ({ page }) => {
    const t = await validarItem(page, T.ofertas as Config, 'Ofertas');
    await paso(page, '6. La oferta muestra sus dos ciudades', async () => {
      const texto = await t.textoDe(T.ofertas.container);
      for (const c of T.ofertas.ciudades) {
        expect(texto, `Falta la ciudad ${c.nombre}`).toContain(c.nombre);
      }
    });
  });
});
