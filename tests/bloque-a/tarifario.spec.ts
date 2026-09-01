import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import { TarifarioPage } from '../../pages/tarifario.page';
import {
  paso, adjuntarTexto, precioMostrado, importeANumero, resaltarYCapturar,
  reiniciarNumeracionDePasos,
} from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';
import lineaBase from '../../data/importes-lineabase.json';

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
      textoInicial: string; textoDesplegado: string; _hallazgoConocido?: string;
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
    reiniciarNumeracionDePasos();
    // Landing del portal despues del login; desde ahi se navega por el menu.
    await page.goto('/online/');
    await new TarifarioPage(page).irDesdeElMenu();
  });


  /** Normaliza para comparar: el front cambia mayusculas ("Pick Up" -> "Pick up"). */
  const norm = (x: string) => x.trim().toLowerCase();

  /**
   * Compara el texto del detalle que muestra la pantalla contra el que tiene la
   * base, linea por linea.
   *
   * Se exige que cada linea de la base este presente, en vez de comparar la
   * cadena entera: el campo guarda HTML y el navegador lo renderiza con sus
   * propios saltos y espacios, asi que una igualdad estricta daria rojo por
   * diferencias de formato que no le importan a nadie. Con este criterio, en
   * cambio, un parrafo que falta o que cambio si falla.
   */
  async function compararTextoDelDetalle(
    t: TarifarioPage, cfg: any, campo: 'Detail' | 'TechnicalSheet',
  ) {
    const esperadas: string[] = cfg.detalleEsperado?.[campo];
    if (!esperadas?.length) return;

    const enPantalla = await t.textoDelDetalleAbierto(campo);
    const plano = norm(enPantalla);
    const faltantes = esperadas.filter((linea) => !plano.includes(norm(linea)));

    await adjuntarTexto(`Detalle ${campo}: base vs pantalla`,
      'fuente: ' + (cfg.detalleEsperado._fuente ?? '(sin documentar)') + SALTO +
      `lineas esperadas: ${esperadas.length}` + SALTO +
      `lineas ausentes:  ${faltantes.length}` + SALTO + SALTO +
      'ESPERADO (base):' + SALTO + esperadas.join(SALTO) + SALTO + SALTO +
      'EN PANTALLA:' + SALTO + enPantalla.slice(0, 4000));

    expect(faltantes.join(SALTO + '  - '),
      `La pantalla no muestra ${faltantes.length} de las ${esperadas.length} lineas ` +
      `que tiene la base en ${campo}`,
    ).toBe('');
  }


  /**
   * Valida el popup "Ver Detalle" contra lo que hay en la base.
   * Las solapas son condicionales: si el dato no esta cargado, no se renderiza.
   */
  async function validarFichaDetalle(page: Page, t: TarifarioPage, cfg: any) {
    const ficha = cfg.fichaDetalle;

    await paso(page, 'Abrir el popup Ver Detalle', async () => {
      await t.abrirFichaDetalle(cfg.container);
      const solapas = await t.solapasDeLaFicha();
      await adjuntarTexto('Solapas de la ficha', solapas.join(', '));
      for (const esperada of ficha.solapas) {
        expect(solapas, `Falta la solapa "${esperada}" en la ficha`).toContain(esperada);
      }
    });

    await paso(page, 'Incluye / No incluye coincide con la base', async () => {
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

    await paso(page, 'La descripcion coincide con la de la base', async () => {
      await compararTextoDelDetalle(t, cfg, 'Detail');
    });

    await paso(page, 'La ficha tecnica muestra los idiomas de la base', async () => {
      const tecnica = await t.contenidoDeSolapa('technical');
      await adjuntarTexto('Ficha tecnica en pantalla', tecnica);
      for (const idioma of ficha.idiomas) {
        expect(norm(tecnica), `Falta el idioma "${idioma}" en la ficha tecnica`).toContain(norm(idioma));
      }
    });

    // Va ultimo y con el popup todavia abierto: el boton vive adentro de la
    // ficha, y si fallara antes taparia la validacion de la ficha tecnica.
    if (cfg.elementos?.descargaPdf) {
      await paso(page, 'El boton Descargar PDF baja la ficha', async () => {
        let descarga;
        try {
          descarga = await t.descargarPdfFicha(cfg.container);
        } catch (error) {
          await resaltarYCapturar(page, t.locatorBotonPdf(cfg.container),
            'FALLA: el boton Descargar PDF no bajo ningun archivo',
            t.locatorCard(cfg.container));
          throw error;
        }

        const nombre = descarga.suggestedFilename();
        const ruta = await descarga.path();
        const bytes = ruta ? fs.statSync(ruta).size : 0;
        // Un PDF valido empieza con "%PDF".
        const firma = ruta ? fs.readFileSync(ruta).subarray(0, 4).toString('latin1') : '';

        await adjuntarTexto('Ficha en PDF descargada',
          'nombre: ' + nombre + SALTO +
          'bytes:  ' + bytes + SALTO +
          'firma:  ' + JSON.stringify(firma) + '  (un PDF valido empieza con %PDF)');

        expect(nombre, `El archivo descargado no es un .pdf: "${nombre}"`).toMatch(/\.pdf$/i);
        expect(bytes, 'El PDF descargado esta vacio').toBeGreaterThan(0);
        expect(firma, 'El archivo descargado no es un PDF valido').toBe('%PDF');
      });
    }


    await t.cerrarFichaDetalle();
  }


  /**
   * Valida el modal "Ver detalle" de paquetes, hoteles, cruceros y ofertas.
   * El titulo se compara siempre; la descripcion solo si esta cargado el
   * texto esperado desde la base (ver _modalDetalle en candidatos.json).
   */
  async function validarModalDetalle(page: Page, t: TarifarioPage, cfg: any) {
    const esperado = cfg.modalDetalle;

    await paso(page, 'Abrir el modal Ver detalle y validar su contenido', async () => {
      // El fallo tipico es que el modal no llegue a abrirse. Sin este resaltado
      // el paso quedaba en rojo sin imagen y no se veia sobre que boton se
      // habia hecho clic ni que mostraba la pantalla en ese momento.
      let modal;
      try {
        modal = await t.abrirModalDetalle(cfg.container);
      } catch (error) {
        await resaltarYCapturar(
          page,
          t.locatorBotonVerDetalle(cfg.container),
          'FALLA: el boton "Ver detalle" no abrio el modal',
          t.locatorCard(cfg.container),
        );
        throw error;
      }
      const texto = (await modal.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Contenido del modal', texto.slice(0, 2000));

      expect(texto, `El modal no muestra el titulo "${esperado.titulo}"`)
        .toContain(esperado.titulo);

      if (esperado.descripcion) {
        expect(texto, 'El modal no muestra la descripcion de la base')
          .toContain(esperado.descripcion);
      }

      // Cuerpo completo contra la base. En Hoteles son dos solapas: la
      // descripcion sale de HotelDetail.Detail y la ficha tecnica de
      // HotelTechnicalSheet.Content, que es otra tabla.
      await compararTextoDelDetalle(t, cfg, 'Detail');
      if (cfg.detalleEsperado?.TechnicalSheet) {
        await compararTextoDelDetalle(t, cfg, 'TechnicalSheet');
      }

      await t.cerrarModalDetalle(modal);
    });
  }


  /**
   * Valida que el boton de descarga Word baje un archivo de verdad.
   *
   * Solo corre en las pestanias que tienen el boton segun la matriz (Paquetes y
   * Ofertas). Antes se verificaba unicamente que el onclick estuviera en el
   * markup: el boton podia estar y el archivo no bajar nunca.
   */
  async function validarDescargaWord(page: Page, t: TarifarioPage, cfg: any) {
    if (!cfg.elementos?.descargaWord) return;

    await paso(page, 'El boton de descarga Word baja el archivo', async () => {
      let descarga;
      try {
        descarga = await t.descargarWord(cfg.container);
      } catch (error) {
        await resaltarYCapturar(
          page,
          t.locatorBotonWord(cfg.container),
          'FALLA: el boton de descarga Word no bajo ningun archivo',
          t.locatorCard(cfg.container),
        );
        throw error;
      }

      const nombre = descarga.suggestedFilename();
      const ruta = await descarga.path();
      const bytes = ruta ? fs.statSync(ruta).size : 0;

      // Un .docx es un ZIP: tiene que empezar con "PK". Sin esto, un endpoint
      // que devuelve una pagina de error con nombre .docx pasaria como valido.
      const firma = ruta ? fs.readFileSync(ruta).subarray(0, 2).toString('latin1') : '';

      await adjuntarTexto('Archivo descargado',
        'nombre: ' + nombre + SALTO +
        'bytes:  ' + bytes + SALTO +
        'firma:  ' + JSON.stringify(firma) + '  (un .docx es un ZIP, empieza con PK)');

      expect(nombre, `El archivo descargado no es un .docx: "${nombre}"`).toMatch(/\.docx$/i);
      expect(bytes, 'El archivo descargado esta vacio').toBeGreaterThan(0);
      expect(firma, 'El archivo descargado no es un .docx valido').toBe('PK');
    });
  }


  /**
   * Valida los elementos de la card contra la base:
   *   - observaciones destacadas -> ServiceObservation con IsPriority = 1
   *   - leyenda "Mas observaciones disponibles en el detalle"
   *   - tooltips (duracion, idiomas, operatividad y amenity destacada)
   *   - tag RECOMENDADO -> Hotel.Great = 1
   */
  async function validarCard(page: Page, t: TarifarioPage, cfg: any) {
    const card = cfg.card;
    if (!card) return;

    await paso(page, 'La card muestra los datos destacados de la base', async () => {
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
  async function validarElementos(page: Page, t: TarifarioPage, cfg: any) {
    await paso(page, 'La card muestra los componentes que corresponden', async () => {
      const esperados = cfg.elementos;
      const hay = (await t.elementosDeLaCard(cfg.container)) as Record<string, boolean>;
      const src = await t.srcImagen(cfg.container);

      await adjuntarTexto('Componentes de la card',
        Object.keys(esperados)
          .map((k) => `${k.padEnd(18)} esperado: ${String(esperados[k]).padEnd(6)} en pantalla: ${hay[k]}`)
          .join(SALTO) + SALTO + SALTO + 'src de la imagen: ' + src);

      for (const clave of Object.keys(esperados)) {
        if (hay[clave] !== esperados[clave]) {
          await resaltarYCapturar(
            page,
            t.locatorDeComponente(cfg.container, clave),
            `FALLA: componente "${clave}"`,
            t.locatorCard(cfg.container),
          );
        }
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


  /**
   * Compara los importes con la linea base capturada: si un cambio del sistema
   * altera un precio, el recargo por idioma o la marca TARIFA EXTENDIDA, falla.
   * Se recorren todas las solapas de idioma, porque el precio cambia entre ellas.
   */
  async function validarImportes(page: Page, t: TarifarioPage, clave: string, cfg: any) {
    const esperado = (lineaBase.items as Record<string, any>)[clave];
    if (!esperado) return;

    await paso(page, 'Los importes coinciden con la linea base', async () => {
      const actual = await t.capturarTarifas(cfg.container);

      const resumen = (x: any) =>
        Object.entries(x.porIdioma)
          .map(([idioma, filas]: any) => `[${idioma}] ` + filas.map((f: string[]) => f.join(' | ')).join(SALTO))
          .join(SALTO);

      await adjuntarTexto('Importes esperados (linea base)', resumen(esperado).slice(0, 4000));
      await adjuntarTexto('Importes en pantalla', resumen(actual).slice(0, 4000));

      expect(actual.solapasIdioma,
        `Cambio la cantidad de solapas de idioma (esperadas ${esperado.solapasIdioma})`,
      ).toBe(esperado.solapasIdioma);

      expect(actual.tarifaExtendida,
        `Cambio la cantidad de marcas TARIFA EXTENDIDA (esperadas ${esperado.tarifaExtendida})`,
      ).toBe(esperado.tarifaExtendida);

      for (const [idioma, filasEsperadas] of Object.entries(esperado.porIdioma) as [string, string[][]][]) {
        const filasActuales = actual.porIdioma[idioma];
        expect(filasActuales, `Falta la solapa de idioma "${idioma}"`).toBeDefined();

        // Se compara fila por fila para poder senalar cual difiere, en vez de
        // decir "cambiaron los importes" sin precisar donde.
        const maximo = Math.max(filasEsperadas.length, filasActuales.length);
        for (let i = 0; i < maximo; i++) {
          const esp = filasEsperadas[i] ? filasEsperadas[i].join(' | ') : '(no existe)';
          const act = filasActuales[i] ? filasActuales[i].join(' | ') : '(no existe)';
          if (esp !== act) {
            // Al capturar se recorrieron todas las solapas: hay que volver a la
            // que fallo para que la captura muestre el dato correcto.
            await t.volverASolapaIdioma(idioma);
            await resaltarYCapturar(page, t.locatorFilaTarifa(cfg.container, i),
              `FALLA: fila ${i} de la solapa "${idioma}"`);
            expect(act,
              `Cambio la fila ${i} de la solapa "${idioma}".` + SALTO +
              `esperado: ${esp}` + SALTO + `en pantalla: ${act}`,
            ).toBe(esp);
          }
        }
        expect(filasActuales.length,
          `Cambio la cantidad de filas de la solapa "${idioma}"`,
        ).toBe(filasEsperadas.length);
      }
    });
  }

  async function validarItem(page: Page, cfg: Config, titulo: string) {
    const tarifario = new TarifarioPage(page);
    const ciudad = CIUDAD[cfg.tab] ?? 'Buenos Aires';

    await paso(page, `Filtrar por Argentina / ${ciudad} y buscar`, async () => {
      await tarifario.seleccionarPais('Argentina');
      await tarifario.seleccionarCiudad(ciudad);
      const filtros = await tarifario.filtrosActuales();
      await adjuntarTexto('Filtros aplicados',
        `Pais: ${filtros.pais}\nCiudad: ${filtros.ciudad}`);
      await tarifario.buscar();
    });

    await paso(page, `Abrir la pestania ${titulo} y esperar tarifas`, async () => {
      const disponible = await tarifario.pestaniaEstaDisponible(cfg.tab);
      expect(disponible, `La pestania ${titulo} (#${cfg.tab}) no esta visible`).toBe(true);
      await tarifario.abrirPestania(cfg.tab, cfg.container);
    });

    await paso(page, `Buscar "${cfg.terminoBusqueda}" en el buscador de la pantalla`, async () => {
      await tarifario.buscarPorNombre(cfg.terminoBusqueda, cfg.nombre);
    });

    await paso(page, 'El item aparece con su nombre exacto', async () => {
      const texto = await tarifario.textoDe(cfg.container);
      await adjuntarTexto('Esperado', `ID: ${cfg.id}\nNombre: ${cfg.nombre}`);
      await adjuntarTexto('Obtenido en pantalla', texto.slice(0, 3000));
      expect(texto, `No se encontro "${cfg.nombre}" en #${cfg.container}`)
        .toContain(cfg.nombre);
    });

    await validarElementos(page, tarifario, cfg);

    // El estado del boton se guarda para validarlo en su propio paso.
    let botonesAntes: string[] = [];
    let botonesDespues: string[] = [];

    await paso(page, 'Desplegar el tarifario del item', async () => {
      // El boton tiene que alternar "Ver Tarifario" -> "Cerrar Tarifario".
      // Se guarda el texto antes y despues para validarlo en el paso siguiente.
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

    // El paso exige la misma transicion en todas las pestanias. Antes, en
    // Cruceros se invertia la validacion y se daba por bueno que el boton
    // siguiera diciendo "Ver Tarifario": el paso salia en verde con el defecto
    // a la vista en la captura. Lo que la aplicacion hace no define lo esperado.
    await paso(page, 'El boton pasa de "Ver Tarifario" a "Cerrar Tarifario"', async () => {
      const btn = cfg.botonTarifario;
      const hayCerrar = botonesDespues.some((t) => t.includes(btn.textoDesplegado));

      await adjuntarTexto('Transicion del boton',
        'antes de desplegar:   ' + botonesAntes.join(' | ') + SALTO +
        'despues de desplegar: ' + botonesDespues.join(' | ') + SALTO +
        'esperado antes:       ' + btn.textoInicial + SALTO +
        'esperado despues:     ' + btn.textoDesplegado +
        (btn._hallazgoConocido ? SALTO + SALTO + 'HALLAZGO CONOCIDO: ' + btn._hallazgoConocido : ''));

      expect(botonesAntes.join(' | '), `Ningun boton dice "${btn.textoInicial}"`)
        .toContain(btn.textoInicial);

      if (!hayCerrar) {
        await resaltarYCapturar(page, tarifario.locatorDeComponente(cfg.container, 'botonTarifario'),
          `FALLA: el boton sigue diciendo "${botonesDespues.join(' | ')}" y deberia decir "${btn.textoDesplegado}"`);
      }

      // Soft: el tarifario ya quedo desplegado y con filas (paso anterior), asi
      // que las validaciones que siguen tienen sentido igual. Con un expect duro
      // el test cortaba aca y tapaba el resto de los hallazgos de la pestania.
      expect.soft(hayCerrar,
        `Al desplegar, el boton deberia pasar a "${btn.textoDesplegado}". ` +
        `En pantalla dice: ${botonesDespues.join(' | ')}`,
      ).toBe(true);
    });

    return tarifario;
  }

  test('Paquetes: trae tarifas y muestra el paquete esperado', async ({ page }) => {
    const t = await validarItem(page, T.paquetes as Config, 'Paquetes');
    await validarImportes(page, t, 'paquetes', T.paquetes);
    await validarModalDetalle(page, t, T.paquetes);
    await validarDescargaWord(page, t, T.paquetes);
    await paso(page, 'El paquete muestra sus dos ciudades', async () => {
      const texto = await t.textoDe(T.paquetes.container);
      for (const c of T.paquetes.ciudades) {
        expect(texto, `Falta la ciudad ${c.nombre}`).toContain(c.nombre);
      }
    });
  });

  test('Excursiones: trae tarifas y muestra la excursion esperada', async ({ page }) => {
    const t = await validarItem(page, T.excursiones as Config, 'Excursiones');
    await validarImportes(page, t, 'excursiones', T.excursiones);
    await validarCard(page, t, T.excursiones);
    await validarFichaDetalle(page, t, T.excursiones);
  });

  test('Hoteles: trae tarifas y muestra el hotel esperado', async ({ page }) => {
    const thoteles = await validarItem(page, T.hoteles as Config, 'Hoteles');
    await validarImportes(page, thoteles, 'hoteles', T.hoteles);
    await validarCard(page, thoteles, T.hoteles);
    await validarModalDetalle(page, thoteles, T.hoteles);
  });

  test('Traslados: trae tarifas y muestra el traslado esperado', async ({ page }) => {
    const t = await validarItem(page, T.traslados as Config, 'Traslados');
    await validarImportes(page, t, 'traslados', T.traslados);
    await validarCard(page, t, T.traslados);
    await validarFichaDetalle(page, t, T.traslados);
  });

  test('Cena Show: trae tarifas y coinciden con las de la base', async ({ page }) => {
    const cfg = T.cenaShow;
    const t = await validarItem(page, cfg as Config, 'Cena Show');
    await validarImportes(page, t, 'cenaShow', cfg);

    await paso(page, 'Las tarifas coinciden con las de la base de datos', async () => {
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

    await validarCard(page, t, cfg);
    await validarFichaDetalle(page, t, cfg);
  });

  // Las cabinas no figuran en la card del listado: se ven al abrir el detalle
  // ("Ver Tarifario"). Esa validacion queda para el test de detalle.
  //
  // Cruceros arrastra dos defectos de la aplicacion y el test los muestra a los
  // dos en la misma corrida, sin dar ninguno por esperado:
  //   - el boton no pasa a "Cerrar Tarifario": no existe CruiseTariffDetailControl.ascx
  //   - el modal "Ver detalle" no abre: el onclick tiene las comillas mal cerradas
  //     (Online/Module/CruiseTariffControl.ascx, linea 48), lo que lo deja como
  //     JavaScript invalido. Presente tambien en la rama preprod.
  // Queda en rojo hasta que se corrijan: el paso no se puede ejecutar tal como
  // esta escrito, y eso es el hallazgo.
  test('Cruceros: trae tarifas y muestra el crucero esperado', async ({ page }) => {
    const t = await validarItem(page, T.cruceros as Config, 'Cruceros');
    await validarImportes(page, t, 'cruceros', T.cruceros);
    await validarModalDetalle(page, t, T.cruceros);
  });

  test('Ofertas: trae tarifas y muestra la oferta esperada', async ({ page }) => {
    const t = await validarItem(page, T.ofertas as Config, 'Ofertas');
    await validarImportes(page, t, 'ofertas', T.ofertas);
    await validarModalDetalle(page, t, T.ofertas);
    await validarDescargaWord(page, t, T.ofertas);
    await paso(page, 'La oferta muestra sus dos ciudades', async () => {
      const texto = await t.textoDe(T.ofertas.container);
      for (const c of T.ofertas.ciudades) {
        expect(texto, `Falta la ciudad ${c.nombre}`).toContain(c.nombre);
      }
    });
  });

});
