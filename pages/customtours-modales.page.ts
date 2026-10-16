import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga, numeroDelPortal } from '../utils/pasos';

/**
 * Modales "Agregar servicio" y "Agregar hotel" del itinerario del multidestino
 * (customtours/detail.aspx), mas las filas que dejan en cada destino.
 *
 * Es un complemento de `CustomToursPage` (armado, itinerario y totales): aca vive
 * solo lo que hace falta para sumar un servicio o un hotel y leer su precio.
 *
 * Referencias (rama qa de WEB, src/AMV.Travel/Web/Online/CustomTours):
 *   Module/AddServiceControl.ascx -> #modalAddService, .as-card, .as-rate, .as-paging
 *   Module/AddHotelControl.ascx   -> #modalAddHotel, .ah-card, .ah-room, .ah-rate-amount
 *   Detail.aspx                   -> .ct-dest, lnkAddService / lnkAddHotel, .ct-row
 *   custom/customtours.js         -> saveServices() y saveHotels() (POST a customtourws)
 *
 * Los precios que muestran los dos modales y las filas salen de `ToMoney()`, que es
 * "N0" (sin decimales) y "-" cuando el importe es cero: por eso los numeros que se
 * leen aca son enteros y `null` quiere decir "sin tarifa".
 */

export type TarjetaDeServicio = {
  id: string;
  nombre: string;
  /** Precio de la pastilla Regular (Compartido) que muestra la tarjeta; null si no se ofrece. */
  regular: number | null;
  /** Precio de la pastilla Privado; null si no se ofrece. */
  privado: number | null;
  /** Texto del aviso de cierre (`.svc-notes__item--closed`) o null si la tarjeta no lo trae. */
  avisoDeCierre: string | null;
};

export type HabitacionDeHotel = {
  nombre: string;
  /** Importe de la primera columna de tarifa (con 1 DBL es la doble); null si "-". */
  importe: number | null;
  texto: string;
};

export class ModalesCustomToursPage {
  constructor(private readonly page: Page) {}

  readonly modalServicio = '#modalAddService';
  readonly modalHotel = '#modalAddHotel';
  readonly avisoDeVariacion = '#modalAlertChangePrice';

  // ---------------------------------------------------------------- espera

  /**
   * Espera a que se asienten los postbacks, pero sin cortar el test si no se asientan.
   *
   * `esperarFinDeCarga` exige `jQuery.active === 0`. En la cotizacion del multidestino
   * suele haber un AJAX abierto de forma permanente (medido por Alan al probar la
   * US 4856): si pasa, la espera vence y el test seguiria colgado sobre algo que no es un
   * defecto. Se acota y se sigue; lo que importa lo verifican los `expect` de cada paso.
   */
  async esperarCalma(ms = 20_000) {
    await esperarFinDeCarga(this.page, ms).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  // --------------------------------------------------------------- destino

  destino(indice = 0): Locator {
    return this.page.locator('.ct-dest').nth(indice);
  }

  /** IDs de CT_Service de los servicios del destino (el hidden de cada fila, no las opcionales). */
  async idsDeServicios(indice = 0): Promise<string[]> {
    return this.destino(indice).locator(".ct-list--services input[id$='hiddenService']")
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  }

  /** IDs de CT_Service de los hoteles del destino. */
  async idsDeHoteles(indice = 0): Promise<string[]> {
    return this.destino(indice).locator(".ct-list--hotels input[id$='hiddenRoom']")
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  }

  filaDeServicio(id: string, indice = 0): Locator {
    return this.destino(indice).locator('.ct-list--services .ct-row')
      .filter({ has: this.page.locator(`input[id$='hiddenService'][value='${id}']`) });
  }

  /** El hidden `hiddenRoom` va ANTES de la fila (hermano), no adentro: Detail.aspx:225-226. */
  filaDeHotel(id: string, indice = 0): Locator {
    return this.destino(indice)
      .locator(`.ct-list--hotels input[id$='hiddenRoom'][value='${id}']`)
      .locator('xpath=following-sibling::div[1]');
  }

  /** Ultimo importe de la fila de un servicio (si hubo variacion, el viejo viene tachado antes). */
  async precioDeServicio(fila: Locator): Promise<{ texto: string; valor: number | null }> {
    const texto = (await fila.locator('.ct-row__total').first().innerText()).replace(/\s+/g, ' ').trim();
    const importes = texto.match(/[A-Z]{3}\s*[\d.,]+/g) ?? [];
    return { texto, valor: numeroDelPortal(importes.at(-1) ?? '') };
  }

  /** Importe de la ultima linea vigente (no tachada) de la fila de un hotel. */
  async precioDeHotel(fila: Locator): Promise<{ texto: string; valor: number | null; variacion: boolean }> {
    const vigentes = fila.locator('.ct-rate__line:not(.ct-rate__line--old) .ct-rate__amount');
    const textos = (await vigentes.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    const variacion = (await fila.locator('.ct-rate__line--old').count()) > 0;
    return { texto: textos.join(' | '), valor: numeroDelPortal(textos.at(-1) ?? ''), variacion };
  }

  /**
   * Si el itinerario recalculo un precio al dibujarse, abre "Importante: hay variaciones de
   * precio" (`ShowAlertChangePrice`, Detail.aspx.cs:2302). Se lo cierra para que no tape el
   * resto; devuelve el texto o null si no habia.
   */
  async cerrarAvisoDeVariacion(): Promise<string | null> {
    const aviso = this.page.locator(`${this.avisoDeVariacion}.in`);
    if (!(await aviso.isVisible().catch(() => false))) return null;
    const texto = (await aviso.innerText()).replace(/\s+/g, ' ').trim();
    await aviso.locator('.ctam__btn').click();
    await expect(aviso).toBeHidden();
    return texto;
  }

  // -------------------------------------------------------- modal servicio

  modal(): Locator {
    return this.page.locator(this.modalServicio);
  }

  async abrirModalDeServicios(indice = 0) {
    await this.destino(indice).locator("[id$='lnkAddService']").first().click();
    await expect(this.modal(), 'Tiene que abrirse el modal Agregar servicio').toBeVisible({ timeout: 60_000 });
    await expect(this.modal().locator('.as-card, .as-empty').first()).toBeVisible({ timeout: 60_000 });
    // El modal necesita unos segundos antes de estar estable (medido por Alan en la US 4856).
    await this.page.waitForTimeout(2_000);
  }

  async cerrarModalDeServicios() {
    await this.modal().locator('.as-close').click();
    await expect(this.modal()).toBeHidden();
  }

  /** Rango de fechas del destino y formato del selector, tal como los deja el servidor. */
  async rangoDelModal(): Promise<{ desde: Date; hasta: Date; formato: string }> {
    const leer = (id: string) => this.page.locator(`#${id}`).evaluate((e) => (e as HTMLInputElement).value);
    const formato = (await leer('hiddenAddServiceDateFormat')) || 'dd/mm/yyyy';
    const aFecha = (texto: string) => {
      const [a, b, anio] = texto.split('/').map(Number);
      return formato === 'mm/dd/yyyy' ? new Date(anio, a - 1, b) : new Date(anio, b - 1, a);
    };
    return {
      desde: aFecha(await leer('hiddenAddServiceDateFrom')),
      hasta: aFecha(await leer('hiddenAddServiceDateTo')),
      formato,
    };
  }

  private textoDeFecha(fecha: Date, formato: string): string {
    const dd = String(fecha.getDate()).padStart(2, '0');
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    return formato === 'mm/dd/yyyy' ? `${mm}/${dd}/${fecha.getFullYear()}` : `${dd}/${mm}/${fecha.getFullYear()}`;
  }

  /**
   * Marca el listado actual para reconocer despues que el UpdatePanel lo redibujo
   * (reemplaza el nodo): sin esto se lee el listado viejo antes de que llegue el nuevo.
   */
  private async marcarListado(modal: Locator, contenedor: string) {
    await modal.locator(contenedor).first().evaluate((el) => el.setAttribute('data-vieja', '1'));
  }

  private async esperarListadoNuevo(modal: Locator, contenedor: string) {
    await expect(modal.locator(`${contenedor}[data-vieja]`), 'El modal tiene que redibujar el listado')
      .toHaveCount(0, { timeout: 90_000 });
    await expect(modal.locator('.as-card, .as-empty').first()).toBeVisible({ timeout: 30_000 });
    await this.page.waitForTimeout(800);
  }

  /** Carga fecha y termino y aprieta Buscar (postback de `btnSearchService_Click`). */
  async buscarServicio(opciones: { termino?: string; fecha?: Date }) {
    const modal = this.modal();
    if (opciones.fecha) {
      // El campo es readonly y el calendario es el bootstrap-datepicker viejo de eyecon
      // (customtours.js:1102-1132, sin `setDate`). El modal lee el campo recien al presionar
      // Buscar, asi que se carga la fecha con el formato del propio modal y se cierra el calendario.
      const f = opciones.fecha;
      const { formato } = await this.rangoDelModal();
      const texto = this.textoDeFecha(f, formato);
      await modal.locator('.img-dpicker-add-service').click();
      await this.page.evaluate((v) => {
        const $ = (window as any).jQuery;
        const input = $('#txtServiceDate');
        input.val(v);
        try { input.datepicker('setValue', v); } catch { /* sin API: alcanza con el valor */ }
        try { input.datepicker('hide'); } catch { /* ya cerrado */ }
      }, texto);
      await expect(modal.locator('#txtServiceDate'), 'El calendario tiene que dejar la fecha elegida')
        .toHaveValue(this.textoDeFecha(f, formato), { timeout: 15_000 });
    }
    await modal.locator("[id$='txtSearchService']").fill(opciones.termino ?? '');
    await this.marcarListado(modal, '.as-scroll');
    await modal.locator("[id$='btnSearchService']").click();
    await this.esperarListadoNuevo(modal, '.as-scroll');
  }

  /** Numeros de pagina que ofrece el paginado (los links `.page-number` con solo digitos). */
  async paginasDelModal(): Promise<number[]> {
    const textos = await this.modal().locator('a.page-number').allInnerTexts();
    return textos.map((t) => t.trim()).filter((t) => /^\d+$/.test(t)).map(Number);
  }

  async irAPaginaDelModal(numero: number) {
    const modal = this.modal();
    const enlace = modal.locator('a.page-number:not(.is-current)')
      .filter({ hasText: new RegExp(`^\\s*${numero}\\s*$`) }).first();
    await expect(enlace, `El paginado tiene que ofrecer la pagina ${numero}`).toBeVisible();
    await this.marcarListado(modal, '.as-scroll');
    await enlace.click();
    await this.esperarListadoNuevo(modal, '.as-scroll');
  }

  /** Lo que muestran hoy las tarjetas del modal, por id de servicio. */
  async tarjetas(): Promise<Record<string, TarjetaDeServicio>> {
    const crudas = await this.modal().locator('.as-card').evaluateAll((cards) => cards.map((c) => ({
      id: c.getAttribute('data-service-id') ?? '',
      nombre: (c.querySelector('.as-card__name')?.textContent ?? '').trim(),
      regular: c.querySelector('.service-regular-price .price-value')?.textContent ?? null,
      privado: c.querySelector('.service-private-price .price-value')?.textContent ?? null,
      cierre: Array.from(c.querySelectorAll('.svc-notes__item--closed'))
        .map((n) => (n.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' '),
    })));
    const salida: Record<string, TarjetaDeServicio> = {};
    for (const c of crudas) {
      salida[c.id] = {
        id: c.id,
        nombre: c.nombre,
        regular: c.regular === null ? null : numeroDelPortal(c.regular),
        privado: c.privado === null ? null : numeroDelPortal(c.privado),
        avisoDeCierre: c.cierre || null,
      };
    }
    return salida;
  }

  tarjetaDeServicio(id: string): Locator {
    return this.modal().locator(`.as-card[data-service-id='${id}']`);
  }

  /** La pastilla (label) de una modalidad: el checkbox esta oculto detras de `.as-rate__box`. */
  pastillaDeServicio(id: string, modalidad: 'regular' | 'privado'): Locator {
    const clase = modalidad === 'regular' ? '.service-regular-price' : '.service-private-price';
    return this.tarjetaDeServicio(id).locator('label.as-rate').filter({ has: this.page.locator(clase) });
  }

  /** Tilda la modalidad y exige que quede tildada (el JS arma `hiddenCheckedServices`). */
  async elegirServicio(id: string, modalidad: 'regular' | 'privado') {
    const pastilla = this.pastillaDeServicio(id, modalidad);
    await expect(pastilla, `La tarjeta del servicio ${id} tiene que ofrecer la modalidad ${modalidad}`).toBeVisible();
    await pastilla.click();
    await expect(pastilla.locator('input.service-data-tour'), 'La modalidad tiene que quedar tildada').toBeChecked();
  }

  /** "Agregar (N)": el rotulo lo escribe `updateAddButtonLabel` con la cantidad tildada. */
  rotuloDelBotonAgregarServicio(): Locator {
    return this.page.locator('#lnkAddServiceModal');
  }

  async confirmarServicios() {
    await this.rotuloDelBotonAgregarServicio().click();
    await expect(this.modal()).toBeHidden({ timeout: 30_000 });
  }

  // ----------------------------------------------------------- modal hotel

  modalDeHotel(): Locator {
    return this.page.locator(this.modalHotel);
  }

  /** El modal no abre hasta que el proveedor de integracion contesta la disponibilidad: timeout largo. */
  async abrirModalDeHoteles(indice = 0) {
    await this.destino(indice).locator("[id$='lnkAddHotel']").first().click();
    await expect(this.modalDeHotel(), 'Tiene que abrirse el modal Agregar hotel').toBeVisible({ timeout: 180_000 });
    await expect(this.modalDeHotel().locator('.ah-card, .ah-empty').first()).toBeVisible({ timeout: 120_000 });
    await this.page.waitForTimeout(2_000);
  }

  async cerrarModalDeHoteles() {
    await this.modalDeHotel().locator('.ah-close').click();
    await expect(this.modalDeHotel()).toBeHidden();
  }

  async buscarHotel(termino: string) {
    const modal = this.modalDeHotel();
    await modal.locator("[id$='txtSearch']").fill(termino);
    await this.marcarListado(modal, '.ah-scroll');
    await modal.locator("[id$='btnSearch']").click();
    await expect(modal.locator('.ah-scroll[data-vieja]'), 'El modal tiene que redibujar el listado de hoteles')
      .toHaveCount(0, { timeout: 180_000 });
    await expect(modal.locator('.ah-card, .ah-empty').first()).toBeVisible({ timeout: 60_000 });
    await this.page.waitForTimeout(800);
  }

  tarjetaDeHotel(texto: string): Locator {
    return this.modalDeHotel().locator('.ah-card').filter({ hasText: texto }).first();
  }

  /** Abre el panel de habitaciones de la tarjeta si esta cerrado (`toggleHotelRooms` alterna). */
  /**
   * La tarjeta se abre y se cierra con la clase `is-open` (toggleHotelRooms, customtours.js):
   * se mira la clase y no la visibilidad del panel, que durante la animacion de cierre
   * todavia figura visible y hace que un segundo clic la vuelva a plegar.
   */
  async expandirHotel(tarjeta: Locator) {
    if (!/\bis-open\b/.test((await tarjeta.getAttribute('class')) ?? '')) {
      await tarjeta.locator('.ah-card__head').click();
    }
    await expect(tarjeta, 'La tarjeta del hotel tiene que quedar abierta').toHaveClass(/\bis-open\b/);
    await expect(tarjeta.locator('.ah-card__panel'), 'La tarjeta del hotel tiene que mostrar sus habitaciones').toBeVisible();
  }

  /** Primera habitacion disponible (si no hay, la primera "a requerir"). */
  habitacionDeHotel(tarjeta: Locator): Locator {
    const disponible = tarjeta.locator('label.ah-room:not(.ah-room--request)');
    return disponible.or(tarjeta.locator('label.ah-room--request')).first();
  }

  async leerHabitacion(habitacion: Locator): Promise<HabitacionDeHotel> {
    const nombre = ((await habitacion.locator('.ah-room__name').first().innerText()) ?? '').trim();
    const texto = ((await habitacion.locator('.ah-rate-amount').first().innerText()) ?? '').replace(/\s+/g, ' ').trim();
    return { nombre, texto, importe: texto === '-' ? null : numeroDelPortal(texto) };
  }

  async elegirHabitacion(habitacion: Locator) {
    // Si la tarjeta se plego entre la lectura y el clic, se vuelve a abrir.
    await this.expandirHotel(habitacion.locator('xpath=ancestor::article[contains(@class,"ah-card")]'));
    await habitacion.locator('.ah-room__name').first().click();
    await expect(habitacion.locator('input.service-data-hotel'), 'La habitacion tiene que quedar tildada').toBeChecked();
  }

  async confirmarHoteles() {
    await this.page.locator('#lnkAddHotelModal').click();
    await expect(this.modalDeHotel()).toBeHidden({ timeout: 30_000 });
  }
}
