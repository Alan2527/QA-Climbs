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
  async verTarifario(container: string) {
    // Cruceros no tiene boton: la tabla de cabinas ya viene desplegada en la card.
    const boton = this.contenedor(container).locator("a[onclick*='load']").first();
    if (await boton.count()) {
      await boton.click();
      await esperarFinDeCarga(this.page);
    }
    // Se espera por cantidad de filas y no por visibilidad: en las tablas con
    // SGL/DBL/TPL la primera fila es un encabezado de altura cero y toBeVisible falla.
    await expect
      .poll(async () => this.contenedor(container).locator('table tr').count(),
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
    return this.contenedor(container).locator('table tr').evaluateAll((trs) =>
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

  async textoDe(container: string): Promise<string> {
    return (await this.contenedor(container).innerText()).trim();
  }
}
