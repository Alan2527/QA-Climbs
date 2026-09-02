import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Flujo de reserva de un hotel suelto, desde INICIO hasta el carrito.
 *
 *   INICIO / solapa HOTELES -> HotelWithIntegration.aspx -> hoteldetail.aspx -> carrito
 *
 * Del carrito en adelante es identico al flujo de servicio: se reusan
 * CarritoPage y BackOfficePage sin cambios.
 *
 * Referencias:
 *   Online/Module/HotelSearchControl.ascx      -> searchDestination, txtCalendar,
 *                                                 ddlHotelsResident, btnSearch
 *   Online/Module/PassengerQuantityControl.ascx -> adults / rooms / children y
 *                                                 los span.quantityModify
 *   Online/Scripts/HotelSearchControl.js        -> el autocompletado #addList y
 *                                                 la funcion search()
 *   Online/HotelWithIntegration.aspx            -> cards de resultado, verMasbtn
 */
export class HotelPage {
  constructor(private readonly page: Page) {}

  readonly campoDestino = "[id$='searchDestination']";
  readonly sugerencias = '#addList';
  readonly campoFechas = '#txtCalendar';
  readonly comboResidente = "[id$='ddlHotelsResident']";
  readonly btnViajeros = '.passenger-form-button .passengerQuantity-botton';
  readonly panelViajeros = '.PassengerQuantity';
  readonly btnBuscar = '#btnSearch';

  /**
   * Elige el hotel en el autocompletado del destino.
   *
   * El buscador acepta destinos y hoteles: `LoadDestination` devuelve unos y
   * otros, y cada sugerencia se renderiza como `<a id="{ID}">`. Se lo elige por
   * ese id y no por el texto, que ademas incluye ciudad y pais.
   *
   * Ojo con el selector: un id que empieza con digito no es un selector CSS
   * valido, asi que va por atributo (`a[id="5003"]`, no `a#5003`).
   */
  async elegirHotel(id: number, nombreEsperado: string) {
    const destino = this.page.locator(this.campoDestino);
    await destino.click();
    await destino.pressSequentially('AUTO-QA', { delay: 60 });

    const sugerencia = this.page.locator(`${this.sugerencias} a[id="${id}"]`);
    await expect(
      sugerencia,
      `El buscador tiene que ofrecer el hotel ${id} al escribir el prefijo de los datos de prueba`,
    ).toBeVisible({ timeout: 30_000 });
    await expect(sugerencia, 'La sugerencia tiene que ser el hotel esperado')
      .toContainText(nombreEsperado);
    await sugerencia.click();
  }

  /**
   * Carga habitaciones y adultos en el panel de viajeros.
   *
   * El panel se abre con el boton "..." y no con el area "Viajeros": el handler
   * del sitio escucha `.passengerQuantity-botton`. Y la senial de que abrio es
   * la clase `is-open`, porque el panel tiene tamanio aunque este cerrado.
   *
   * Los contadores estan `disabled` a proposito: se suben con los botones +.
   */
  async cargarViajeros(habitaciones: number, adultos: number) {
    await this.page.locator(this.btnViajeros).first().click();
    await expect(this.page.locator(`${this.panelViajeros}.is-open`)).toHaveCount(1);

    const sumar = (campo: string) =>
      this.page.locator(`span.quantityModify[onclick*="'${campo}'"]`).filter({ hasText: '+' }).first();

    for (let i = 0; i < habitaciones; i++) await sumar('rooms').click();
    for (let i = 0; i < adultos; i++) await sumar('adults').click();

    await expect(this.page.locator('#rooms')).toHaveValue(String(habitaciones));
    await expect(this.page.locator('#adults')).toHaveValue(String(adultos));
  }

  /**
   * Elige check-in y check-out en el calendario de rango.
   *
   * Como en el buscador de servicios, no se escribe la fecha: el widget la
   * reescribe con la suya al perder el foco. Se abre y se clickean los dos dias.
   */
  async elegirFechas(entrada: Date, salida: Date) {
    await this.page.locator(this.campoFechas).click();
    const picker = this.page.locator('.daterangepicker:visible').first();
    await expect(picker).toBeVisible();

    const dia = (d: Date) =>
      picker.locator('td.available:not(.off)').filter({ hasText: new RegExp(`^${d.getDate()}$`) }).first();

    await dia(entrada).click();
    await dia(salida).click();
  }

  /**
   * El hotel de prueba esta publicado solo para no residentes
   * (`Hotel.ForResidents = 0`), asi que la busqueda tiene que salir como tal.
   * El combo no es visible para el usuario: se exige el valor por defecto para
   * que un cambio en esa configuracion no rompa el test en silencio.
   */
  async verificarResidente(valorEsperado = 'US') {
    await expect(
      this.page.locator(this.comboResidente).first(),
      'La busqueda tiene que salir como No Residente: el hotel de prueba no esta publicado para residentes',
    ).toHaveValue(valorEsperado);
  }

  /** Presiona Buscar y espera la pantalla de resultados. */
  async buscar() {
    await this.page.locator(this.btnBuscar).first().click();
    await this.page.waitForURL(/hotelwithintegration/i, { timeout: 120_000 });
    await esperarFinDeCarga(this.page);
  }

  /** La card del hotel en el listado de resultados. */
  card(nombre: string): Locator {
    return this.page.locator('div').filter({ hasText: nombre }).last();
  }

  /** Entra a la ficha del hotel desde el listado, por el boton "Ver mas". */
  async abrirFicha(id: number) {
    const enlace = this.page.locator(`a[href*='hoteldetail.aspx'][href*='hotel=${id}']`).first();
    await expect(enlace, `El listado tiene que ofrecer el hotel ${id}`).toBeVisible({ timeout: 60_000 });
    await enlace.click();
    await this.page.waitForURL(/hoteldetail/i, { timeout: 90_000 });
    await esperarFinDeCarga(this.page);

    // Las tarifas de las habitaciones llegan por AJAX despues de cargar la
    // pagina: sin esta espera la ficha se lee sin ninguna habitacion.
    await this.page.waitForFunction(() => {
      const w = window as any;
      return typeof w.jQuery === 'undefined' || w.jQuery.active === 0;
    }, undefined, { timeout: 60_000 });
    await expect(
      this.page.locator("[onclick*='Guardar']").first(),
      'La ficha tiene que ofrecer habitaciones para las fechas elegidas',
    ).toBeVisible({ timeout: 60_000 });
  }

  /**
   * Prefijo de id de la fila de tarifa de una habitacion.
   *
   * La ficha codifica en el id todo el contexto de la tarifa:
   * `hotel-habitacion-tipoTarifa-adultos-menores-origen-`. Se lo lee del DOM en
   * vez de armarlo, porque el tipo de tarifa lo decide el sitio a partir de la
   * cantidad de adultos (2 adultos -> Doble) y no queremos fijarlo en el test.
   *
   * La clase de ese input es el numero de habitacion, y una clase que empieza
   * con digito no se puede escribir como `.9193`: va por `[class~="9193"]`.
   */
  private async prefijoDeTarifa(habitacion: number): Promise<string> {
    const campo = this.page.locator(`input[class~="${habitacion}"]`).first();
    const id = await campo.getAttribute('id');
    expect(id, `La ficha tiene que traer la habitacion ${habitacion}`).toBeTruthy();
    return id!;
  }

  /** Precio por habitacion que muestra la ficha, tal como lo ve la persona. */
  async precioDeLaHabitacion(habitacion: number): Promise<string> {
    const prefijo = await this.prefijoDeTarifa(habitacion);
    return this.page.locator(`[id="${prefijo}-TotalxPax"]`).first().inputValue();
  }

  /** El tipo de tarifa que el sitio eligio segun la cantidad de adultos. */
  async tipoDeTarifa(habitacion: number): Promise<string> {
    const prefijo = await this.prefijoDeTarifa(habitacion);
    return prefijo.split('-')[2] ?? '';
  }

  /**
   * Carga la cantidad de habitaciones y confirma.
   *
   * La cantidad no se escribe: el input esta `disabled` y se sube con el boton
   * `+`, que tiene id `{prefijo}-suma` y llama a SumarRestar. Confirmar dispara
   * `Guardar({habitacion})`, que lee la cantidad del input cuya clase es el
   * numero de habitacion.
   */
  async reservarHabitacion(habitacion: number, cantidad: number) {
    const prefijo = await this.prefijoDeTarifa(habitacion);
    const mas = this.page.locator(`[id="${prefijo}-suma"]`).first();
    for (let i = 0; i < cantidad; i++) await mas.click();

    await expect(
      this.page.locator(`[id="${prefijo}"]`).first(),
      `La ficha tiene que quedar con ${cantidad} habitacion(es) elegidas`,
    ).toHaveValue(String(cantidad));

    await this.page.locator(`input[type='button'][onclick*='Guardar(${habitacion},']`).first().click();
    await esperarFinDeCarga(this.page);
  }
}
