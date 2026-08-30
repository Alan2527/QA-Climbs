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

  async textoDe(container: string): Promise<string> {
    return (await this.contenedor(container).innerText()).trim();
  }
}
