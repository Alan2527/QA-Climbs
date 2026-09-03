import { Page, Locator, expect } from '@playwright/test';

/**
 * BackOffice (qa.bo.amv.travel): la reserva emitida en el portal cae en la
 * bandeja de Reservas y desde ahi se abre su detalle.
 *
 *   Login.aspx -> /main -> menu Reservas -> booking/files/inbox/10
 *              -> lapiz de la fila -> booking/files/inbox-detail/{id}/10/0
 *
 * Referencias:
 *   BO.WebApp/Login.aspx        -> txtUser, txtPassword, btnLogin
 *   BO.WebApp/BOMaster.Master   -> el item de menu booking/files/inbox/10
 *   BO.WebApp/Files/Inbox.aspx  -> ddAgency, ddSearchType, ddIssuedReserves,
 *                                  txtDateFrom, txtDateTo, btnFilter, #tblInbox
 *   BO.WebApp/Files/InboxDetail.aspx -> lvPassenger, txtPaxName, txtQuantity,
 *                                  txtCustomerReference, txtComment, #tblInboxDetail
 *
 * El BO no tiene selector de idioma ni tema oscuro: no aplican las
 * consideraciones transversales de multiidioma ni modo oscuro.
 */
export class BackOfficePage {
  constructor(private readonly page: Page) {}

  private get base() { return process.env.AMV_BO_URL || 'https://qa.bo.amv.travel'; }

  // --- Bandeja ---
  readonly comboAgencia = '#ddAgency';
  readonly comboTipo = '#ddSearchType';
  readonly comboEmitidas = '#ddIssuedReserves';
  readonly desde = '#txtDateFrom';
  readonly hasta = '#txtDateTo';
  readonly btnBuscar = "[id$='btnFilter']";
  readonly grilla = '#tblInbox tbody tr';

  // --- Detalle ---
  readonly grillaPasajeros = "[id$='lvPassenger'] tbody tr, table tbody tr";
  readonly grillaItems = '#tblInboxDetail tbody tr';

  async ingresar(usuario: string, password: string) {
    await this.page.goto(this.base + '/Login.aspx');
    await this.page.locator('#txtUser').fill(usuario);
    await this.page.locator('#txtPassword').fill(password);
    await this.page.locator('#btnLogin').click();
    await this.page.waitForURL((u) => !u.pathname.toLowerCase().includes('login'), { timeout: 90_000 });
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Entra a la bandeja por el menu lateral: primero el padre "Reservas", que
   * abre el submenu, y despues el item. El item existe en el DOM desde el
   * principio pero esta colapsado, asi que un clic directo no navega.
   */
  async irABandejaDeReservas() {
    const enlace = "a[href*='booking/files/inbox/10']";
    await this.page.locator(`li:has(${enlace}) > a`).first().click();
    const item = this.page.locator(enlace).first();
    await expect(item).toBeVisible();
    await item.click();
    await this.page.waitForURL(/inbox/i, { timeout: 60_000 });
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Aplica el filtro de la bandeja. Sin argumentos deja los valores por defecto. */
  async filtrar(opciones: { agencia?: string; emitidas?: 'SI' | 'NO' } = {}) {
    if (opciones.agencia) await this.page.locator(this.comboAgencia).selectOption({ label: opciones.agencia });
    if (opciones.emitidas) await this.page.locator(this.comboEmitidas).selectOption({ label: opciones.emitidas });
    await this.page.locator(this.btnBuscar).first().click();
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.page.locator(this.grilla).first()).toBeVisible({ timeout: 60_000 });
  }

  /** La fila de la bandeja que corresponde al codigo BOxxxxxxxx. */
  fila(codigo: string): Locator {
    return this.page.locator(this.grilla).filter({ hasText: codigo }).first();
  }

  /** Celdas de esa fila, en el orden de la grilla. */
  async celdas(codigo: string): Promise<string[]> {
    return (await this.fila(codigo).locator('td').allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim());
  }

  /**
   * Abre el detalle desde el lapiz de la fila.
   * El lapiz viene deshabilitado cuando la reserva ya tiene un File asociado
   * (Inbox.aspx: `OnlineBookID != null`), asi que una reserva recien emitida
   * es la unica que se puede abrir.
   */
  async abrirDetalle(codigo: string) {
    await this.fila(codigo).locator("a:has(i.icon-pencil)").first().click();
    await this.page.waitForURL(/inbox-detail/i, { timeout: 60_000 });
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Valor de un campo, por su id estatico. Sirve en el detalle y en el file:
   *  las dos pantallas usan los mismos ids (txtQuantity, txtCustomerReference...). */
  async campo(id: string): Promise<string> {
    return (await this.page.locator(`#${id}`).first().inputValue()).trim();
  }

  // --- Generacion del file ---
  readonly comboSucursal = '#ddBranch';
  readonly btnGenerarFile = '#btnSave';          // dice "Generar file"

  /**
   * Elige la sucursal del bloque "Sucursal - Moneda - Markup" y devuelve su
   * nombre.
   *
   * Es obligatorio y es lo primero que valida el boton: con la sucursal sin
   * elegir, "Generar file" corta con "Se debe seleccionar una sucursal" y no
   * genera nada (InboxDetail.aspx.cs:281). El combo hace AutoPostBack.
   */
  async elegirSucursal(nombre = 'Argentina'): Promise<string> {
    const combo = this.page.locator(this.comboSucursal);
    const opciones = await combo.locator('option').evaluateAll((os) =>
      os.map((o) => ({ valor: (o as HTMLOptionElement).value, texto: (o.textContent || '').trim() })));

    const elegida = opciones.find((o) => o.texto.toUpperCase().includes(nombre.toUpperCase()));
    expect(
      elegida,
      `El detalle tiene que ofrecer la sucursal ${nombre}. Ofrece: ` +
      opciones.map((o) => o.texto).filter(Boolean).join(' | '),
    ).toBeTruthy();

    await combo.selectOption(elegida!.valor);
    await this.page.waitForLoadState('domcontentloaded');
    return elegida!.texto;
  }

  /**
   * Estado del ojito de cada item de servicio del file.
   *
   * Solo lo muestran las filas de servicio (`FileItemType == 10`), y tiene tres
   * estados (ManageFile.aspx:697):
   *   fa-eye text-info          -> Show = true, el item se ve en SIX
   *   fa-eye-slash text-danger  -> Show = false, esta oculto
   *   fa-eye-slash text-muted   -> la agencia no tiene SIX habilitado
   *
   * Devuelve una linea por fila con el detalle y el estado, para poder exigir
   * que todas vengan habilitadas.
   */
  async estadoDelOjito(): Promise<{ detalle: string; estado: string }[]> {
    return this.page.locator(this.filaServicioDelFile).evaluateAll((filas) =>
      filas
        .filter((tr) => tr.querySelector('i.fa-eye, i.fa-eye-slash'))
        .map((tr) => {
          const celdas = Array.from(tr.querySelectorAll('td'))
            .map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
          const icono = tr.querySelector('i.fa-eye, i.fa-eye-slash') as HTMLElement;
          const clases = (icono.className || '').toString();
          const estado = clases.includes('fa-eye-slash')
            ? (clases.includes('text-muted') ? 'SIX no habilitado' : 'oculto')
            : 'habilitado';
          // El nombre del item es la celda que termina en asterisco: el BO lo
          // arma como "{codigo} {nombre}*". Tomarlo por posicion fallaba, porque
          // la celda de estado trae las opciones enteras del desplegable.
          const detalle = celdas.find((c) => c.endsWith('*')) ?? celdas.join(' | ');
          return { detalle, estado };
        }));
  }
  readonly btnRooming = '#btnRooming, #btnRooming2';
  readonly grillaRooming = '#tblRooming tbody tr';
  /**
   * Fila del servicio dentro de "Destinos & Servicios".
   *
   * La grilla anida dos ListView: uno por destino y adentro uno por servicio
   * (lvFileDestinations / lvFileServices). Las filas de destino no traen ni el
   * nombre del servicio ni los importes, asi que se ubica la del servicio por
   * el boton de detalle que solo ella tiene.
   *
   * Columnas: E, B, #, Detalle, Estado, Tipo de Tarifa, Fecha In, Fecha Out,
   * Noches, Rooming, Costo, Venta, y la del boton. Ojo: Venta se escribe con
   * ToMoneyN3() pelado, sin codigo de moneda.
   */
  readonly filaServicioDelFile = 'tr:has(a.fileitemdetail)';

  /**
   * Genera el file desde el detalle de la bandeja y devuelve su ID.
   *
   * El cliente no hay que elegirlo: se precarga solo desde la agencia
   * (CustomerSvc.LoadByAgency). Si la agencia no tuviera uno asociado, el boton
   * no hace nada y no muestra ningun error — el codigo no tiene rama else —,
   * asi que la espera de la redireccion es lo que lo detecta.
   */
  async generarFile(): Promise<string> {
    await this.page.locator(this.btnGenerarFile).first().click();
    await this.page.waitForURL(/managefile/i, { timeout: 120_000 });
    await this.page.waitForLoadState('domcontentloaded');
    return this.page.url().split('/').pop() ?? '';
  }

  /**
   * Abre el modal de Rooming, que es donde el file guarda los pasajeros.
   *
   * La grilla no viene con el modal: se llena por AJAX recien despues de que se
   * muestra. El handler de `shown.bs.modal` pide primero los paises, despues
   * inicializa el DataTable y ahi llama a loadRoomingData
   * (Resources/custom/scripts/file.js, initRooming). Sin esperar ese encadenado
   * la tabla se lee vacia y parece que el file quedo sin pasajeros.
   */
  async abrirRooming() {
    await this.page.locator(this.btnRooming).first().click();
    await expect(this.page.locator('#modalRooming')).toBeVisible({ timeout: 30_000 });
    await this.page.locator('#tblRooming_wrapper')
      .waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {});
    await this.page.waitForFunction(() => {
      const w = window as any;
      return typeof w.jQuery === 'undefined' || w.jQuery.active === 0;
    }, undefined, { timeout: 30_000 }).catch(() => {});
  }

  /**
   * Filas del rooming, cada una como una linea con los valores cargados.
   *
   * Se leen los controles y no el texto de la fila: la grilla del rooming es
   * editable, cada celda tiene un input o un combo. Con innerText la fila
   * devolvia la lista entera de paises del combo de nacionalidad en vez del
   * dato del pasajero.
   */
  async filasDelRooming(): Promise<string[]> {
    return this.page.locator(this.grillaRooming).evaluateAll((filas) =>
      filas.map((tr) => Array.from(tr.querySelectorAll('input, select'))
        .map((control) => {
          if (control.tagName === 'SELECT') {
            const combo = control as HTMLSelectElement;
            return combo.options[combo.selectedIndex]?.text ?? '';
          }
          const campo = control as HTMLInputElement;
          return campo.type === 'checkbox' || campo.type === 'radio' ? '' : campo.value;
        })
        .filter((v) => v && v.trim() && v !== 'Seleccione...')
        .join(' | ')));
  }

  /** Cierra el rooming. El modal trae su propia cruz, sin data-dismiss. */
  async cerrarRooming() {
    await this.page.locator('#modalRooming #btnCloseCross').first().click();
    await expect(this.page.locator('#modalRooming')).toBeHidden({ timeout: 30_000 });
  }
}
