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
    // La sucursal de trabajo se elige una sola vez, al entrar: de ella dependen las
    // cajas que ofrecen las ordenes de pago y de cobro.
    await this.elegirSucursalDeTrabajo('Argentina');
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

  /**
   * La fila de la bandeja que corresponde al codigo BOxxxxxxxx.
   *
   * **La bandeja muestra el ID pelado**, `25166` para `BO00025166`, asi que se busca
   * por ese numero y no por el codigo entero: buscando el codigo no encuentra
   * ninguna fila. Es la misma trampa de la bandeja de items no asignados, que
   * muestra el numero del file sin prefijo ni ceros.
   */
  fila(codigo: string): Locator {
    const numero = String(Number(codigo.replace(/\D/g, '')));
    return this.page.locator(this.grilla)
      .filter({ hasText: new RegExp(`\\b(${codigo}|${numero})\\b`) })
      .first();
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
    // El icono del lapiz cambio de familia: `i.icon-pencil` paso a `i.ph.ph-pencil-simple`
    // (Files/Inbox.aspx:152). Se aceptan los dos para no atarse a la tipografia de iconos.
    await this.fila(codigo)
      .locator("a:has(i.icon-pencil), a:has(i.ph-pencil-simple)")
      .first()
      .click();
    await this.page.waitForURL(/inbox-detail/i, { timeout: 60_000 });
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Valor de un campo, por su id estatico. Sirve en el detalle y en el file:
   *  las dos pantallas usan los mismos ids (txtQuantity, txtCustomerReference...). */
  async campo(id: string): Promise<string> {
    return (await this.page.locator(`#${id}`).first().inputValue()).trim();
  }

  /**
   * Costo y Venta de un item de la grilla del file.
   *
   * Las dos celdas son `td.fi-money` —primero Costo, despues Venta— con la moneda
   * pegada al numero desde la US 4648. Se devuelven como "USD 1.290,00".
   */
  async montosDelItemDelFile(fila: Locator): Promise<{ costo: string; venta: string }> {
    const montos = await fila.locator('td.fi-money .fi-money__amount').evaluateAll((celdas) =>
      celdas.map((c) => {
        const texto = ((c as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim();
        const m = texto.match(/^(-?[\d.,]+)\s*([A-Za-z]{3})$/);
        return m ? `${m[2].toUpperCase()} ${m[1]}` : texto;
      }));
    if (montos.length >= 2) return { costo: montos[0], venta: montos[montos.length - 1] };

    // Respaldo: la grilla anterior, con los dos importes en celdas sueltas.
    const celdas = (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
    const conImporte = celdas.filter((c) => /^([A-Z]{3}\s*)?\d[\d.,]*$/.test(c));
    return { costo: conImporte.at(-2) ?? '', venta: conImporte.at(-1) ?? '' };
  }

  /**
   * Totales USD del file, por rotulo: Costo, Venta, Over y Utilidad.
   *
   * **La US 4648 paso los totales de una tabla a tarjetas**: cada uno es un
   * `.bo-tot__card` con su `.bo-tot__rotulo` y su `.bo-tot__valor`, y el valor trae
   * la moneda pegada al numero ("1.290,000USD"). Antes se leia la primera fila de la
   * tabla y se tomaba la segunda celda como Venta.
   *
   * Se devuelve cada importe como "USD 1.290,000", para que lo parsee el helper de
   * siempre, y se deja el respaldo por si se corre contra un BO anterior.
   */
  async totalesDelFile(): Promise<Record<string, string>> {
    const tarjetas = this.page.locator('#updFileTotals .bo-tot__card');
    if (await tarjetas.count()) {
      return tarjetas.evaluateAll((cards) => {
        const limpio = (x: string) => (x ?? '').replace(/\s+/g, ' ').trim();
        const salida: Record<string, string> = {};
        for (const card of cards) {
          const rotulo = limpio((card.querySelector('.bo-tot__rotulo') as HTMLElement)?.innerText ?? '');
          const valor = limpio((card.querySelector('.bo-tot__valor') as HTMLElement)?.innerText ?? '');
          const m = valor.match(/^(-?[\d.,]+)\s*([A-Za-z]{3})$/);
          if (rotulo) salida[rotulo.toUpperCase()] = m ? `${m[2].toUpperCase()} ${m[1]}` : valor;
        }
        return salida;
      });
    }

    // Respaldo: la tabla anterior a la US 4648 (Costo | Venta | Over | Utilidad).
    const fila = this.page.locator('#updFileTotals table')
      .filter({ has: this.page.locator('th', { hasText: 'USD' }) }).first()
      .locator('tbody tr').first();
    const celdas = (await fila.locator('td').allInnerTexts()).map((c) => c.trim());
    return { COSTO: celdas[0] ?? '', VENTA: celdas[1] ?? '', OVER: celdas[2] ?? '', UTILIDAD: celdas[3] ?? '' };
  }

  // --- Sucursal de trabajo (encabezado) ---
  /**
   * Desde el rediseno del BackOffice (US 4648) **la sucursal se elige una sola vez
   * en el encabezado** y no en cada pantalla: es `ddWorkingBranch`, dentro de
   * `li.bo-working-branch` (BOMaster.Master:1017). Los combos de caja de las ordenes
   * pasaron a listar las cajas de esa sucursal, asi que parado en Peru no aparece la
   * caja de regresion de Argentina y el Bloque C se queda sin donde cobrar.
   *
   * El control lo dibuja TomSelect, que esconde el `select` original: se opera por la
   * pastilla y su lista, como haria una persona. Si la pantalla no lo tiene —una
   * version anterior del BO— no hace nada.
   */
  async elegirSucursalDeTrabajo(nombre = 'Argentina') {
    const pastilla = this.page.locator('li.bo-working-branch .ts-control').first();
    if (!(await pastilla.count())) return;

    const actual = (await pastilla.innerText()).replace(/\s+/g, ' ').trim();
    if (actual.toUpperCase().includes(nombre.toUpperCase())) return;

    await pastilla.click();
    const opcion = this.page.locator('.ts-dropdown .option', { hasText: nombre }).first();
    await expect(opcion, `El encabezado tiene que ofrecer la sucursal ${nombre}`)
      .toBeVisible({ timeout: 30_000 });
    await opcion.click();
    // El combo hace AutoPostBack: la pantalla se recarga con la sucursal nueva.
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.page.locator('li.bo-working-branch .ts-control').first())
      .toContainText(nombre, { timeout: 30_000 });
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
   * Venta de cada item de la grilla del file, en el orden de la grilla.
   *
   * **La US 4648 (17/09/2026) rehizo la pantalla del file.** El importe dejo de ser
   * una celda suelta: vive en `td.fi-money .fi-money__amount`, con la MONEDA PEGADA
   * al numero ("1.290,00USD" en una sola cadena), y la grilla sumo la columna
   * "Noches". Leyendo "la ultima celda que parezca un importe" —como se hacia— se
   * terminaba leyendo las noches: 3 donde el item vale 1.290.
   *
   * Hay dos celdas `fi-money` por fila, Costo y Venta: la venta es la ultima. Se
   * devuelve como "USD 1.290,00" para que la parsee el mismo helper de siempre.
   */
  async ventasDeLosItemsDelFile(filas: Locator): Promise<string[]> {
    return filas.evaluateAll((trs) =>
      trs.map((tr) => {
        const limpio = (x: string) => (x ?? '').replace(/\s+/g, ' ').trim();
        const money = Array.from(tr.querySelectorAll('td.fi-money .fi-money__amount'));
        if (money.length) {
          const texto = limpio((money[money.length - 1] as HTMLElement).innerText);
          const m = texto.match(/^([\d.,]+)\s*([A-Za-z]{3})$/);
          return m ? `${m[2].toUpperCase()} ${m[1]}` : texto;
        }
        // Respaldo: la grilla anterior a la US 4648, con el importe en su propia celda.
        const celdas = Array.from(tr.querySelectorAll('td')).map((c) => limpio(c.textContent ?? ''));
        return celdas.filter((c) => /^([A-Z]{3}\s*)?\d[\d.,]*$/.test(c)).at(-1) ?? '';
      }));
  }

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
