import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Pantalla de INICIO del portal: es la unica puerta de entrada a los cuatro
 * flujos de reserva. El buscador tiene una solapa por flujo y cada una manda a
 * una pantalla distinta.
 *
 *   SERVICIOS    -> serviceall.aspx                (ServiceSearchControl.ascx.cs:199)
 *   HOTELES      -> HotelWithIntegration.aspx      (Scripts/HotelSearchControl.js:140)
 *   OFERTAS      -> customtours/main.aspx?tour=N   (OpportunitySearchControl.ascx.cs:198)
 *   MULTIDESTINO -> customtours/main.aspx?tour=N   (TourSearchControl.ascx.cs:208)
 *
 * En OFERTAS y MULTIDESTINO el combo del item decide: con "Todos" se va al
 * listado, eligiendo uno se va derecho a la pantalla de armado.
 *
 * Referencias: Online/Module/SearchControl.ascx y los cuatro *SearchControl.ascx
 */
export class InicioPage {
  constructor(private readonly page: Page) {}

  static readonly SOLAPAS = {
    multidestino: '#tabTours',
    hoteles: '#tabHotels',
    servicios: '#tabServices',
    ofertas: '#tabOpportunity',
  } as const;

  async abrir() {
    await this.page.goto('/online/');
    await esperarFinDeCarga(this.page);
  }

  /**
   * Abre una solapa del buscador y espera a que su panel quede visible.
   *
   * El panel importa: los cuatro controles comparten sufijos de id (btnSearch,
   * ddCountry) y sin acotar por el panel se termina operando el control de otra
   * solapa, que esta oculto. Paso por eso con el boton Buscar, que resolvia al
   * de Multidestino.
   */
  async abrirSolapa(nombre: keyof typeof InicioPage.SOLAPAS): Promise<Locator> {
    const panel = InicioPage.SOLAPAS[nombre];
    await this.page.locator(`a[href='${panel}']`).first().click();
    const contenedor = this.page.locator(panel);
    await expect(contenedor).toBeVisible();
    return contenedor;
  }
}
