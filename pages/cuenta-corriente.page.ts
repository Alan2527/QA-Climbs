import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Cuenta corriente del cliente y del proveedor, y agenda de pendientes del cliente.
 *
 *   administration/accounting/{fiscal}/customer/{id}   Customers/AccountingDetail.aspx
 *   administration/accounting/supplier/{id}            Suppliers/AccountingDetail.aspx
 *   administration/accounting/summary                  Customers/Summary.aspx  (solapa Pendientes)
 *
 * Las rutas salen de `Global.asax.cs:244-253`. El `{fiscal}` de la cuenta del cliente
 * no lo lee la pantalla (solo usa `id`); el propio BO arma los links con `inv`
 * (`ReportingWebService.cs:4227`).
 *
 * Las dos cuentas son listas de MUCHOS movimientos de todas las corridas, asi que esta
 * clase no lee totales para comparar contra la cadena: ubica la fila del comprobante
 * por su numero y lee las celdas de esa fila.
 *
 * Cuenta del cliente (`tblAccountingDetail`, 14 columnas):
 *   0 casilla, 1 Comprobante, 2 File, 3 Pax / Detalle, 4 Fecha, 5 Debe, 6 Haber,
 *   7 Saldo, 8 In, 9 TC, 10 Estado, 11 Vencimiento, 12 Resp. Cliente, 13 acciones
 * Cuenta del proveedor (`tblAccountingDetail`, 15 columnas):
 *   0 Comprobante, 1 Fecha, 2 Total factura, 3 Retenciones, 4 Pagable, 5 Debe,
 *   6 Haber, 7 Saldo, 8 Pendiente, 9 TC, 10 Recibo, 11 Vencimiento,
 *   12 Fecha Contable, 13 Fecha de Creacion, 14 acciones
 * Agenda (`tblCustomerAgenda`, 12 columnas):
 *   0 IN del file, 1 Vencimiento cronograma, 2 Cliente, 3 File, 4 Gestion,
 *   5 Venta total, 6 Total facturado, 7 Total cobrado, 8 Falta facturar,
 *   9 Falta cobrar, 10 Ultima observacion, 11 Acciones
 *
 * El BO no tiene selector de idioma: no aplica multiidioma. Tiene modo oscuro, pero
 * este page object no lo ejercita.
 */

/** Una fila de la agenda tal como la devuelve `customer-accounting-agenda`. */
export interface FilaDeAgenda {
  TargetType: number;
  Task: string;
  FileID: number;
  File: string;
  Customer: string;
  FileSaleTotal: number | null;
  FileInvoicedTotal: number | null;
  FileCollectedTotal: number | null;
  FilePendingInvoice: number | null;
  FilePendingCollection: number | null;
  FileTotalsCurrency: string | null;
  Items?: { DueDate?: string | null; Reference?: string }[] | null;
}

export class CuentaCorrientePage {
  constructor(private readonly page: Page) {}

  private baseBO(): string {
    return process.env.AMV_BO_URL || 'https://qa.bo.amv.travel';
  }

  // --- Filtros comunes a las dos cuentas (ClientIDMode Static en las dos pantallas) ---
  readonly comboMoneda = '#ddCurrency';
  readonly comboMovimientos = '#ddAccountingDetailType';
  readonly campoDesde = '#txtDateFrom';
  readonly campoHasta = '#txtDateTo';
  readonly grilla = '#tblAccountingDetail';
  readonly totales = '#tblAccountingTotal';

  // --- Agenda de pendientes (Summary.aspx) ---
  readonly agendaSolapa = '#customerAgendaTab';
  readonly agendaPanel = '#customerAgendaContent';
  readonly agendaResponsable = '#agendaResponsible';
  readonly agendaBuscador = '#agendaCustomer';
  readonly agendaBuscar = '#agendaFilter';
  readonly agendaGrilla = '#tblCustomerAgenda';
  readonly agendaError = '#agendaError';

  /**
   * Corre una accion que dispara un postback y espera a que termine.
   *
   * Los filtros de las cuentas son AutoPostBack dentro de un UpdatePanel y
   * `esperarFinDeCarga` no los ve (ver ESTADO.md, "lo que solo se supo ejecutando"):
   * justo despues del clic todavia no empezo el postback y devuelve de inmediato.
   * Se marca la ventana antes y se espera a una de dos cosas: que la marca
   * desaparezca (postback completo, la pagina se recargo) o que el
   * PageRequestManager avise el fin de un postback parcial.
   */
  private async conPostback(accion: () => Promise<unknown>) {
    await this.page.evaluate(() => {
      const w = window as any;
      w.__marcaCuenta = true;
      w.__postbacksCuenta = 0;
      if (!w.__hookCuenta && w.Sys?.WebForms?.PageRequestManager) {
        w.Sys.WebForms.PageRequestManager.getInstance().add_endRequest(() => { w.__postbacksCuenta++; });
        w.__hookCuenta = true;
      }
    });
    await accion();
    await this.page.waitForFunction(() => {
      const w = window as any;
      return !w.__marcaCuenta || w.__postbacksCuenta >= 1;
    }, undefined, { timeout: 240_000 });
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page, 240_000);
    // Los scripts de la pantalla (secciones de la grilla, titulo de Movimientos) se
    // reinyectan 80 ms despues del fin del postback.
    await this.page.waitForTimeout(500);
  }

  /** Texto de la opcion elegida en un combo. */
  async opcionElegida(selector: string): Promise<string> {
    return this.page.locator(selector).evaluate((el) => {
      const combo = el as HTMLSelectElement;
      return (combo.options[combo.selectedIndex]?.text ?? '').trim();
    });
  }

  /** Titulo de la pantalla: nombre y razon social de quien es la cuenta. */
  async titulo(): Promise<string> {
    return (await this.page.locator('.page-title').first().innerText()).replace(/\s+/g, ' ').trim();
  }

  /**
   * Elige la moneda de la cuenta. Si ya esta elegida no se vuelve a elegir: el
   * navegador no dispara `change` al reelegir la misma opcion y `selectOption` si
   * (ver el falso hallazgo de la orden de pago en ESTADO.md).
   */
  async elegirMoneda(codigo: string) {
    if ((await this.opcionElegida(this.comboMoneda)).toUpperCase() === codigo.toUpperCase()) return;
    await this.conPostback(() => this.page.locator(this.comboMoneda).selectOption({ label: codigo }));
    expect(
      (await this.opcionElegida(this.comboMoneda)).toUpperCase(),
      `La cuenta tiene que quedar en la moneda ${codigo}`,
    ).toBe(codigo.toUpperCase());
  }

  /** Espera a que la grilla tenga al menos una fila de movimiento; devuelve cuantas hay. */
  async esperarMovimientos(filas: Locator): Promise<number> {
    try {
      await expect.poll(() => filas.count(), { timeout: 60_000 }).toBeGreaterThan(0);
    } catch {
      /* una cuenta sin movimientos en el filtro es un resultado, no un error del page object */
    }
    return filas.count();
  }

  /** Fila de la grilla cuya celda `columna` (1 = primera) coincide por completo con `texto`. */
  private filaPorCelda(columna: number, texto: RegExp): Locator {
    return this.page.locator(`${this.grilla} tbody tr`)
      .filter({ has: this.page.locator(`td:nth-child(${columna})`, { hasText: texto }) });
  }

  /** Celdas de una fila, normalizadas. */
  async celdas(fila: Locator): Promise<string[]> {
    return (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
  }

  /**
   * Celdas de todas las filas de una vez. Una cuenta puede tener cientos de filas y
   * leerlas de a una (un viaje al navegador por fila) tarda minutos.
   */
  async matrizDeFilas(filas: Locator): Promise<string[][]> {
    return filas.evaluateAll((trs) => trs.map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => ((td as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim())));
  }

  // ----------------------------------------------------------------------------
  // Cuenta corriente del cliente
  // ----------------------------------------------------------------------------

  /**
   * Abre la cuenta del cliente en la vista Todos, con vencimiento desde `desde`.
   *
   * `?type=20&dateFrom=` es el acceso que el propio BO usa desde otras pantallas
   * (`AccountingDetail.aspx.cs:73-77`). La vista Todos es la unica que muestra a la
   * vez la carta, ya saldada, y las ordenes de cobro aplicadas a ella; y fuerza el
   * filtro por Fecha de Vencimiento (`ApplyPartialMode`), asi que el filtro de fechas
   * es sobre el vencimiento de la carta.
   */
  async abrirCuentaDelCliente(clienteId: string, desde: string) {
    await this.page.goto(
      `${this.baseBO()}/administration/accounting/inv/customer/${clienteId}` +
      `?type=20&dateFrom=${encodeURIComponent(desde)}`,
    );
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page, 240_000);
    await expect(this.page.locator(this.comboMovimientos), 'La cuenta del cliente tiene que abrir con su filtro de movimientos')
      .toBeVisible({ timeout: 60_000 });
    await expect(this.page.locator(this.comboMovimientos), 'La cuenta tiene que abrir en la vista Todos')
      .toHaveValue('20');
    await expect(this.page.locator(this.campoDesde), 'La cuenta tiene que tomar la fecha desde del acceso')
      .toHaveValue(desde);
  }

  /** Filas de movimiento de la cuenta del cliente (sin los titulos de seccion). */
  filasDeLaCuentaDelCliente(): Locator {
    return this.page.locator(`${this.grilla} tbody tr`).filter({ has: this.page.locator('input.cbx-acc') });
  }

  /** Fila de la cuenta del cliente por su comprobante (como lo muestra la grilla, sin ceros). */
  filaDelClientePorComprobante(comprobante: string): Locator {
    return this.filaPorCelda(2, new RegExp(`^\\s*${escaparRegex(comprobante)}\\s*$`));
  }

  /** Los siete totales de la cuenta del cliente: Debe, Haber, Saldo y los cuatro vencimientos. */
  async totalesDelCliente(): Promise<string[]> {
    return (await this.page.locator(`${this.totales} tbody tr td`).allInnerTexts())
      .map((c) => c.replace(/\s+/g, ' ').trim());
  }

  // ----------------------------------------------------------------------------
  // Cuenta corriente del proveedor
  // ----------------------------------------------------------------------------

  /** Abre la cuenta del proveedor (vista Parcial: solo lo pendiente de pago). */
  async abrirCuentaDelProveedor(proveedorId: string) {
    await this.page.goto(`${this.baseBO()}/administration/accounting/supplier/${proveedorId}`);
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page, 240_000);
    await expect(this.page.locator(this.comboMovimientos), 'La cuenta del proveedor tiene que abrir con su filtro de vista')
      .toBeVisible({ timeout: 60_000 });
  }

  /**
   * Pasa a la vista Completa, que incluye lo ya pagado. Al elegirla la pantalla
   * completa sola las fechas: desde hoy menos 30 dias hasta hoy, por Fecha de Documento
   * (`AccountingDetail.aspx.cs:216-225`).
   */
  async elegirVistaCompleta() {
    await this.conPostback(() => this.page.locator(this.comboMovimientos).selectOption({ label: 'Completa' }));
    expect(await this.opcionElegida(this.comboMovimientos), 'La cuenta tiene que quedar en la vista Completa')
      .toBe('Completa');
  }

  /** Filas de movimiento de la cuenta del proveedor (las de datos tienen las 15 columnas). */
  filasDeLaCuentaDelProveedor(): Locator {
    return this.page.locator(`${this.grilla} tbody tr`).filter({ has: this.page.locator('td:nth-child(15)') });
  }

  /** Fila de la cuenta del proveedor cuyo comprobante contiene `numero`. */
  filaDelProveedorPorNumero(numero: string): Locator {
    return this.filaPorCelda(1, new RegExp(escaparRegex(numero)));
  }

  /** Fila de la cuenta del proveedor cuyo comprobante es exactamente `codigo` (orden de pago). */
  filaDelProveedorPorCodigo(codigo: string): Locator {
    return this.filaPorCelda(1, new RegExp(`^\\s*${escaparRegex(codigo)}\\s*$`));
  }

  /** Los siete totales de la cuenta del proveedor. */
  async totalesDelProveedor(): Promise<string[]> {
    return this.totalesDelCliente();
  }

  // ----------------------------------------------------------------------------
  // Agenda de pendientes del cliente (US 4839 / 4894)
  // ----------------------------------------------------------------------------

  /**
   * Busca en la agenda de pendientes con "Todos" los responsables y devuelve las filas.
   *
   * La agenda arranca filtrada por el responsable de cobro que es el usuario logueado,
   * asi que un file de la corrida no figura hasta elegir "Todos". La busqueda es sobre
   * "Cliente, File o comprobante": por el numero del file se encuentra aunque el codigo
   * lleve el prefijo de la sucursal. La respuesta se lee de la red y no de la grilla,
   * para tener los importes sin el formato de pantalla.
   */
  async buscarEnLaAgenda(texto: string): Promise<{ filas: FilaDeAgenda[]; recordsFiltered: number }> {
    await this.page.goto(`${this.baseBO()}/administration/accounting/summary`);
    await this.page.waitForLoadState('domcontentloaded');
    await esperarFinDeCarga(this.page, 120_000);
    await this.page.locator(this.agendaSolapa).click();
    await expect(this.page.locator(this.agendaPanel), 'La solapa Pendientes tiene que abrir la agenda')
      .toBeVisible({ timeout: 30_000 });

    await this.page.locator(this.agendaResponsable).selectOption('0');
    await this.page.locator(this.agendaBuscador).fill(texto);

    const [respuesta] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes('customer-accounting-agenda') && r.request().method() === 'POST',
        { timeout: 240_000 },
      ),
      this.page.locator(this.agendaBuscar).click(),
    ]);
    expect(
      respuesta.status(),
      `La agenda tiene que responder la busqueda. Dijo: "${(await this.page.locator(this.agendaError).innerText()).trim()}"`,
    ).toBe(200);
    const cuerpo = await respuesta.json();

    // La grilla se dibuja despues de la respuesta: se espera a que deje de decir que
    // falta buscar y a que se vuelva a habilitar el boton.
    await expect.poll(
      async () => (await this.page.locator(`${this.agendaGrilla} tbody`).innerText()).replace(/\s+/g, ' '),
      { timeout: 60_000, message: 'La agenda tiene que dibujar el resultado de la busqueda' },
    ).not.toMatch(/Presion[aá] Buscar/);
    await expect(this.page.locator(this.agendaBuscar)).toBeEnabled({ timeout: 60_000 });

    return { filas: (cuerpo.data ?? []) as FilaDeAgenda[], recordsFiltered: Number(cuerpo.recordsFiltered ?? 0) };
  }

  /** Filas de la agenda que enlazan al file indicado (la celda File lleva un link a su pantalla). */
  filasDeLaAgendaDelFile(fileId: string): Locator {
    return this.page.locator(`${this.agendaGrilla} tbody tr`)
      .filter({ has: this.page.locator(`a[href$="/managefile/${fileId}"]`) });
  }
}

/** Escapa un texto para usarlo dentro de una expresion regular. */
export function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
