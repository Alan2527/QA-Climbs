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
    botonTarifario: {
      textoInicial: string; textoDesplegado: string; alterna: boolean; _hallazgo?: string;
    };
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


  /** Normaliza para comparar: el front cambia mayusculas ("Pick Up" -> "Pick up"). */
  const norm = (x: string) => x.trim().toLowerCase();

  /**
   * Valida el popup "Ver Detalle" contra lo que hay en la base.
   * Las solapas son condicionales: si el dato no esta cargado, no se renderiza.
   */
  async function validarFichaDetalle(page: Page, t: TarifarioPage, cfg: any, desde: number) {
    const ficha = cfg.fichaDetalle;

    await paso(page, `${desde}. Abrir el popup Ver Detalle`, async () => {
      await t.abrirFichaDetalle(cfg.container);
      const solapas = await t.solapasDeLaFicha();
      await adjuntarTexto('Solapas de la ficha', solapas.join(', '));
      for (const esperada of ficha.solapas) {
        expect(solapas, `Falta la solapa "${esperada}" en la ficha`).toContain(esperada);
      }
    });

    await paso(page, `${desde + 1}. Incluye / No incluye coincide con la base`, async () => {
      const { incluye, noIncluye } = await t.amenitiesDeLaFicha();
      await adjuntarTexto(
        'Amenities: base vs pantalla',
        'INCLUYE esperado: ' + ficha.incluye.join(', ') + SALTO +
        'INCLUYE pantalla: ' + incluye.join(', ') + SALTO + SALTO +
        'NO INCLUYE esperado: ' + ficha.noIncluye.join(', ') + SALTO +
        'NO INCLUYE pantalla: ' + noIncluye.join(', '),
      );

      for (const a of ficha.incluye) {
        expect(incluye.map(norm), `Falta "${a}" en INCLUYE`).toContain(norm(a));
      }
      for (const a of ficha.noIncluye) {
        expect(noIncluye.map(norm), `Falta "${a}" en NO INCLUYE`).toContain(norm(a));
      }
      expect(incluye.length, 'INCLUYE muestra items que la base no tiene').toBe(ficha.incluye.length);
      expect(noIncluye.length, 'NO INCLUYE muestra items que la base no tiene').toBe(ficha.noIncluye.length);
    });

    await paso(page, `${desde + 2}. La ficha tecnica muestra los idiomas de la base`, async () => {
      const tecnica = await t.contenidoDeSolapa('technical');
      await adjuntarTexto('Ficha tecnica en pantalla', tecnica);
      for (const idioma of ficha.idiomas) {
        expect(norm(tecnica), `Falta el idioma "${idioma}" en la ficha tecnica`).toContain(norm(idioma));
      }
      await t.cerrarFichaDetalle();
    });
  }


  /**
   * Valida el modal "Ver detalle" de paquetes, hoteles, cruceros y ofertas.
   * El titulo se compara siempre; la descripcion solo si esta cargado el
   * texto esperado desde la base (ver _modalDetalle en candidatos.json).
   */
  async function validarModalDetalle(page: Page, t: TarifarioPage, cfg: any, desde: number) {
    const esperado = cfg.modalDetalle;

    await paso(page, `${desde}. Abrir el modal Ver detalle y validar su contenido`, async () => {
      const modal = await t.abrirModalDetalle(cfg.container);
      const texto = (await modal.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Contenido del modal', texto.slice(0, 2000));

      expect(texto, `El modal no muestra el titulo "${esperado.titulo}"`)
        .toContain(esperado.titulo);

      if (esperado.descripcion) {
        expect(texto, 'El modal no muestra la descripcion de la base')
          .toContain(esperado.descripcion);
      }
      await t.cerrarModalDetalle(modal);
    });
  }


  /**
   * Valida los elementos de la card contra la base:
   *   - observaciones destacadas -> ServiceObservation con IsPriority = 1
   *   - leyenda "Mas observaciones disponibles en el detalle"
   *   - tooltips (duracion, idiomas, operatividad y amenity destacada)
   *   - tag RECOMENDADO -> Hotel.Great = 1
   */
  async function validarCard(page: Page, t: TarifarioPage, cfg: any, desde: number) {
    const card = cfg.card;
    if (!card) return;

    await paso(page, `${desde}. La card muestra los datos destacados de la base`, async () => {
      const obs = await t.observacionesDestacadas(cfg.container);
      const mas = await t.textoMasObservaciones(cfg.container);
      const tips = await t.tooltips(cfg.container);
      const tag = await t.tagRecomendado(cfg.container);

      await adjuntarTexto('Elementos de la card',
        'observaciones destacadas: ' + JSON.stringify(obs) + SALTO +
        'mas observaciones: ' + JSON.stringify(mas) + SALTO +
        'tooltips (' + tips.length + '): ' + JSON.stringify(tips) + SALTO +
        'tag: ' + JSON.stringify(tag));

      if (card.observacionesDestacadas) {
        for (const esperada of card.observacionesDestacadas) {
          expect(obs.join(' | '), `Falta la observacion destacada "${esperada}"`)
            .toContain(esperada);
        }
        expect(obs.length, 'La card muestra observaciones que la base no tiene')
          .toBe(card.observacionesDestacadas.length);
      }

      // La leyenda "Mas observaciones disponibles en el detalle" depende de
      // op.HasMoreObservations, cuyo criterio vive en ServiceOperativityData y no
      // esta en el repo del WEB. Se deja informativa: se adjunta pero no se exige.
      if (card.hayMasObservaciones) {
        expect(mas, 'Falta la leyenda de mas observaciones').not.toBeNull();
      }

      if (card.tooltipAmenity) {
        expect(tips.join(' | '), `Ningun tooltip trae "${card.tooltipAmenity}"`)
          .toContain(card.tooltipAmenity);
      }

      if (card.tagRecomendado) {
        expect(tag, 'No aparece el tag RECOMENDADO').not.toBeNull();
        expect((tag ?? '').toUpperCase(), 'El tag no dice RECOMENDADO')
          .toContain(card.tagRecomendado.toUpperCase());
      }
    });
  }


  /**
   * Valida los componentes de la card contra la matriz tomada del markup de
   * cada *TariffControl.ascx (ver _elementos en candidatos.json):
   * imagen, texto, boton de tarifario, proveedores, descarga Word, tag y chips.
   *
   * "Cotizar y reservar" se verifica por presencia y NO se clickea: navega al
   * carrito y saca al test del tarifario.
   */
  async function validarElementos(page: Page, t: TarifarioPage, cfg: any, desde: number) {
    await paso(page, `${desde}. La card muestra los componentes que corresponden`, async () => {
      const esperados = cfg.elementos;
      const hay = (await t.elementosDeLaCard(cfg.container)) as Record<string, boolean>;
      const src = await t.srcImagen(cfg.container);

      await adjuntarTexto('Componentes de la card',
        Object.keys(esperados)
          .map((k) => `${k.padEnd(18)} esperado: ${String(esperados[k]).padEnd(6)} en pantalla: ${hay[k]}`)
          .join(SALTO) + SALTO + SALTO + 'src de la imagen: ' + src);

      for (const clave of Object.keys(esperados)) {
        expect(hay[clave],
          esperados[clave]
            ? `Falta el componente "${clave}" en la card`
            : `Aparece "${clave}" y esta pestania no deberia tenerlo`,
        ).toBe(esperados[clave]);
      }

      // La imagen tiene que ser la cargada en la base, no el placeholder.
      if (cfg.imagen) {
        expect(src, 'La card no muestra ninguna imagen').not.toBeNull();
        expect(src ?? '', `La imagen no es la esperada (${cfg.imagen})`).toContain(cfg.imagen);
      }
    });
  }

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

    await validarElementos(page, tarifario, cfg, 5);

    // El estado del boton se guarda para validarlo en su propio paso.
    let botonesAntes: string[] = [];
    let botonesDespues: string[] = [];

    await paso(page, '6. Desplegar el tarifario del item', async () => {
      // El boton tiene que alternar "Ver Tarifario" -> "Cerrar Tarifario".
      // En Cruceros no lo hace (no tiene CruiseTariffDetailControl.ascx); eso queda
      // documentado como esperado, y si algun dia lo arreglan este test lo avisa.
      botonesAntes = await tarifario.textosBotonesTarifario(cfg.container);
      await tarifario.verTarifario(cfg.container);
      botonesDespues = await tarifario.textosBotonesTarifario(cfg.container);
      const filas = await tarifario.leerTablaTarifas(cfg.container);
      await adjuntarTexto(
        'Tarifas que muestra la pantalla',
        filas.map((f) => f.join(' | ')).join(SALTO),
      );
      expect(filas.length, 'El tarifario no mostro ninguna fila').toBeGreaterThan(1);

      const precios = await tarifario.preciosDelTarifario(cfg.container);
      expect(precios.length, 'El tarifario no muestra ningun importe').toBeGreaterThan(0);
    });

    await paso(page, '7. El boton pasa de "Ver Tarifario" a "Cerrar Tarifario"', async () => {
      const btn = cfg.botonTarifario;
      const hayCerrar = botonesDespues.some((t) => t.includes('Cerrar Tarifario'));

      await adjuntarTexto('Transicion del boton',
        'antes de desplegar:  ' + botonesAntes.join(' | ') + SALTO +
        'despues de desplegar: ' + botonesDespues.join(' | ') + SALTO +
        'esperado: ' + (btn.alterna ? 'alterna a "Cerrar Tarifario"' : 'NO alterna') +
        (btn.alterna ? '' : SALTO + 'NOTA: ' + btn._hallazgo));

      expect(botonesAntes.join(' | '), `Ningun boton dice "${btn.textoInicial}"`)
        .toContain(btn.textoInicial);

      if (btn.alterna) {
        expect(hayCerrar,
          `Al desplegar deberia aparecer "Cerrar Tarifario". Botones: ${botonesDespues.join(' | ')}`,
        ).toBe(true);
      } else {
        expect(hayCerrar,
          'Aparecio "Cerrar Tarifario" en Cruceros: antes no alternaba, revisar si lo arreglaron.',
        ).toBe(false);
      }
    });

    return tarifario;
  }

  test('Paquetes: trae tarifas y muestra el paquete esperado', async ({ page }) => {
    const t = await validarItem(page, T.paquetes as Config, 'Paquetes');
    await validarModalDetalle(page, t, T.paquetes, 9);
    await paso(page, '8. El paquete muestra sus dos ciudades', async () => {
      const texto = await t.textoDe(T.paquetes.container);
      for (const c of T.paquetes.ciudades) {
        expect(texto, `Falta la ciudad ${c.nombre}`).toContain(c.nombre);
      }
    });
  });

  test('Excursiones: trae tarifas y muestra la excursion esperada', async ({ page }) => {
    const t = await validarItem(page, T.excursiones as Config, 'Excursiones');
    await validarCard(page, t, T.excursiones, 9);
    await validarFichaDetalle(page, t, T.excursiones, 9);
  });

  test('Hoteles: trae tarifas y muestra el hotel esperado', async ({ page }) => {
    const thoteles = await validarItem(page, T.hoteles as Config, 'Hoteles');
    await validarCard(page, thoteles, T.hoteles, 8);
    await validarModalDetalle(page, thoteles, T.hoteles, 8);
  });

  test('Traslados: trae tarifas y muestra el traslado esperado', async ({ page }) => {
    const t = await validarItem(page, T.traslados as Config, 'Traslados');
    await validarCard(page, t, T.traslados, 8);
    await validarFichaDetalle(page, t, T.traslados, 8);
  });

  test('Cena Show: trae tarifas y coinciden con las de la base', async ({ page }) => {
    const cfg = T.cenaShow;
    const t = await validarItem(page, cfg as Config, 'Cena Show');

    await paso(page, '8. Las tarifas coinciden con las de la base de datos', async () => {
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

    await validarCard(page, t, cfg, 9);
    await validarFichaDetalle(page, t, cfg, 9);
  });

  // Las cabinas no figuran en la card del listado: se ven al abrir el detalle
  // ("Ver Tarifario"). Esa validacion queda para el test de detalle.
  // El modal Ver detalle de Cruceros no abre: su onclick tiene las comillas mal
  // cerradas (Online/Module/CruiseTariffControl.ascx, linea 48), lo que lo deja
  // como JavaScript invalido. Esta presente tambien en la rama preprod.
  // El test valida el flujo completo igual que las otras pestanias, asi que queda
  // en rojo hasta que se corrija: el paso no se puede ejecutar y eso es el hallazgo.
  test('Cruceros: trae tarifas y muestra el crucero esperado', async ({ page }) => {
    const t = await validarItem(page, T.cruceros as Config, 'Cruceros');
    await validarModalDetalle(page, t, T.cruceros, 8);
  });

  test('Ofertas: trae tarifas y muestra la oferta esperada', async ({ page }) => {
    const t = await validarItem(page, T.ofertas as Config, 'Ofertas');
    await validarModalDetalle(page, t, T.ofertas, 9);
    await paso(page, '8. La oferta muestra sus dos ciudades', async () => {
      const texto = await t.textoDe(T.ofertas.container);
      for (const c of T.ofertas.ciudades) {
        expect(texto, `Falta la ciudad ${c.nombre}`).toContain(c.nombre);
      }
    });
  });

});
