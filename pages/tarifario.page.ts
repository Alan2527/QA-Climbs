import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

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
    return this.ambitoTarifas(container).locator('table:visible tr').evaluateAll((trs) =>
      trs
        .map((tr) =>
          Array.from(tr.querySelectorAll('th,td'))
            .map((c) => (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
            .filter(Boolean),
        )
        .filter((f) => f.length),
    );
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

  /** Abre una solapa de la ficha y devuelve su texto. */
  async contenidoDeSolapa(clave: string): Promise<string> {
    const solapa = this.page.locator(`${this.fichaSolapas}[data-tab="${clave}"]`);
    if (await solapa.count()) await solapa.click();
    const panel = this.page.locator(`${this.fichaPanel}[data-tab="${clave}"]`);
    return (await panel.innerText()).replace(/\s+/g, ' ').trim();
  }

  /** Listas de "Incluye" y "No incluye" de la solapa de amenities. */
  async amenitiesDeLaFicha(): Promise<{ incluye: string[]; noIncluye: string[] }> {
    await this.contenidoDeSolapa('amenities');
    const leer = async (clase: string) =>
      this.page.locator(`.${clase} li`).evaluateAll((els) =>
        els.map((e) => (e as HTMLElement).innerText.split(String.fromCharCode(10))[0].trim()).filter(Boolean),
      );
    return {
      incluye: await leer('svc-amenity-included'),
      noIncluye: await leer('svc-amenity-excluded'),
    };
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
    const boton = this.contenedor(container)
      .locator("a:has-text('Ver detalle'), a:has-text('Ver Detalle')").first();
    await expect(boton).toBeVisible({ timeout: 30_000 });

    const onclick = (await boton.getAttribute('onclick')) ?? '';
    const id = onclick.match(/#(modal-[A-Za-z0-9-]+)/)?.[1];
    if (!id) throw new Error(`El boton "Ver detalle" no apunta a ningun modal: ${onclick}`);

    await boton.click();
    const modal = this.page.locator(`#${id}`);
    await expect(modal).toBeVisible({ timeout: 30_000 });
    return modal;
  }

  /** Cierra el modal de detalle abierto. */
  async cerrarModalDetalle(modal: Locator) {
    await this.page.keyboard.press('Escape');
    await modal.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
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

  async textoDe(container: string): Promise<string> {
    return (await this.contenedor(container).innerText()).trim();
  }
}
