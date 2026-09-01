import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga, normalizarFechaDeHoy } from '../utils/pasos';

/**
 * Tarifario del sitio publico.
 *
 * El recorrido replica el de un usuario real, sin atajos por URL:
 *   1. Entrar al Tarifario desde el menu del header.
 *   2. Elegir Pais y Ciudad en los combos del filtro.
 *   3. Presionar "Buscar" (__doPostBack de ctrlTariffFilterControl$lnkView).
 *   4. Abrir la pestania del tipo de producto.
 *   5. Buscar el item por nombre en el buscador de la barra de resultados.
 *
 * Referencias del codigo:
 *   Online/Module/TariffFilterControl.ascx -> ddCountry, ddCity, lnkView, tariffSearchSelect
 *   Online/js/mainws.js                    -> loadTariffs / pagedPick / pagedSearch
 */
export class TarifarioPage {
  /**
   * Solapas de idioma. Matchea los dos prefijos que existen en el modulo:
   * "srl-" (servicios) y "trl-" (paquetes).
   */
  static readonly SOLAPAS_IDIOMA = "[class*='-lang-tabs-']";

  constructor(private readonly page: Page) {}

  // --- Filtros de la barra superior ---
  readonly comboPais      = "[id$='ddCountry']";
  readonly comboCiudad    = "[id$='ddCity']";
  readonly comboResidente = "[id$='ddResident']";
  readonly btnBuscar      = "[id$='lnkView']";

  // --- Buscador por nombre (TomSelect sobre #tariffSearchSelect) ---
  // TomSelect renombra el <select id="X"> a: input #X-ts-control y opciones #X-opt-N.
  // Los combos Pais/Ciudad tambien son TomSelect, por eso se acota por ese id
  // y no por '.ts-dropdown .option', que matchea el dropdown de Ciudad.
  readonly buscadorNombre   = '#tariffSearchSelect';
  readonly buscadorControl  = '.tariff-name-box .ts-control';
  readonly buscadorInput    = '#tariffSearchSelect-ts-control';
  readonly buscadorOpciones = "[id^='tariffSearchSelect-opt-']";
  readonly btnLimpiarFiltros = '#tariffClearFilters';
  readonly contadorResultados = '#tariffResultCount';

  /**
   * Entra al Tarifario desde el menu del header, como lo haria un usuario.
   * El texto del menu se muestra en mayusculas ("TARIFARIO"), por eso el match
   * va sin `exact` (Playwright compara sin distinguir mayusculas en ese caso).
   */
  async irDesdeElMenu() {
    await this.page.getByRole('link', { name: 'Tarifario' }).first().click();
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.comboPais)).toBeVisible({ timeout: 60_000 });
  }

  pestania(tab: string): Locator {
    return this.page.locator(`#${tab}`);
  }

  contenedor(container: string): Locator {
    return this.page.locator(`#${container}`);
  }

  /**
   * Ambito donde buscar las tarifas: el contenedor de la pestania mas los divs
   * de detalle que el AJAX inyecta, que segun la pestania quedan fuera de el.
   *   loadDetail / loadServiceDetail / loadHotelDetail -> #detailcnt-{guid}
   *   loadDetailOpportunity                            -> #detailoptcnt-{guid}
   */
  ambitoTarifas(container: string): Locator {
    return this.page.locator(
      `#${container}, [id^="detailcnt-"], [id^="detailoptcnt-"], [id^="detailtscnt-"]`,
    );
  }

  /** Algunas pestanias son condicionales (Travel Sale viene oculta). */
  async pestaniaEstaDisponible(tab: string): Promise<boolean> {
    const loc = this.pestania(tab);
    return (await loc.count()) > 0 && (await loc.isVisible());
  }

  async seleccionarPais(pais: string) {
    await this.page.locator(this.comboPais).selectOption({ label: pais });
    await esperarFinDeCarga(this.page);
  }

  async seleccionarCiudad(ciudad: string) {
    await this.page.locator(this.comboCiudad).selectOption({ label: ciudad });
    await esperarFinDeCarga(this.page);
  }

  async filtrosActuales(): Promise<{ pais: string; ciudad: string }> {
    const texto = async (sel: string) =>
      (await this.page.locator(`${sel} option:checked`).first().innerText()).trim();
    return { pais: await texto(this.comboPais), ciudad: await texto(this.comboCiudad) };
  }

  /** Presiona Buscar. Sin esto las pestanias cargan vacias. */
  async buscar() {
    await this.page.locator(this.btnBuscar).click();
    await esperarFinDeCarga(this.page);
  }

  /** Abre la pestania y espera a que el contenedor traiga resultados. */
  async abrirPestania(tab: string, container: string) {
    await this.pestania(tab).click();
    await esperarFinDeCarga(this.page);
    await this.esperarResultados(container);
  }

  /** Corta apenas la navegacion se sale del tarifario, para no diagnosticar a ciegas. */
  async verificarSeguimosEnElTarifario(desde: string) {
    const url = this.page.url();
    if (!url.toLowerCase().includes('defaulttariff')) {
      throw new Error(
        `La navegacion se fue del tarifario despues de "${desde}". URL actual: ${url}`,
      );
    }
  }

  async esperarResultados(container: string) {
    const cont = this.contenedor(container);
    await expect(cont).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(async () => (await cont.innerText()).trim().length, { timeout: 60_000 })
      .toBeGreaterThan(0);
  }

  /**
   * Busca un item con el buscador de la barra de resultados.
   *
   * Es un TomSelect: se escribe un termino corto (como haria un usuario) y se
   * elige del dropdown la opcion que corresponde al item. Elegirla dispara
   * pagedPick(), que deja el contenedor con ese unico item.
   *
   * Se tipea un termino corto y no el nombre completo a proposito: con textos
   * largos el dropdown se cierra a mitad del tipeo.
   */
  async buscarPorNombre(termino: string, nombreEsperado?: string) {
    const objetivo = nombreEsperado ?? termino;

    await this.page.locator(this.buscadorControl).click();
    const input = this.page.locator(this.buscadorInput);
    await input.fill('');
    await input.pressSequentially(termino, { delay: 30 });

    const opciones = this.page.locator(this.buscadorOpciones);
    await expect(opciones.first()).toBeVisible({ timeout: 30_000 });

    const elegida = opciones.filter({ hasText: objetivo }).first();
    if (!(await elegida.count())) {
      const disponibles = await opciones.allInnerTexts();
      throw new Error(
        `El buscador no ofrecio "${objetivo}" al tipear "${termino}". ` +
        `Opciones ofrecidas: ${disponibles.slice(0, 15).join(' | ')}`,
      );
    }
    await elegida.click();
    await esperarFinDeCarga(this.page);
  }

  /** Opciones que ofrece el buscador en este momento (para el reporte). */
  async opcionesDelBuscador(): Promise<string[]> {
    return this.page.locator(this.buscadorOpciones).allInnerTexts();
  }


  /**
   * Despliega el detalle de tarifas de la card ("Ver Tarifario").
   * El boton llama a loadServiceDetail(serviceId, containerId) y el resultado
   * se inyecta por AJAX; por eso se espera a que aparezcan las filas.
   */
  /**
   * Textos de los botones que despliegan/cierran el tarifario.
   *
   * Al desplegar, el *TariffDetailControl inyecta un boton "Cerrar Tarifario"
   * que es un elemento DISTINTO del original: por eso se leen todos y no el
   * primero, que seguiria diciendo "Ver Tarifario".
   */
  async textosBotonesTarifario(container: string): Promise<string[]> {
    return this.contenedor(container)
      .locator("a[onclick*='load'], a.accordeon-header, a.tariff-view-table")
      .evaluateAll((els) =>
        els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
           .filter(Boolean),
      );
  }

  async verTarifario(container: string) {
    // Servicios, hoteles, paquetes y ofertas piden el detalle por AJAX con un
    // onclick load*(). Cruceros no: su tabla ya viene renderizada pero oculta,
    // y el boton es un acordeon por clase (a.accordeon-header).
    //
    // Ojo: en cruceros las tablas estan en el DOM aunque el usuario no las vea,
    // asi que hay que abrir el acordeon si o si; leerlas sin abrirlo da un falso verde.
    const porAjax = this.contenedor(container).locator("a[onclick*='load']").first();
    const acordeon = this.contenedor(container).locator('a.accordeon-header').first();

    if (await porAjax.count()) {
      await porAjax.click();
      await esperarFinDeCarga(this.page);
    } else if (await acordeon.count()) {
      await acordeon.click();
      await esperarFinDeCarga(this.page);
    }

    // El detalle que llega por AJAX entra plegado y, segun la pestania, en un
    // contenedor distinto (ver mainws.js):
    //   loadDetail / loadServiceDetail / loadHotelDetail -> #detailcnt-{guid}
    //   loadDetailOpportunity                            -> #detailoptcnt-{guid}
    //   travel sale                                      -> #detailtscnt-{guid}
    // Por eso el acordeon a abrir puede quedar fuera del contenedor de la pestania.
    // El detalle que llega por AJAX entra plegado, y segun la pestania el div
    // queda en un contenedor distinto (#detailcnt- / #detailoptcnt- / #detailtscnt-,
    // ver mainws.js). Ademas en la card hay varios a.accordeon-header: los nombres
    // de los items tambien usan esa clase.
    //
    // En vez de adivinar cual es el del tarifario, se abren los acordeones visibles
    // de a uno hasta que aparezcan tablas: es lo que haria un usuario y no depende
    // del texto ni del orden, que varian entre pestanias.
    const hayTablas = async () =>
      (await this.ambitoTarifas(container).locator('table:visible').count()) > 0;

    // El detalle que llega por AJAX trae las tarifas agrupadas, y cada grupo entra
    // plegado: el div.col-md-12 que envuelve cada tabla queda en display:none.
    // Sus cabeceras son a.accordeon-header.tariff-detail-group-name (el nombre del
    // grupo), distintas del "Ver/Cerrar Tarifario" que despliega el bloque entero.
    if (!(await hayTablas())) {
      const grupos = this.ambitoTarifas(container)
        .locator('a.accordeon-header.tariff-detail-group-name:visible');
      const total = await grupos.count();
      for (let i = 0; i < total; i++) {
        await grupos.nth(i).click().catch(() => {});
      }
      await esperarFinDeCarga(this.page);
    }

    // Se cuenta sobre tablas VISIBLES: en cruceros hay 17 tablas ocultas en el DOM
    // y contarlas sin filtrar daria verde sin que el usuario vea nada.
    // Se cuenta la tabla y no la fila porque en las de SGL/DBL/TPL la primera fila
    // es un encabezado de altura cero.
    await this.verificarSeguimosEnElTarifario('desplegar el tarifario');

    await expect
      .poll(async () => this.ambitoTarifas(container).locator('table:visible').count(),
            { timeout: 60_000 })
      .toBeGreaterThan(0);
  }

  /** Importes que muestra la tabla de tarifas desplegada. */
  async preciosDelTarifario(container: string): Promise<string[]> {
    const filas = await this.leerTablaTarifas(container);
    return filas
      .flat()
      .filter((c) => /(USD|ARS|\$)\s*[0-9]/.test(c));
  }

  /** Filas de la tabla de tarifas desplegada: FECHAS | TIPO | PAX | PRECIO. */
  async leerTablaTarifas(container: string): Promise<string[][]> {
    const filas = await this.ambitoTarifas(container).locator('table:visible tr').evaluateAll((trs) =>
      trs
        .map((tr) =>
          Array.from(tr.querySelectorAll('th,td'))
            .map((c) => (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
            .filter(Boolean),
        )
        .filter((f) => f.length),
    );
    // La vigencia de la primera fila arranca hoy: sin normalizar, la linea base
    // caduca de un dia para el otro. Ver normalizarFechaDeHoy en utils/pasos.
    return filas.map((f) => f.map((celda) => normalizarFechaDeHoy(celda)));
  }

  /**
   * Markup activo del usuario, que se muestra en el header como "M 0.50".
   * Se lee de la pantalla y no se fija por configuracion: si alguien lo cambia,
   * el test compara contra el valor real en vez de dar un falso positivo.
   */
  async markupActivo(): Promise<number | null> {
    const texto = await this.page.locator('body').innerText();
    const m = texto.match(/M\s*([0-9]+[.,][0-9]+)/);
    return m ? Number(m[1].replace(',', '.')) : null;
  }


  // --- Ficha de detalle (popup "Ver Detalle") ---
  // openServiceSheet(link, containerId) trae la ficha de /advisorws/loadservicesheet/
  // y la inyecta en .svc-sheet-body. Las solapas son condicionales: si el dato no
  // esta cargado, la solapa no se renderiza (ver ServiceSheetControl.RenderSheet).
  readonly fichaSolapas = '.svc-tab';
  readonly fichaPanel   = '.svc-panel';

  /** Abre el popup "Ver Detalle" del item y espera a que cargue la ficha. */
  async abrirFichaDetalle(container: string) {
    const boton = this.contenedor(container)
      .locator("a[onclick*='openServiceSheet']").first();
    await expect(boton).toBeVisible({ timeout: 30_000 });
    await boton.click();
    await expect(this.page.locator('.svc-sheet')).toBeVisible({ timeout: 60_000 });
    await esperarFinDeCarga(this.page);
  }

  /** Claves de las solapas presentes en la ficha (description, technical, ...). */
  async solapasDeLaFicha(): Promise<string[]> {
    return this.page.locator(this.fichaSolapas).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-tab') ?? '').filter(Boolean),
    );
  }

  /** Hace clic en una solapa de la ficha, si esa solapa existe. */
  private async abrirSolapa(clave: string) {
    const solapa = this.page.locator(`${this.fichaSolapas}[data-tab="${clave}"]`);
    if (await solapa.count()) await solapa.click();
  }

  /** Abre una solapa de la ficha y devuelve su texto. */
  async contenidoDeSolapa(clave: string): Promise<string> {
    await this.abrirSolapa(clave);
    const panel = this.page.locator(`${this.fichaPanel}[data-tab="${clave}"]`);
    return (await panel.innerText()).replace(/\s+/g, ' ').trim();
  }

  /**
   * Listas de "Incluye" y "No incluye" de la solapa de amenities, con la
   * descripcion de cada item.
   *
   * El markup es <li><i/><span>NOMBRE<span>DESCRIPCION</span></span></li>
   * (ServiceSheetControl.ascx.cs:354), y el span interno va con display:block,
   * asi que en innerText la descripcion queda como segunda linea. Antes se
   * tomaba solo la primera y la descripcion no se validaba contra nada.
   */
  async amenitiesDeLaFicha(): Promise<{
    incluye: { nombre: string; descripcion: string }[];
    noIncluye: { nombre: string; descripcion: string }[];
  }> {
    await this.contenidoDeSolapa('amenities');
    const leer = async (clase: string) =>
      this.page.locator(`.${clase} li`).evaluateAll((els) =>
        els.map((e) => {
          const lineas = (e as HTMLElement).innerText
            .split(String.fromCharCode(10)).map((x) => x.trim()).filter(Boolean);
          return { nombre: lineas[0] ?? '', descripcion: lineas.slice(1).join(' ') };
        }).filter((x) => x.nombre),
      );
    return {
      incluye: await leer('svc-amenity-included'),
      noIncluye: await leer('svc-amenity-excluded'),
    };
  }

  /**
   * Lee el calendario de la solapa Salidas sin navegarlo.
   *
   * El calendario se arma en cliente desde los atributos de .svc-calendar
   * (ServiceSheetCalendarHtml.Render): data-start es el primer dia, data-months
   * cuantos meses cubre y data-days un codigo por dia. -1 es un dia fuera de la
   * operatividad y -2 un cierre declarado por excepcion; cualquier valor >= 0 es
   * un dia con salida. Asi se puede saber que meses operan sin tener que hacer
   * clic en las flechas para recorrer los doce.
   */
  async calendarioDeSalidas(): Promise<{ mesesConSalida: number[]; modalidades: string[] }> {
    await this.contenidoDeSolapa('calendar');

    const cal = this.page.locator('.svc-calendar').first();
    await expect(cal).toBeAttached({ timeout: 15_000 });

    const mesesConSalida = await cal.evaluate((el) => {
      const inicio = el.getAttribute('data-start') ?? '';
      const dias: number[] = JSON.parse(el.getAttribute('data-days') ?? '[]');
      const desde = new Date(inicio + (inicio.length <= 10 ? 'T00:00:00' : ''));
      const meses = new Set<number>();
      dias.forEach((codigo, i) => {
        if (codigo < 0) return;
        const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i);
        meses.add(d.getMonth() + 1);
      });
      return Array.from(meses).sort((a, b) => a - b);
    });

    // Acotado al panel de Salidas: la Ficha Tecnica tiene sus propias subsolapas
    // Regular/Privado para la tabla semanal, y a nivel pagina se contaban las dos veces.
    const modalidades = await this.page
      .locator(`${this.fichaPanel}[data-tab="calendar"] .svc-modality-tab`)
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.trim()).filter(Boolean));

    return { mesesConSalida, modalidades };
  }

  /** Cierra el popup de la ficha. */
  async cerrarFichaDetalle() {
    await this.page.keyboard.press('Escape');
    await this.page.locator('.svc-sheet').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
  }


  /**
   * Abre el modal "Ver detalle" de paquetes, hoteles, cruceros y ofertas.
   *
   * A diferencia de los servicios (que piden la ficha por AJAX con
   * openServiceSheet), estos modales ya vienen renderizados en el HTML y el
   * boton solo hace $('#modal-XXX').modal('show').
   *
   * Devuelve el locator del modal abierto.
   */
  async abrirModalDetalle(container: string): Promise<Locator> {
    const boton = this.locatorBotonVerDetalle(container);
    await expect(boton).toBeVisible({ timeout: 30_000 });

    const onclick = (await boton.getAttribute('onclick')) ?? '';
    const id = onclick.match(/#(modal-[A-Za-z0-9-]+)/)?.[1];
    if (!id) throw new Error(`El boton "Ver detalle" no apunta a ningun modal: ${onclick}`);

    await boton.click();
    const modal = this.page.locator(`#${id}`);
    await expect(modal).toBeVisible({ timeout: 30_000 });
    return modal;
  }

  /**
   * Texto del detalle que esta abierto en pantalla, sea la ficha de un servicio
   * o el modal de un hotel, paquete, oferta o crucero.
   *
   * Hay dos formas de mostrarlo y el metodo cubre las dos:
   *   - con solapas (.svc-panel[data-tab]), que es lo que arma ServiceSheet para
   *     los servicios y RenderHotelSheet para los hoteles;
   *   - sin solapas, y entonces el texto esta directo en el cuerpo del modal,
   *     que es el caso de paquetes, ofertas y cruceros.
   */
  async textoDelDetalleAbierto(campo: 'Detail' | 'TechnicalSheet'): Promise<string> {
    const solapa = campo === 'TechnicalSheet' ? 'technical' : 'description';
    const panel = this.page.locator(`${this.fichaPanel}[data-tab="${solapa}"]`);

    if (await panel.count()) {
      // Hay que abrir la solapa antes de leerla: los paneles que no estan
      // activos van ocultos y innerText devuelve vacio.
      await this.abrirSolapa(solapa);
      // Se devuelve con los saltos, a diferencia de contenidoDeSolapa, porque el
      // comparador los necesita para separar en lineas.
      return (await panel.first().innerText()).trim();
    }

    if (campo === 'TechnicalSheet') {
      throw new Error('Se esperaba una solapa de ficha tecnica y la pantalla no la muestra');
    }

    const cuerpo = this.page.locator('.modal.in .modal-body').first();
    await expect(cuerpo).toBeVisible({ timeout: 15_000 });
    // Sin colapsar: el comparador necesita los saltos para separar en lineas.
    return (await cuerpo.innerText()).trim();
  }


  /**
   * Boton "Ver detalle" de la card, para poder resaltarlo cuando no abre el modal.
   */
  locatorBotonVerDetalle(container: string): Locator {
    return this.contenedor(container)
      .locator("a:has-text('Ver detalle'), a:has-text('Ver Detalle')").first();
  }


  /**
   * Descarga el tarifario en Word y devuelve la descarga de Playwright.
   *
   * El flujo esta en ExportWordModal.ascx: el boton llama a downloadWord(), que
   * abre el modal de eleccion de agencia solo si el usuario es admin y esta
   * simulando; en cualquier otro caso baja directo. Despues confirmDownload()
   * pide /advisorws/downloadWordTourTariff/ y arma la descarga con un blob.
   *
   * Antes esto se verificaba solo por presencia del onclick: el boton podia
   * estar y el archivo no bajar nunca.
   */
  async descargarWord(container: string) {
    const boton = this.locatorBotonWord(container);
    await expect(boton).toBeVisible({ timeout: 30_000 });

    // La espera se arma antes del click: la descarga puede resolverse enseguida.
    const descarga = this.page.waitForEvent('download', { timeout: 90_000 });
    await boton.click();

    const modal = this.page.locator('#modalDownloadWord');
    await modal.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});
    if (await modal.isVisible().catch(() => false)) {
      await modal.locator('.btn-download').click();
    }

    return descarga;
  }

  /**
   * Boton de descarga Word, para resaltarlo si la descarga no arranca.
   *
   * Va por el onclick y no por la clase: en ServiceTariffControl.ascx:57 el
   * boton de Proveedores tambien lleva .btn-download-word, asi que por clase se
   * clickearia Proveedores creyendo que se descarga un Word.
   */
  locatorBotonWord(container: string): Locator {
    return this.contenedor(container).locator("[onclick*='downloadWord']").first();
  }


  /**
   * Abre el modal de Proveedores y devuelve sus filas.
   *
   * openSuppliersModal() (ViewSuppliersModal.ascx) pide
   * /advisorws/loadservicesuppliers/ o /loadhotelsuppliers/ con fetch y arma el
   * tbody a mano, con cuatro celdas: importancia, proveedor, operador y
   * observacion. El endpoint devuelve [] si el usuario no es WebUserTypeID = 1.
   */
  async abrirModalProveedores(container: string): Promise<string[][]> {
    const boton = this.locatorBotonProveedores(container);
    await expect(boton).toBeVisible({ timeout: 30_000 });
    await boton.click();

    // Se toma el primero a proposito. ViewSuppliersModal.ascx esta incluido por
    // ServiceTariffControl y por HotelTariffControl, y tiene los ids escritos a
    // mano, asi que en el tarifario hay DOS #modalViewSuppliers en el DOM. El
    // propio openSuppliersModal usa document.getElementById, que devuelve el
    // primero: los botones de Servicios y de Hoteles manejan la misma instancia.
    const modal = this.page.locator('#modalViewSuppliers').first();
    await expect(modal).toBeVisible({ timeout: 30_000 });

    // El cuerpo se llena por fetch: hay que esperar a que deje de cargar.
    await this.page.locator('#suppliersLoading').first()
      .waitFor({ state: 'hidden', timeout: 30_000 });

    return modal.locator('#suppliersTableBody tr').evaluateAll((filas) =>
      filas.map((f) => Array.from(f.querySelectorAll('td'))
        .map((c) => (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim())),
    );
  }

  /** Cierra el modal de Proveedores con su propio boton. */
  async cerrarModalProveedores() {
    const modal = this.page.locator('#modalViewSuppliers').first();
    await modal.locator('.close-custom-suppliers').click();
    await modal.waitFor({ state: 'hidden', timeout: 15_000 });
  }

  /** Boton de Proveedores de la card, para resaltarlo si el modal no abre. */
  locatorBotonProveedores(container: string): Locator {
    return this.contenedor(container).locator("[onclick*='openSuppliersModal']").first();
  }


  /**
   * Descarga la ficha del servicio en PDF y devuelve la descarga de Playwright.
   *
   * downloadServiceSheetPdf() (Online/js/service-sheet.js) pide
   * /advisorws/createservicesheetpdf/ y arma la descarga con un blob, con el
   * nombre ficha-<ServiceID>.pdf. El boton vive dentro de la ficha, asi que
   * esto se llama con la ficha abierta.
   */
  async descargarPdfFicha(container: string) {
    const boton = this.locatorBotonPdf(container);
    await expect(boton).toBeVisible({ timeout: 30_000 });

    // 20s alcanzan: el endpoint responde en menos de 2. Antes eran 90 y, con el
    // defecto del PDF sin corregir, cada servicio sumaba minuto y medio muerto.
    const descarga = this.page.waitForEvent('download', { timeout: 20_000 });
    await boton.click();
    return descarga;
  }

  /** Boton de descarga PDF de la ficha, para resaltarlo si no baja nada. */
  locatorBotonPdf(container: string): Locator {
    return this.contenedor(container).locator('.tariff-pdf-btn').first();
  }

  /**
   * Cierra el modal de detalle abierto, con su propio boton de cierre.
   *
   * Antes se cerraba con Escape y la espera se tragaba el error: el modal
   * quedaba a medias (aria-hidden="true" pero conservando la clase "in"),
   * seguia tapando la pantalla y hacia fallar el click al boton de descarga
   * Word del paso siguiente. Ahora se usa el boton que trae el markup
   * (data-dismiss="modal") y si no cierra, falla.
   */
  async cerrarModalDetalle(modal: Locator) {
    const cerrar = modal.locator('.modal-header .close[data-dismiss="modal"]').first();
    if (await cerrar.count()) await cerrar.click();
    else await this.page.keyboard.press('Escape');
    await modal.waitFor({ state: 'hidden', timeout: 15_000 });
  }


  // --- Elementos de la card: observaciones, tooltips y tag ---
  // Markup generado por ServiceTariffControl.RenderObservations /
  // RenderPriorityAmenities (ver .ascx.cs).

  /** Cajas amarillas de observaciones destacadas (ServiceObservation.IsPriority). */
  async observacionesDestacadas(container: string): Promise<string[]> {
    return this.contenedor(container).locator('.tariff-obs-item').evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter(Boolean),
    );
  }

  /** Leyenda "Mas observaciones disponibles en el detalle". */
  async textoMasObservaciones(container: string): Promise<string | null> {
    const loc = this.contenedor(container).locator('.tariff-obs-more');
    return (await loc.count()) ? (await loc.first().innerText()).trim() : null;
  }

  /** Contenido de los tooltips de la card (duracion, idiomas, operatividad, amenities). */
  async tooltips(container: string): Promise<string[]> {
    return this.contenedor(container).locator('.tariff-op-tooltip').evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter(Boolean),
    );
  }

  /**
   * Barra de operatividad de la card, item por item con su tooltip.
   *
   * RenderOperativityIcons (ServiceTariffControl.ascx.cs:99) arma hasta tres
   * items: duracion (ph-clock), idiomas (ph-translate) con la lista completa en
   * el tooltip, y operatividad (.tariff-op-calendar) con dias y temporada. Antes
   * solo se contaba cuantos habia y se buscaba un texto suelto entre todos los
   * tooltips, sin saber cual era cual.
   */
  async barraDeOperatividad(container: string): Promise<{
    texto: string; tooltip: string; titulo: string; items: string[];
    esCalendario: boolean; meses: string;
  }[]> {
    return this.contenedor(container).locator('.tariff-op-item').evaluateAll((els) =>
      els.map((e) => {
        const tip = e.querySelector('.tariff-op-tooltip') as HTMLElement | null;
        const meses = e.querySelector('.tariff-op-months') as HTMLElement | null;
        const limpio = (x: string) => x.replace(/\s+/g, ' ').trim();
        // El texto visible es el del item menos el del tooltip, que va adentro.
        const completo = limpio((e as HTMLElement).innerText);
        const tooltip = tip ? limpio(tip.innerText) : '';

        // El tooltip viene estructurado: <strong>titulo</strong><ul><li>..</li></ul>.
        // Leerlo asi, y no como una cadena concatenada, permite compararlo exacto
        // en vez de por contencion, que es lo que dejaba pasar los agregados.
        const strong = tip ? tip.querySelector('strong') : null;
        const items = tip
          ? Array.from(tip.querySelectorAll('li')).map((li) => limpio((li as HTMLElement).innerText))
          : [];

        return {
          texto: tooltip ? limpio(completo.replace(tooltip, '')) : completo,
          tooltip,
          titulo: strong ? limpio(strong.textContent ?? '') : '',
          items,
          esCalendario: e.classList.contains('tariff-op-calendar'),
          meses: meses ? limpio(meses.innerText) : '',
        };
      }),
    );
  }

  /** Tag "RECOMENDADO" de la card de hoteles (se muestra si Hotel.Great = 1). */
  async tagRecomendado(container: string): Promise<string | null> {
    const loc = this.contenedor(container).locator('.featured-tag');
    return (await loc.count()) ? (await loc.first().innerText()).trim() : null;
  }


  /**
   * Elementos de la card, con los selectores tomados del markup de cada control:
   *   ServiceTariffControl / HotelTariffControl / NewTourTariffControl /
   *   NewOpportunityTariffControl / CruiseTariffControl (.ascx)
   *
   * "Cotizar y reservar" se verifica por presencia y NUNCA se clickea: navega
   * a ShoppingCartPage.aspx y saca al test del tarifario.
   */
  async elementosDeLaCard(container: string) {
    const c = this.contenedor(container);
    const hay = async (sel: string) => (await c.locator(sel).count()) > 0;
    const visible = async (sel: string) => {
      const loc = c.locator(sel).first();
      return (await loc.count()) > 0 && (await loc.isVisible());
    };
    return {
      imagen:           await visible('.tariff-image-view img, .tariff-image-view'),
      texto:            await visible('.tariff-detail'),
      botonTarifario:   await visible('.tariff-view-table'),
      cotizarYReservar: await hay('.tariff-quote-reserve-btn'),
      proveedores:      await hay("[onclick*='openSuppliersModal']"),
      descargaWord:     await hay("[onclick*='downloadWord']"),
      tagRecomendado:   await hay('.featured-tag'),
      observaciones:    (await c.locator('.tariff-obs-item').count()) > 0,
      iconosTooltips:   (await c.locator('.tariff-op-item').count()) > 0,
      // Copia titulo + cuerpo del detalle al portapapeles. Lo tienen los cinco
      // controles, asi que se exige en las siete pestanias. Ojo que en los
      // servicios este mismo boton dice "Copiar todo".
      copiar:           await hay('.tariff-copy-btn'),
      // Estos dos son solo de la ficha de servicios (ServiceTariffControl.ascx):
      // copiar la solapa abierta y bajar la ficha en PDF.
      copiarSolapa:     await hay('.tariff-copy-tab-btn'),
      descargaPdf:      await hay('.tariff-pdf-btn'),
    };
  }

  /** src de la imagen de la card, para verificar que no sea el placeholder. */
  async srcImagen(container: string): Promise<string | null> {
    const img = this.contenedor(container).locator('.tariff-image-view img').first();
    return (await img.count()) ? await img.getAttribute('src') : null;
  }

  /** Texto descriptivo de la card. */
  async textoDeLaCard(container: string): Promise<string> {
    const loc = this.contenedor(container).locator('.tariff-detail').first();
    return (await loc.count()) ? (await loc.innerText()).replace(/\s+/g, ' ').trim() : '';
  }


  /**
   * Captura los importes tal como se ven, con una tabla por solapa de idioma.
   *
   * Hay dos controles que muestran solapas y cada uno usa su propio prefijo:
   *   .srl-lang-tabs-{InstanceId}  ServiceTariffDetailControl.ascx  (servicios)
   *   .trl-lang-tabs-{InstanceId}  NewTourTariffDetailControl.ascx  (paquetes)
   *
   * El selector matchea los dos. Antes solo miraba "srl-" y Paquetes caia al
   * caso sin solapas: se capturaba unicamente la tabla en Español y los precios
   * de Inglés y Portugués quedaban sin validar.
   */
  async capturarTarifas(container: string): Promise<{
    porIdioma: Record<string, string[][]>; solapasIdioma: number; tarifaExtendida: number;
  }> {
    const porIdioma: Record<string, string[][]> = {};
    const solapas = this.page.locator(`${TarifarioPage.SOLAPAS_IDIOMA} > *`);
    const cantidad = await solapas.count();

    if (cantidad > 0) {
      for (let i = 0; i < cantidad; i++) {
        const nombre = (await solapas.nth(i).innerText()).trim() || `solapa-${i}`;
        await solapas.nth(i).click().catch(() => {});
        await esperarFinDeCarga(this.page);
        porIdioma[nombre] = await this.leerTablaTarifas(container);
      }
    } else {
      porIdioma['sin-solapas'] = await this.leerTablaTarifas(container);
    }

    return {
      porIdioma,
      solapasIdioma: cantidad,
      tarifaExtendida: await this.page.locator('.tariff-extended-label').count(),
    };
  }


  /** Locator de cada componente de la card, para poder resaltarlo si falla. */
  locatorDeComponente(container: string, clave: string): Locator {
    const c = this.contenedor(container);
    const mapa: Record<string, string> = {
      imagen:           '.tariff-image-view',
      texto:            '.tariff-detail',
      botonTarifario:   '.tariff-view-table',
      cotizarYReservar: '.tariff-quote-reserve-btn',
      proveedores:      "[onclick*='openSuppliersModal']",
      descargaWord:     "[onclick*='downloadWord']",
      tagRecomendado:   '.featured-tag',
      observaciones:    '.tariff-obs-item',
      iconosTooltips:   '.tariff-op-item',
      copiar:           '.tariff-copy-btn',
      copiarSolapa:     '.tariff-copy-tab-btn',
      descargaPdf:      '.tariff-pdf-btn',
    };
    return c.locator(mapa[clave] ?? '.tariff-card');
  }

  /** Contenedor de la card, como respaldo cuando el componente no existe. */
  locatorCard(container: string): Locator {
    return this.contenedor(container).locator('.tariff-card, .item1').first();
  }


  /** Vuelve a la solapa de idioma indicada, para capturar el fallo donde ocurrio. */
  async volverASolapaIdioma(nombre: string) {
    const solapas = this.page.locator(`${TarifarioPage.SOLAPAS_IDIOMA} > *`);
    const total = await solapas.count();
    for (let i = 0; i < total; i++) {
      if ((await solapas.nth(i).innerText()).trim() === nombre) {
        await solapas.nth(i).click().catch(() => {});
        await esperarFinDeCarga(this.page);
        return;
      }
    }
  }

  /** Fila n de las tablas de tarifas visibles, para resaltar la que difiere. */
  locatorFilaTarifa(container: string, indice: number): Locator {
    return this.ambitoTarifas(container).locator('table:visible tr').nth(indice);
  }

  async textoDe(container: string): Promise<string> {
    return (await this.contenedor(container).innerText()).trim();
  }
}
