import { Page, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * WebAdmin (BaseCamp): extension masiva de tarifas desde el listado de hoteles
 * (`administration/hotels/default.aspx`, boton "Extender tarifas").
 *
 * El modal lista los hoteles del filtro del listado (`?word=`), y el proceso extiende
 * TODOS los que queden tildados, desde la ultima tarifa de cada habitacion hasta la
 * "Fecha Hasta". No se puede deshacer: por eso `extender` exige que la seleccion sea
 * exactamente la esperada antes de confirmar.
 */
export class WebAdminExtensionMasivaPage {
  constructor(private readonly page: Page) {}

  readonly modal = '#modalExtendRates';
  readonly filas = '#extendRatesTbody .chk-hotel-selection';
  readonly confirmacion = '#modalConfirmAction';

  /** Abre el listado filtrado por nombre y el modal, y devuelve los IDs que lista. */
  async abrir(termino: string): Promise<string[]> {
    await this.page.goto(`/administration/hotels/default.aspx?word=${encodeURIComponent(termino)}`);
    await esperarFinDeCarga(this.page);
    await this.page.locator('[id$="btnTariffExtend"]').click();
    await expect(this.page.locator(this.modal), 'Tiene que abrirse el modal Extender tarifas').toHaveClass(/show/);
    await expect(this.page.locator(this.filas).first(), 'El modal tiene que listar los hoteles del filtro').toBeAttached({ timeout: 60_000 });
    return this.page.locator(this.filas).evaluateAll((cs) => cs.map((c) => (c as HTMLInputElement).value));
  }

  /**
   * Completa el modal, tilda SOLO `hotelId`, verifica la seleccion y confirma.
   * Devuelve el mensaje final ("Se generaron N tarifas en M habitaciones").
   */
  async extender(opciones: {
    hotelId: number; fechaHasta: string; porcentaje: number; modo: 'anioAnterior' | 'masAlta' | 'ultimoCorte'; tipoHabitacion: string;
  }): Promise<{ confirmacion: string; resultado: string }> {
    const casilla = this.page.locator(`${this.filas}[value="${opciones.hotelId}"]`);
    await expect(casilla, `El modal tiene que listar el hotel ${opciones.hotelId}`).toHaveCount(1);
    await casilla.check();

    const modo = { anioAnterior: '#chkModePreviousYear', masAlta: '#chkModeHighestRate', ultimoCorte: '#chkModeLastTariffCut' }[opciones.modo];
    await this.page.locator(modo).check();
    await this.page.locator('[id$="txtExtendPercentage"]').fill(String(opciones.porcentaje));
    await this.page.locator('[id$="ctrlFromDate_txtDateTime"]').evaluate((el, v) => {
      const fp = (el as any)._flatpickr;
      if (fp) fp.setDate(v, true, 'd/m/Y');
      else (el as HTMLInputElement).value = v;
    }, opciones.fechaHasta);
    // El tipo de habitacion es un TomSelect: se elige por su API.
    await this.page.evaluate((tipo) => (window as any).tsTypes.setValue([tipo]), opciones.tipoHabitacion);

    // Guarda: solo el hotel pedido tiene que quedar tildado.
    const tildados = await this.page.locator(`${this.filas}:checked`).evaluateAll((cs) => cs.map((c) => (c as HTMLInputElement).value));
    expect(tildados, 'Solo el hotel de prueba puede quedar seleccionado').toEqual([String(opciones.hotelId)]);

    await this.page.locator('[id$="btnExtendConfirm"]').click();
    const confirmar = this.page.locator(this.confirmacion);
    await expect(confirmar, 'Tiene que pedir confirmacion antes de extender').toHaveClass(/show/);
    const textoConfirmacion = (await this.page.locator('#confirmMessage').innerText()).replace(/\s+/g, ' ').trim();
    expect(textoConfirmacion, 'La confirmacion tiene que ser por un solo hotel').toMatch(/de 1 hotel/i);
    // El hidden que viaja al servidor tiene que tener solo ese hotel.
    await expect(this.page.locator('#hfSelectedHotelIds')).toHaveValue(String(opciones.hotelId));

    await Promise.all([
      this.page.waitForLoadState('load', { timeout: 180_000 }),
      this.page.locator('#btnModalAction').click(),
    ]);
    await esperarFinDeCarga(this.page, 180_000);
    await expect(this.page.locator(this.confirmacion), 'Al terminar tiene que mostrar el resultado').toHaveClass(/show/, { timeout: 120_000 });
    const resultado = (await this.page.locator('#confirmMessage').innerText()).replace(/\s+/g, ' ').trim();
    return { confirmacion: textoConfirmacion, resultado };
  }
}
