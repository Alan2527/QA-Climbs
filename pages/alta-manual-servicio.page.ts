import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';
import { BackOfficePage } from './backoffice.page';

/**
 * Alta manual de un servicio en un file del BackOffice.
 *
 * Dos pantallas:
 *
 *   Ficha del file      -> booking/files/managefile/{file}
 *   Servicios destino   -> booking/files/destination/{file}/{destino}   (boton "Servicios" de cada destino)
 *
 * El servicio se agrega desde el modal "Busqueda de Servicios y/o Hoteles" de la pantalla
 * de destino, se guarda con "Guardar y Volver" y el item aparece en la ficha del file.
 *
 * Referencias (rama origin/qa del BO, src/BO.AMV.Travel/BO.WebApp):
 *   Files/ManageFileDestination.aspx(.cs) -> #linkAddService (:75), #edittbl (:82), .tbodydata (:104),
 *                                           #btnSaveDataAndReturn (:128), #hiddenInDate/#hiddenOutDate (:144-145),
 *                                           window.ALL_CURRENCIES (:182, hotfix d25a90c0)
 *   Modal/FileServiceControl.ascx         -> #modalFileService (:3), .bsq-modo__btn (:18-24), #txtModalSearchValue (:33),
 *                                           #txtModalInDate (:45), #ddRooming (:55), #lnkModalFilter (:81),
 *                                           #bsqResultados (:86), #tblFileService (:88)
 *   Resources/custom/scripts/file.js      -> initManageFileDestination (:937), button.btn-agregar (:1311),
 *                                           fillServiceRow (:1197), editRow (:2184), initSaveData (:1873)
 *   Api/FileWebService.cs                 -> searchservicenames (:2343), searchservices (:2393),
 *                                           priceservice (:3927-3937), checkrooming (:4082)
 *   Files/ManageFile.aspx                 -> fi-dest__services (:873), fi-row / fileitemdetail (:957),
 *                                           fi-money__amount (:939-942), updFileTotals (:1260),
 *                                           Comprobantes y saldos (:422)
 *
 * El BO tiene modo oscuro pero no selector de idioma: no aplica la consideracion de multiidioma.
 */

const baseBO = () => process.env.AMV_BO_URL || 'https://qa.bo.amv.travel';

/**
 * Numero escrito con el formato del BO (punto de miles, coma decimal) a Number.
 * Devuelve NaN si no hay ningun digito, para que una celda vacia no se lea como 0.
 */
export function numeroDelBO(texto: string): number {
  const limpio = (texto ?? '').replace(/[^\d,.-]/g, '');
  if (!/\d/.test(limpio)) return NaN;
  return Number(limpio.replace(/\./g, '').replace(',', '.'));
}

/** Separa "ARS 94.600" / "94.600ARS" en moneda y numero. */
export function importeDelBO(texto: string): { moneda: string; valor: number } {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim();
  return { moneda: limpio.match(/[A-Za-z]{3}/)?.[0]?.toUpperCase() ?? '', valor: numeroDelBO(limpio) };
}

/** El BO escribe las fechas dd/mm/aaaa; segun la cultura del servidor el separador puede salir como punto. */
export const fechaDelBO = (texto: string) => (texto ?? '').replace(/\./g, '/').trim();

/** Una fila del buscador: lo que se ve en el modal y el objeto que devolvio el servidor. */
export interface FilaDelBuscador {
  indice: number;
  celdas: string[];
  datos: DatosDelBuscador;
}

/** `FileServiceObj` tal como lo devuelve `searchservices` (Newtonsoft, nombres en PascalCase). */
export interface DatosDelBuscador {
  Name: string;
  FullDetail: string;
  FileServiceID: number;
  FileItemType: number;
  RateType: string;
  RateTypeID: number;
  RateID: number;
  CurrencyID: number;
  CurrencyCode: string;
  CostCurrency: number;
  UnitCostAmount: number;
  TotalCostAmount: number;
  Amount: number;
  TotalAmount: number;
  SupplierID: number;
  SupplierName: string;
  OperatorName: string;
  HasRates: boolean;
  Checkin: string;
  Checkout: string;
  CostAmountDetail: string;
  TotalAmountDetail: string;
  Languages?: unknown[] | null;
}

/** Un item de servicio de la ficha del file. */
export interface DatosDeItemDelFile {
  id: string;
  orden: string;
  detalle: string;
  tarifa: string;
  checkin: string;
  checkout: string;
  rooming: string;
  proveedor: string;
  costo: { moneda: string; valor: number };
  venta: { moneda: string; valor: number };
}

/** Una fila de la grilla editable de la pantalla de destino (`#edittbl`). */
export interface FilaDeLaGrilla {
  orden: string;
  detalle: string;
  tarifa: string;
  checkin: string;
  checkout: string;
  rooming: string;
  pax: string;
  costo: string;
  venta: string;
  monedaDeVenta: string;
  monedaDeCostoValor: string;
  monedaDeCostoTexto: string;
  opcionesDeMoneda: string[];
}

export interface TotalesDelFile {
  costo: { moneda: string; valor: number };
  venta: { moneda: string; valor: number };
  over: { moneda: string; valor: number };
  utilidad: { moneda: string; valor: number };
}

export interface RespuestasDelAgregado {
  checkroomingStatus: number;
  checkrooming: { HasError?: boolean; ErrorMessage?: string } | null;
  priceserviceStatus: number | null;
  priceservice: { TotalCostAmount?: number; TotalAmount?: number; Quantity?: number } | null;
  /** Metodo, URL y estado del pedido a priceservice (y lo enviado, si no respondio 200). */
  priceservicePedido?: string;
}

export class AltaManualDeServicioPage {
  constructor(private readonly page: Page) {}

  // ---------------------------------------------------------------- Ficha del file

  /** Abre la ficha del file y espera el panel "Comprobantes y saldos" (ManageFile.aspx:422). */
  async abrirFile(fileId: string) {
    await this.page.goto(`${baseBO()}/booking/files/managefile/${fileId}`,
      { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await this.esperarFicha();
  }

  /** Espera que la ficha del file termine de cargar: tambien sirve despues de un redirect. */
  async esperarFicha() {
    await esperarFinDeCarga(this.page);
    await expect(
      this.page.locator('section.bo-ficha__grupo').filter({ hasText: 'Comprobantes y saldos' }),
      'El file tiene que mostrar el panel "Comprobantes y saldos"',
    ).toBeVisible({ timeout: 60_000 });
  }

  /** Ids de los items de servicio del file (`data-fileitem` del menu de cada fila, ManageFile.aspx:957). */
  async idsDeItems(): Promise<string[]> {
    return this.page.locator('tr.fi-row a.fileitemdetail').evaluateAll((enlaces) =>
      enlaces.map((a) => (a as HTMLElement).getAttribute('data-fileitem') ?? '').filter(Boolean));
  }

  filaDeItem(id: string): Locator {
    return this.page.locator(`tr.fi-row:has(a.fileitemdetail[data-fileitem="${id}"])`);
  }

  /**
   * Lee un item: detalle, tarifa, fechas, rooming, proveedor, costo y venta.
   * Columnas de la fila (ManageFile.aspx:910-945): nombre, estado, tarifa, In, Out, noches,
   * rooming, proveedor, costo, venta. Costo y Venta traen la moneda pegada al numero.
   */
  async datosDeItem(id: string): Promise<DatosDeItemDelFile> {
    const fila = this.filaDeItem(id);
    await expect(fila, `La ficha del file tiene que listar el item ${id}`).toHaveCount(1);
    const t = await fila.evaluate((tr) => {
      const txt = (el: Element | null | undefined) =>
        ((el as HTMLElement | null | undefined)?.innerText ?? '').replace(/\s+/g, ' ').trim();
      const celdas = Array.from(tr.querySelectorAll(':scope > td'));
      return {
        orden: txt(tr.querySelector('.fi-order')),
        detalle: txt(tr.querySelector('.fi-name__txt')),
        tarifa: txt(tr.querySelector('.fi-rate')),
        checkin: txt(celdas[3]),
        checkout: txt(celdas[4]),
        rooming: txt(celdas[6]),
        proveedor: txt(tr.querySelector('.fi-supplier')),
      };
    });
    const montos = await new BackOfficePage(this.page).montosDelItemDelFile(fila);
    return {
      id,
      ...t,
      checkin: fechaDelBO(t.checkin),
      checkout: fechaDelBO(t.checkout),
      costo: importeDelBO(montos.costo),
      venta: importeDelBO(montos.venta),
    };
  }

  /** Moneda, markups y tipos de cambio del file (bloque "Moneda y markup", ManageFile.aspx:364-395). */
  async monedaYMarkupDelFile(): Promise<Record<string, string>> {
    const valor = async (selector: string) =>
      (await this.page.locator(selector).first().inputValue().catch(() => '?')).trim();
    return {
      moneda: (await this.page.locator('#ddCurrency option:checked').first().innerText().catch(() => '?')).trim(),
      markupHoteles: await valor('#txtMarkup'),
      markupServicios: await valor('#txtMarkupService'),
      tipoDeCambio: await valor('#txtExchange'),
      tipoDeCambioDeCostos: await valor('#txtCostExchange'),
    };
  }

  /**
   * Tarjetas de totales del file (Costo, Venta, Over, Utilidad). Se dejan afuera las tarjetas
   * de porcentaje (`bo-tot__card--pct`), que repiten los rotulos Utilidad y Over (ManageFile.aspx:1272-1335).
   */
  async totalesDelFile(): Promise<TotalesDelFile> {
    const tarjetas = await this.page.locator('#updFileTotals .bo-tot__card:not(.bo-tot__card--pct)').evaluateAll((cards) =>
      cards.map((c) => ({
        rotulo: ((c.querySelector('.bo-tot__rotulo') as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim().toUpperCase(),
        valor: ((c.querySelector('.bo-tot__valor') as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      })));
    const de = (rotulo: string) => {
      const t = tarjetas.find((x) => x.rotulo === rotulo);
      return importeDelBO(t?.valor ?? '');
    };
    return { costo: de('COSTO'), venta: de('VENTA'), over: de('OVER'), utilidad: de('UTILIDAD') };
  }

  /** Un lado del panel "Comprobantes y saldos" (ManageFile.aspx:426 y :506). */
  lado(id: 'boCompCliente' | 'boCompProveedores'): Locator {
    return this.page.locator(`section.bo-comp__lado[aria-labelledby="${id}"]`);
  }

  /** Las cifras de un lado: "Venta del file"/"Costo del file", "Facturado", "Cobrado"/"Pagado", "Falta ...". */
  async cifrasDelPanel(id: 'boCompCliente' | 'boCompProveedores'): Promise<Record<string, string>> {
    const salida: Record<string, string> = {};
    for (const cifra of await this.lado(id).locator('.bo-comp__cifra').all()) {
      const dt = (await cifra.locator('dt').innerText()).trim();
      salida[dt] = (await cifra.locator('dd').innerText()).replace(/\s+/g, ' ').trim();
    }
    return salida;
  }

  /** Cantidad de servicios y totales que muestra la cabecera de la tarjeta del primer destino (ManageFile.aspx:865 y fi-card__totals). */
  async cabeceraDelDestino(): Promise<{ servicios: number; costo: { moneda: string; valor: number }; venta: { moneda: string; valor: number } }> {
    const tarjeta = this.page.locator('.fi-card').first();
    const textoServicios = (await tarjeta.locator('.fi-card__datos .fi-num').filter({ hasText: 'servicios' }).first().innerText()
      .catch(() => '')).replace(/\s+/g, ' ');
    const items = await tarjeta.locator('.fi-card__totals .fi-tot__item').evaluateAll((els) =>
      els.map((e) => ({
        rotulo: ((e.querySelector('.fi-tot__label') as HTMLElement | null)?.innerText ?? '').trim().toUpperCase(),
        valor: ((e.querySelector('.fi-tot__value') as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      })));
    const de = (rotulo: string) => importeDelBO(items.find((x) => x.rotulo === rotulo)?.valor ?? '');
    return {
      servicios: Number(textoServicios.match(/(\d+)\s*servicios/i)?.[1] ?? NaN),
      costo: de('COSTO'),
      venta: de('VENTA'),
    };
  }

  /** Entra a "Servicios" del primer destino del file: devuelve la URL a la que fue. */
  async abrirServiciosDelDestino(): Promise<string> {
    const enlace = this.page.locator('a.fi-dest__services').first();
    await expect(enlace, 'La ficha del file tiene que ofrecer el boton "Servicios" del destino').toBeVisible({ timeout: 60_000 });
    const href = (await enlace.getAttribute('href')) ?? '';
    expect(href, 'El boton "Servicios" tiene que llevar a booking/files/destination/{file}/{destino}')
      .toMatch(/booking\/files\/destination\/\d+\/\d+/i);
    const url = new URL(href, baseBO()).toString();
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await esperarFinDeCarga(this.page);
    return url;
  }

  // ---------------------------------------------------------------- Pantalla de destino

  /** El overlay de carga del BO (`#pageloadcnt`) se traga los clics mientras esta visible. */
  async sinCarga() {
    await this.page.locator('#pageloadcnt').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});
  }

  readonly filasDeLaGrilla = '#edittbl tbody tr:has(input.costrate)';

  /** Espera que la grilla termine de cargar los servicios del destino y deje habilitado Guardar. */
  async esperarGrilla(cantidad: number) {
    await expect(
      this.page.locator(this.filasDeLaGrilla),
      `La grilla del destino tiene que cargar ${cantidad} servicio(s)`,
    ).toHaveCount(cantidad, { timeout: 90_000 });
    await expect(this.page.locator('#btnSaveDataAndReturn'), 'Guardar y Volver tiene que quedar habilitado al cargar la grilla')
      .toBeEnabled({ timeout: 90_000 });
    await this.sinCarga();
  }

  /**
   * Los avisos (noty) del BO se van solos a los pocos segundos: se envuelven `notyError` y
   * `notySuccess` para guardar lo que muestran. No cambia lo que ve la persona.
   */
  async vigilarAvisos() {
    await this.page.evaluate(() => {
      const w = window as any;
      if (w.__avisosQA) return;
      w.__avisosQA = [];
      for (const nombre of ['notyError', 'notySuccess']) {
        const original = w[nombre];
        if (typeof original !== 'function') continue;
        w[nombre] = (mensaje: unknown) => {
          w.__avisosQA.push(`${nombre === 'notyError' ? 'ERROR' : 'OK'}: ${mensaje}`);
          return original(mensaje);
        };
      }
    });
  }

  async avisos(): Promise<string[]> {
    return this.page.evaluate(() => ((window as any).__avisosQA ?? []) as string[]);
  }

  /** Monedas que la pantalla inyecta desde BO_Currency (`window.ALL_CURRENCIES`, hotfix d25a90c0). */
  async monedasInyectadas(): Promise<{ value: number; name: string }[] | null> {
    return this.page.evaluate(() => {
      const lista = (window as any).ALL_CURRENCIES;
      return Array.isArray(lista) ? lista as { value: number; name: string }[] : null;
    });
  }

  /** Abre el modal de busqueda (`Agregar Servicio`) y espera que quede listo para usar. */
  async abrirBuscador() {
    await this.sinCarga();
    await this.page.locator('#linkAddService').click();
    await expect(this.page.locator('#modalFileService'), 'El boton Agregar Servicio tiene que abrir el buscador')
      .toBeVisible({ timeout: 30_000 });
    // Las fechas y el combo de nombres se arman en `shown.bs.modal`, cuando termina la animacion.
    await expect(this.page.locator('#txtModalInDate'), 'El buscador tiene que cargar la fecha Desde del destino')
      .not.toHaveValue('', { timeout: 30_000 });
    await this.page.waitForFunction(
      () => !!(document.getElementById('txtModalSearchValue') as any)?.tomselect,
      undefined, { timeout: 30_000 },
    );
  }

  /**
   * "Traer costo de servicios" (#chkManual): sin la marca el buscador no cotiza (solo lista los servicios sin tarifa).
   * El BO la marca solo en los files que no son de grupos (file.js:1477); si viene sin marcar se marca como lo haria
   * una persona. Devuelve si ya venia marcada.
   */
  async traerCostoDeServicios(): Promise<boolean> {
    const marca = this.page.locator('#chkManual');
    const venia = await marca.isChecked();
    if (!venia) {
      await this.page.locator('#modalFileService label.bsq-tag').click();
      await expect(marca, 'Traer costo de servicios tiene que quedar marcado').toBeChecked();
    }
    return venia;
  }

  async fechasDelBuscador(): Promise<{ desde: string; hasta: string; destinoDesde: string; destinoHasta: string }> {
    return {
      desde: fechaDelBO(await this.page.locator('#txtModalInDate').inputValue()),
      hasta: fechaDelBO(await this.page.locator('#txtModalOutDate').inputValue()),
      destinoDesde: fechaDelBO(await this.page.locator('#hiddenInDate').inputValue()),
      destinoHasta: fechaDelBO(await this.page.locator('#hiddenOutDate').inputValue()),
    };
  }

  /** Rooming del servicio ("1-2"): sin el, el item nuevo no se puede guardar y la busqueda cotiza para 1 pasajero. */
  async fijarRooming(rooming: string) {
    await this.page.locator('#ddRooming').fill(rooming);
  }

  /** Limita la busqueda a servicios (boton "Servicios" del selector Buscar). */
  async buscarSoloServicios() {
    const nombres = this.page.waitForResponse(
      (r) => r.url().includes('/searchservicenames/') && /servicehotel=20/.test(r.url()),
      { timeout: 30_000 },
    ).catch(() => null);
    await this.page.locator('.bsq-modo__btn[data-modo="20"]').click();
    await expect(this.page.locator('#ddServiceHotel')).toHaveValue('20');
    await nombres;
  }

  /** El nombre es un TomSelect (bo-select.js): se abre, se escribe y se elige la opcion. */
  async elegirNombre(nombre: string, patron: RegExp) {
    const entrada = this.page.locator('#modalFileService .bsq-f--nombre .ts-control input');
    await entrada.click();
    await entrada.pressSequentially(nombre, { delay: 30 });
    const opcion = this.page.locator('.ts-dropdown .option').filter({ visible: true, hasText: patron }).first();
    await expect(opcion, `El buscador tiene que ofrecer un servicio que se llame "${nombre}" en este destino`)
      .toBeVisible({ timeout: 30_000 });
    await opcion.click();
    await expect(this.page.locator('#txtModalSearchValue')).not.toHaveValue('');
  }

  /** Presiona Buscar y devuelve las filas del resultado, con el objeto que mando el servidor. */
  async buscar(): Promise<FilaDelBuscador[]> {
    const respuesta = this.page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/searchservices(\?|$)/.test(r.url()),
      { timeout: 120_000 },
    );
    await this.page.locator('#lnkModalFilter').click();
    const r = await respuesta;
    expect(r.status(), 'La busqueda de servicios (searchservices) tiene que responder 200').toBe(200);
    await expect(this.page.locator('#bsqResultados'), 'Buscar tiene que mostrar la grilla de resultados').toBeVisible();
    await expect.poll(async () =>
      (await this.page.locator('#tblFileService tbody tr').count()), { timeout: 30_000 }).toBeGreaterThan(0);
    return this.filasDelBuscador();
  }

  async filasDelBuscador(): Promise<FilaDelBuscador[]> {
    const filas = await this.page.evaluate(() => {
      const $ = (window as any).jQuery;
      const api = $('#tblFileService').DataTable();
      return $('#tblFileService tbody tr').toArray().map((tr: HTMLElement, indice: number) => ({
        indice,
        celdas: Array.from(tr.querySelectorAll('td')).map((td) =>
          ((td as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim()),
        datos: api.row(tr).data() ?? null,
      }));
    });
    return (filas as { indice: number; celdas: string[]; datos: DatosDelBuscador | null }[])
      .filter((f) => f.datos) as FilaDelBuscador[];
  }

  /** Presiona Agregar en una fila del buscador y espera lo que el BO consulta al agregar: checkrooming y priceservice. */
  async agregar(fila: FilaDelBuscador): Promise<RespuestasDelAgregado> {
    const checkrooming = this.page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/checkrooming(\?|$)/.test(r.url()), { timeout: 60_000 });
    const priceservice = this.page.waitForResponse(
      (r) => /\/priceservice(\?|$)/.test(r.url()), { timeout: 30_000 }).catch(() => null);

    await this.page.locator('#tblFileService tbody tr').nth(fila.indice).locator('button.btn-agregar').click();

    const rc = await checkrooming;
    const cuerpoCheck = await rc.json().catch(() => null);
    const salida: RespuestasDelAgregado = {
      checkroomingStatus: rc.status(),
      checkrooming: cuerpoCheck,
      priceserviceStatus: null,
      priceservice: null,
    };
    if (cuerpoCheck?.HasError) return salida;

    const rp = await priceservice;
    if (rp) {
      salida.priceserviceStatus = rp.status();
      salida.priceservice = await rp.json().catch(() => null);
      salida.priceservicePedido = `${rp.request().method()} ${rp.url()} -> ${rp.status()}` +
        (rp.ok() ? '' : ` | cuerpo enviado: ${(rp.request().postData() ?? '').slice(0, 600)} | respuesta: ${(await rp.text().catch(() => '')).slice(0, 400)}`);
    }
    await esperarFinDeCarga(this.page);
    await this.sinCarga();
    return salida;
  }

  /** Cierra el modal: con el alta de un servicio nuevo el BO lo deja abierto para seguir agregando. */
  async cerrarBuscador() {
    await this.page.locator('#modalFileService .modal-footer button[data-dismiss="modal"]').click();
    await expect(this.page.locator('#modalFileService')).toBeHidden({ timeout: 30_000 });
    await this.page.locator('.modal-backdrop').waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});
  }

  /** Fila de la grilla editable por posicion (-1 = la ultima). */
  filaDeLaGrilla(posicion: number): Locator {
    const filas = this.page.locator(this.filasDeLaGrilla);
    return posicion < 0 ? filas.last() : filas.nth(posicion);
  }

  async leerFila(fila: Locator): Promise<FilaDeLaGrilla> {
    return fila.evaluate((tr) => {
      const valor = (s: string) => (tr.querySelector(s) as HTMLInputElement | null)?.value ?? '';
      const texto = (s: string) =>
        ((tr.querySelector(s) as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim();
      const sel = tr.querySelector('select.cost-currency') as HTMLSelectElement | null;
      return {
        orden: valor('input.displayorder'),
        detalle: valor('input.detail'),
        tarifa: texto('span.ratetype'),
        checkin: valor('input.inptin'),
        checkout: valor('input.inptout'),
        rooming: valor('input.rooming'),
        pax: texto('span.quantity'),
        costo: valor('input.costrate'),
        venta: valor('input.amountrate') || valor('input.total'),
        monedaDeVenta: texto('.bo-money-field__fixed'),
        monedaDeCostoValor: sel?.value ?? '',
        monedaDeCostoTexto: sel?.selectedOptions[0]?.textContent?.trim() ?? '',
        opcionesDeMoneda: sel ? Array.from(sel.options).map((o) => `${o.value}=${(o.textContent ?? '').trim()}`) : [],
      };
    });
  }

  /**
   * Guarda y vuelve a la ficha del file. Si el BO no vuelve, se corta con el aviso que mostro:
   * `SaveData` (ManageFileDestination.aspx.cs:232) atrapa sus excepciones y redirige igual,
   * asi que un guardado fallido tambien llega a la ficha, solo que sin el item.
   */
  async guardarYVolver() {
    await this.sinCarga();
    // Los errores que ya habia (por ejemplo de la carga de la grilla) no cuentan: solo los nuevos.
    const erroresPrevios = (await this.avisos()).filter((a) => a.startsWith('ERROR')).length;
    await this.page.locator('#btnSaveDataAndReturn').click();
    const resultado = await Promise.race([
      this.page.waitForURL(/\/booking\/files\/managefile\/\d+/i, { timeout: 120_000 }).then(() => 'file' as const),
      this.page.waitForFunction(
        (previos) => (((window as any).__avisosQA ?? []) as string[]).filter((a) => a.startsWith('ERROR')).length > previos,
        erroresPrevios, { timeout: 120_000 },
      ).then(() => 'aviso' as const),
    ]).catch(() => 'nada' as const);

    if (resultado === 'aviso') {
      throw new Error(`El BO no dejo guardar: ${(await this.avisos()).filter((a) => a.startsWith('ERROR')).join(' | ')}`);
    }
    if (resultado === 'nada') {
      throw new Error('Guardar y Volver no llevo a la ficha del file ni mostro ningun aviso');
    }
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page);
  }
}
