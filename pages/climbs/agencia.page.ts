import { Page, Locator, expect } from '@playwright/test';
import { importe } from './habitacion.page';

/** Pie de una ficha del Backoffice nuevo: "Guardar" y el estado "Al dia". */
async function guardarFicha(page: Page, ficha: Locator) {
  const pie = ficha.getByRole('contentinfo').last();
  const boton = pie.getByRole('button', { name: 'Guardar', exact: true });
  await expect(boton, 'Tiene que haber cambios para guardar').toBeEnabled();
  await boton.click();
  const error = page.locator('.toast.bad .toast-text');
  await expect(boton.and(page.locator('[disabled]')).or(error).first(), 'Al guardar, el pie tiene que quedar "Al dia"').toBeVisible({ timeout: 90_000 });
  if (await error.isVisible()) throw new Error(`Guardar fue rechazado: ${(await error.allInnerTexts()).join(' | ')}`);
  await expect(pie.getByRole('button', { name: /^Guardar/ }).first(), 'Guardado, el boton Guardar del pie queda deshabilitado (antes el pie decia "Al dia")').toBeDisabled({ timeout: 30_000 });
}

/**
 * Markup por sucursal (desde noviembre, US 5107): una fila por sucursal con dos solapas
 * ("Por defecto" o "Según mercado" / "Manual"). En Manual, los textboxes "{Sucursal} Hoteles" y
 * "{Sucursal} Servicios"; si no, la celda muestra el numero que hereda ("0,80 de ...").
 * La suite trabaja con la sucursal Argentina, la de la agencia y el usuario de regresion; el test
 * de markup por sucursal usa ademas Perú (cubre Bolivia y Perú).
 */
const SUCURSAL = 'Argentina';

async function leerMarkupDeSucursal(ficha: Locator, sucursal = SUCURSAL): Promise<{ manual: boolean; hotel: number | null; servicio: number | null }> {
  const solapas = ficha.getByRole('tablist', { name: `Markup ${sucursal}` });
  await expect(solapas, `Tiene que estar la fila de markup de ${sucursal}`).toBeVisible({ timeout: 60_000 });
  const manual = (await solapas.getByRole('tab', { name: 'Manual', exact: true }).getAttribute('aria-selected')) === 'true';
  if (manual) {
    return {
      manual,
      hotel: importe(await ficha.getByRole('textbox', { name: `${sucursal} Hoteles` }).inputValue()),
      servicio: importe(await ficha.getByRole('textbox', { name: `${sucursal} Servicios` }).inputValue()),
    };
  }
  // El filtro `has` se resuelve dentro de la fila: va un locator desde la pagina, no desde la ficha.
  const fila = ficha.getByRole('row').filter({ has: ficha.page().getByRole('tablist', { name: `Markup ${sucursal}` }) });
  const celdas = await fila.getByRole('cell').allInnerTexts();
  return { manual, hotel: importe(celdas[2]?.trim().split(/\s+/)[0] ?? ''), servicio: importe(celdas[3]?.trim().split(/\s+/)[0] ?? '') };
}

/** En Manual, un tipo vacio (null) sigue al mercado. */
async function fijarMarkupManual(ficha: Locator, hotel: number | null, servicio: number | null, sucursal = SUCURSAL) {
  const solapas = ficha.getByRole('tablist', { name: `Markup ${sucursal}` });
  await solapas.getByRole('tab', { name: 'Manual', exact: true }).click();
  const txt = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
  await ficha.getByRole('textbox', { name: `${sucursal} Hoteles` }).fill(txt(hotel));
  await ficha.getByRole('textbox', { name: `${sucursal} Servicios` }).fill(txt(servicio));
  await ficha.getByRole('textbox', { name: `${sucursal} Servicios` }).press('Tab');
}

/** Un interruptor (Switch) se activa con un clic sobre su rotulo: la pista dibujada tapa la casilla. */
async function interruptor(casilla: Locator, si: boolean) {
  if ((await casilla.isChecked()) !== si) await casilla.locator('xpath=..').click();
  await expect(casilla).toBeChecked({ checked: si });
}

/**
 * Ficha del mercado en el Backoffice nuevo (Finanzas › Mercados, /finance/markets/{id}): reemplaza
 * a Markets/Detail del WebAdmin. "Markup hoteles" y "Markup servicios" son campos numericos.
 */
export class MercadoNuevoPage {
  constructor(private readonly page: Page) {}

  get ficha(): Locator { return this.page.getByRole('dialog').filter({ hasText: /Mercado #?\d+/ }).first(); }

  async abrir(id: number) {
    await this.page.goto(`/finance/markets/${id}`);
    await expect(this.ficha.getByRole('tablist', { name: `Markup ${SUCURSAL}` }), `La ficha del mercado ${id} tiene que abrir`).toBeVisible({ timeout: 60_000 });
    await expect(this.ficha.getByRole('textbox', { name: 'Nombre', exact: true })).not.toHaveValue('', { timeout: 30_000 });
  }

  /** El markup del mercado en la sucursal Argentina (el que rige para la agencia de regresion). */
  async markups(): Promise<{ hotel: number; servicio: number }> {
    const m = await leerMarkupDeSucursal(this.ficha);
    return { hotel: m.hotel ?? NaN, servicio: m.servicio ?? NaN };
  }

  async guardarMarkups(id: number, hotel: number, servicio: number) {
    await this.abrir(id);
    const actual = await this.markups();
    if (actual.hotel === hotel && actual.servicio === servicio) return;
    await fijarMarkupManual(this.ficha, hotel, servicio);
    await guardarFicha(this.page, this.ficha);
    await this.abrir(id);
    expect(await this.markups(), `El mercado ${id} tiene que quedar en ${hotel} / ${servicio}`).toEqual({ hotel, servicio });
  }

  /** La fila de una sucursal: si esta en Manual y el markup que rige (el propio o el que hereda). */
  async markupDeLaSucursal(sucursal: string): Promise<{ manual: boolean; hotel: number | null; servicio: number | null }> {
    return leerMarkupDeSucursal(this.ficha, sucursal);
  }

  /** Lleva la fila de una sucursal a Manual con esos valores, o de vuelta a "Por defecto". */
  async guardarMarkupDeLaSucursal(id: number, sucursal: string, valor: { hotel: number | null; servicio: number | null } | 'Por defecto') {
    await this.abrir(id);
    const actual = await this.markupDeLaSucursal(sucursal);
    if (valor === 'Por defecto') {
      if (!actual.manual) return;
      await this.ficha.getByRole('tablist', { name: `Markup ${sucursal}` }).getByRole('tab', { name: 'Por defecto', exact: true }).click();
    } else {
      if (actual.manual && actual.hotel === valor.hotel && actual.servicio === valor.servicio) return;
      await fijarMarkupManual(this.ficha, valor.hotel, valor.servicio, sucursal);
    }
    await guardarFicha(this.page, this.ficha);
    await this.abrir(id);
    const quedo = await this.markupDeLaSucursal(sucursal);
    if (valor === 'Por defecto') expect(quedo.manual, `${sucursal} tiene que quedar en "Por defecto" en el mercado ${id}`).toBe(false);
    else expect(quedo, `${sucursal} tiene que quedar en Manual ${valor.hotel} / ${valor.servicio} en el mercado ${id}`).toEqual({ manual: true, ...valor });
  }
}

/**
 * Ficha de la agencia en el Backoffice nuevo (Clientes › Agencias, /clients/agencies/{id}):
 * reemplaza a Agencies/Detail del WebAdmin. Solapas Datos / Usuarios / Configuracion de productos /
 * App del pasajero. En Datos: "Markup hoteles" y "Markup servicios" (vacio sigue al mercado) y,
 * en Comercial, "Usa su propia cotizacion" con "Cotizacion general".
 */
export class AgenciaNuevaPage {
  constructor(private readonly page: Page) {}

  // La cabecera ya no dice "N.º 6334" sino "#6334" con su boton de copiar.
  get ficha(): Locator { return this.page.getByRole('dialog').filter({ has: this.page.getByRole('button', { name: /^Copiar #\d+/ }) }).first(); }

  async abrir(id: number, solapa = 'Datos') {
    await this.page.goto(`/clients/agencies/${id}`);
    await expect(this.ficha.getByRole('tab', { name: 'Datos' }), `La ficha de la agencia ${id} tiene que abrir`).toBeVisible({ timeout: 60_000 });
    await expect(this.ficha.getByRole('textbox', { name: 'Nombre', exact: true })).not.toHaveValue('', { timeout: 30_000 });
    if (solapa !== 'Datos') await this.solapa(solapa);
  }

  async solapa(nombre: string) {
    const tab = this.ficha.getByRole('tab', { name: new RegExp(`^${nombre}`) });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async guardar() { await guardarFicha(this.page, this.ficha); }

  /**
   * Los markups propios de la agencia en la sucursal Argentina (solapa Markup); null = "Según
   * mercado" (sigue al mercado), que es lo que antes era dejar los campos vacios.
   */
  async markups(): Promise<{ hotel: number | null; servicio: number | null }> {
    if ((await this.ficha.getByRole('tab', { name: 'Markup', exact: true }).getAttribute('aria-selected')) !== 'true') await this.solapa('Markup');
    const m = await leerMarkupDeSucursal(this.ficha);
    return m.manual ? { hotel: m.hotel, servicio: m.servicio } : { hotel: null, servicio: null };
  }

  async guardarMarkups(id: number, hotel: number | null, servicio: number | null) {
    await this.abrir(id, 'Markup');
    const actual = await this.markups();
    if (actual.hotel === hotel && actual.servicio === servicio) return;
    // Solo si los dos siguen al mercado la fila pasa a "Segun mercado"; si no, Manual con el vacio.
    if (hotel === null && servicio === null) {
      await this.ficha.getByRole('tablist', { name: `Markup ${SUCURSAL}` }).getByRole('tab', { name: 'Según mercado', exact: true }).click();
    } else {
      await fijarMarkupManual(this.ficha, hotel, servicio);
    }
    await this.guardar();
    await this.abrir(id, 'Markup');
    expect(await this.markups(), `La agencia ${id} tiene que quedar con markup propio ${hotel} / ${servicio}`).toEqual({ hotel, servicio });
  }

  // --- Configuracion de productos (Config. de productos del WebAdmin) ---------------------

  /** Las configuraciones de la solapa, como texto por fila (Ciudad, Tipo de producto, Producto, Markup). */
  async configuracionesDeProductos(producto?: string): Promise<string[][]> {
    await this.solapa('Configuración de productos');
    const tabla = this.ficha.getByRole('table').first();
    await expect(tabla.or(this.ficha.getByText('La agencia usa el markup de su mercado en todo.')).first()).toBeVisible({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    const filas = await tabla.locator('tbody tr').evaluateAll((trs) => trs.map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').replace(/\s+/g, ' ').trim())));
    return filas.filter((f) => f.some((c) => c) && (!producto || f.some((c) => c.includes(producto))));
  }

  /** "Agregar configuracion": tipo, pais, ciudad y producto (por nombre); excluido o con markup. */
  async agregarConfiguracion(c: { tipo: string; pais: string; ciudad: string; producto: string; excluido: boolean; markup?: number }) {
    await this.solapa('Configuración de productos');
    await this.ficha.getByRole('button', { name: 'Agregar configuración' }).click();
    const panel = this.page.getByRole('dialog', { name: 'Agregar configuración' });
    await expect(panel).toBeVisible();
    await panel.locator('#ps-type').selectOption({ label: c.tipo });
    await panel.locator('#ps-country').selectOption({ label: c.pais });
    const elegir = async (id: string, termino: string, nombre: string) => {
      const combo = panel.locator(`#${id}`);
      await expect(combo).toBeEnabled({ timeout: 30_000 });
      await combo.click();
      await combo.fill(termino);
      await this.page.getByRole('option', { name: nombre, exact: true }).first().click();
    };
    await elegir('ps-city', c.ciudad, c.ciudad);
    await elegir('ps-product', c.producto.replace(/^AUTO-QA NO TOCAR - /, ''), c.producto);
    await interruptor(panel.locator('#ps-exclude'), c.excluido);
    if (!c.excluido && c.markup !== undefined) await panel.locator('#ps-markup').fill(String(c.markup).replace('.', ','));
    await panel.getByRole('button', { name: 'Agregar configuración' }).click();
    await expect(panel, 'La configuracion tiene que agregarse').toBeHidden({ timeout: 30_000 });
    await expect(this.page.locator('.toast .toast-text').filter({ hasText: /agregada/ }).last()).toBeVisible();
  }

  /** Borra (con su confirmacion) las configuraciones del producto; devuelve cuantas borro. */
  async borrarConfiguraciones(producto: string): Promise<number> {
    await this.configuracionesDeProductos();
    const filas = this.ficha.getByRole('table').first().locator('tbody tr').filter({ hasText: producto });
    const n = await filas.count();
    if (!n) return 0;
    for (let i = 0; i < n; i++) await filas.nth(i).getByRole('checkbox').check();
    await this.ficha.getByRole('button', { name: `Borrar ${n} seleccionada(s)` }).click();
    const confirmacion = this.page.getByRole('alertdialog');
    await confirmacion.getByRole('button', { name: `Borrar ${n} seleccionada(s)` }).click();
    await expect(this.page.locator('.toast .toast-text').filter({ hasText: 'Configuración borrada.' }).last()).toBeVisible();
    await expect.poll(async () => (await this.configuracionesDeProductos(producto)).length).toBe(0);
    return n;
  }

  /** "Usa su propia cotizacion" y la cotizacion que rige: la propia o la del pais ("Sin cotizacion propia usa ... : N"). */
  async tipoDeCambio(): Promise<{ manual: boolean; valor: number | null; texto: string }> {
    // La cotizacion vive en la solapa Datos: si la ficha quedo en otra (Markup), se vuelve.
    if ((await this.ficha.getByRole('tab', { name: 'Datos', exact: true }).getAttribute('aria-selected')) !== 'true') await this.solapa('Datos');
    const casilla = this.ficha.getByRole('checkbox', { name: 'Usa su propia cotización' });
    const manual = await casilla.isChecked();
    if (manual) {
      const valor = importe(await this.ficha.locator('#ag-exchange-general').inputValue());
      return { manual, valor, texto: `propia ${valor}` };
    }
    const texto = (await this.ficha.getByText(/^Sin cotización propia usa/).innerText()).trim();
    return { manual, valor: importe(texto.split(':').pop() ?? ''), texto };
  }

  async guardarTipoDeCambio(id: number, manual: boolean, valor?: number) {
    await this.abrir(id);
    const casilla = this.ficha.getByRole('checkbox', { name: 'Usa su propia cotización' });
    const antes = await this.tipoDeCambio();
    await interruptor(casilla, manual);
    if (manual && valor !== undefined) await this.ficha.locator('#ag-exchange-general').fill(String(valor).replace('.', ','));
    // Con un cambio, "Guardar" se habilita un instante despues del clic: leerlo enseguida daba
    // deshabilitado y la ficha no se guardaba (24/11/2026). Se espera a que se habilite.
    const cambio = antes.manual !== manual || (manual && valor !== undefined && antes.valor !== valor);
    const boton = this.ficha.getByRole('contentinfo').last().getByRole('button', { name: 'Guardar', exact: true });
    if (cambio) {
      await expect(boton, 'Guardar tiene que habilitarse al cambiar la cotizacion').toBeEnabled();
      await this.guardar();
    }
    await this.abrir(id);
    const leido = await this.tipoDeCambio();
    expect(leido.manual, `La agencia ${id} tiene que quedar ${manual ? 'con' : 'sin'} cotizacion propia`).toBe(manual);
    if (manual && valor !== undefined) expect(leido.valor, `La cotizacion propia tiene que quedar en ${valor}`).toBe(valor);
  }
}
