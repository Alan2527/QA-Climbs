import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';
import { LoginPage } from './login.page';

/**
 * WebAdmin (BaseCamp): alta, listado y baja de los usuarios web de una agencia.
 *
 * - Listado: ficha de la agencia, solapa "Usuarios"
 *   `administration/agencies/detail.aspx?agency=<id>&TabID=pnlWebUsers`
 *   (Agencies/Detail.aspx:366 -> Modules/WebUsersControl.ascx).
 * - Alta y edicion: `administration/customers/detail.aspx` (Customers/Detail.aspx). Se
 *   entra por el link "Crear usuario" de la solapa (WebUsersControl.ascx:13), que lleva
 *   `?agency=<id>` y deja la agencia, el pais, la moneda y el tipo precargados
 *   (Customers/Detail.aspx.cs:213-231). Editar es `?CustomerID=<id>`.
 * - Baja: "Borrar" de la fila (WebUsersControl.ascx:76), sin confirmacion. No borra la
 *   fila: la marca Deleted=1 / Published=0 con DeletedDate (WebUsersControl.ascx.cs:65-76),
 *   y de ahi en mas el listado de la agencia y el login no la ven.
 *
 * **La contrasena nunca pasa por `fill()`**: Allure registra cada fill como un paso
 * `Fill "<valor>"` y la contrasena quedaria publicada en el reporte. Se escribe con
 * `evaluate`, que solo registra el locator, y la pantalla se enmascara
 * (`enmascararContrasenas`) para que ninguna captura la muestre.
 */

export type DatosDeAlta = { nombre: string; apellido: string; email: string; usuario: string };

export type OpcionElegida = { valor: string; texto: string };

export type DetalleDeUsuario = {
  nombre: string;
  apellido: string;
  email: string;
  usuario: string;
  agencia: OpcionElegida;
  pais: OpcionElegida;
  estado: OpcionElegida;
  tipo: OpcionElegida;
  moneda: OpcionElegida;
  publicado: boolean;
  mostrarMarkup: boolean;
};

export type FilaDeUsuario = { id: number; nombre: string; usuario: string; email: string; estado: string };

export class WebAdminUsuariosPage {
  constructor(private readonly page: Page) {}

  // Alta / edicion: todos los controles viven en la solapa "Detalle" del TabContainer
  // (Customers/Detail.aspx:204, pnlDetails). Los SimpleTextBox y el EmailTextBox traen
  // el input adentro, con id `<control>_txtValue`.
  private sel(id: string) {
    return `[id$="CustomerTabContainer_pnlDetails_${id}"]`;
  }
  private readonly nombre = this.sel('txtName_txtValue');           // Customers/Detail.aspx:218
  private readonly apellido = this.sel('txtLastName_txtValue');     // :228
  private readonly email = this.sel('txtEmail_txtValue');           // :237 (EmailTextBox.ascx)
  private readonly agencia = this.sel('ddlAgencies');               // :246
  private readonly pais = this.sel('ddlCountry');                   // :256
  private readonly usuario = this.sel('txtUserName_txtValue');      // :278
  private readonly habilitarClave = this.sel('chkEnablePassword');  // :289
  private readonly clave = this.sel('txtPass');                     // :295 (MaxLength 20)
  private readonly claveOculta = this.sel('hdnPassword');           // :293, la que lee el servidor
  private readonly publicado = this.sel('cbPublicado');             // :338
  private readonly estado = this.sel('ddlWebUserStatus');           // :348
  private readonly tipo = this.sel('ddlWebUserType');               // :360
  private readonly moneda = this.sel('ddlCurrency');                // :383
  private readonly mostrarMarkup = this.sel('cbShowMarkup');        // :393
  private readonly guardar = this.sel('btnSave');                   // :434

  // Solapa "Usuarios" de la ficha de la agencia (Modules/WebUsersControl.ascx).
  private readonly filtroEstado = '[id$="ctrlWebUsersControl_ddlStatus"]'; // :17
  private readonly grilla = '[id$="ctrlWebUsersControl_gvWebUsers"]';      // :32
  private readonly linkCrear = 'a[href*="customers/detail.aspx?agency="]'; // :13

  private pantallaEnmascarada = false;

  /**
   * Muestra la contrasena como puntos (`-webkit-text-security`) en todas las cargas de
   * la pagina, incluidas las que vienen de un PostBack completo. El campo de la
   * contrasena manual es un texto comun, no un password: sin esto la captura de cada
   * paso, la de la falla y el video mostrarian el valor.
   */
  async enmascararContrasenas() {
    if (this.pantallaEnmascarada) return;
    this.pantallaEnmascarada = true;
    await this.page.addInitScript(() => {
      const poner = () => {
        const estilo = document.createElement('style');
        estilo.textContent = '[id$="txtPass"], [id$="txtNewPassword"] { -webkit-text-security: disc !important; }';
        document.head.appendChild(estilo);
      };
      if (document.head) poner();
      else document.addEventListener('DOMContentLoaded', poner);
    });
  }

  // ---------------------------------------------------------------- listado

  async abrirUsuariosDeLaAgencia(agencia: number) {
    await this.page.goto(`/administration/agencies/detail.aspx?agency=${agencia}&TabID=pnlWebUsers`);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.filtroEstado), 'La solapa Usuarios de la agencia tiene que cargar').toBeVisible();
  }

  private filaDe(email: string): Locator {
    return this.page.locator(this.grilla).locator('tr', { hasText: email });
  }

  /** La fila del usuario en la solapa Usuarios, o null si no esta en el listado. */
  async filaDelUsuario(agencia: number, email: string): Promise<FilaDeUsuario | null> {
    await this.abrirUsuariosDeLaAgencia(agencia);
    const filas = this.filaDe(email);
    const cantidad = await filas.count();
    expect(cantidad, `El email ${email} no tiene que estar mas de una vez en el listado de la agencia ${agencia}`)
      .toBeLessThanOrEqual(1);
    if (cantidad === 0) return null;
    // Columnas: ID, Nombre, Nombre Usuario, Email, Estado, Publicado, Editar, Borrar.
    const celdas = (await filas.first().locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
    return {
      id: Number(/\d+/.exec(celdas[0])?.[0] ?? 0),
      nombre: celdas[1],
      usuario: celdas[2],
      email: celdas[3],
      estado: celdas[4],
    };
  }

  /** Cuantas filas del listado de la agencia tienen ese email. */
  async cuantosConElEmail(agencia: number, email: string): Promise<number> {
    await this.abrirUsuariosDeLaAgencia(agencia);
    return this.filaDe(email).count();
  }

  /**
   * "Borrar" de la fila. Devuelve false si el usuario ya no estaba (la baja es
   * idempotente, para poder llamarla desde el finally).
   */
  async darDeBaja(agencia: number, email: string): Promise<boolean> {
    await this.abrirUsuariosDeLaAgencia(agencia);
    const fila = this.filaDe(email);
    if ((await fila.count()) === 0) return false;
    await fila.first().locator('[id$="lnkDelete"]').click();
    await esperarFinDeCarga(this.page);
    await expect(this.filaDe(email), 'Despues de Borrar el usuario no tiene que seguir en el listado')
      .toHaveCount(0, { timeout: 30_000 });
    return true;
  }

  // ------------------------------------------------------------------- alta

  /**
   * Entra al alta por el link "Crear usuario" de la solapa Usuarios. El link abre otra
   * pestana (`target=_blank`) y apunta al host configurado en el sistema; se toma su
   * ruta y se abre en esta misma pestana, sobre el `baseURL` de la suite.
   */
  async abrirAlta(agencia: number) {
    await this.enmascararContrasenas();
    await this.abrirUsuariosDeLaAgencia(agencia);
    const link = this.page.locator(this.linkCrear).first();
    await expect(link, 'La solapa Usuarios tiene que ofrecer "Crear usuario"').toBeVisible();
    const destino = new URL((await link.getAttribute('href')) ?? '', this.page.url());
    await this.page.goto(destino.pathname + destino.search);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.nombre), 'El formulario de alta tiene que cargar').toBeVisible();
  }

  /** Lo que trae el alta antes de tocar nada (Customers/Detail.aspx.cs:199-232). */
  async estadoInicialDelAlta() {
    return {
      agencia: await this.opcion(this.agencia),
      pais: await this.opcion(this.pais),
      estado: await this.opcion(this.estado),
      estadoHabilitado: await this.page.locator(this.estado).isEnabled(),
      tipo: await this.opcion(this.tipo),
      moneda: await this.opcion(this.moneda),
      publicado: await this.page.locator(this.publicado).isChecked(),
      guardarHabilitado: await this.page.locator(this.guardar).isEnabled(),
    };
  }

  async completarDatos(datos: DatosDeAlta) {
    await this.page.locator(this.nombre).fill(datos.nombre);
    await this.page.locator(this.apellido).fill(datos.apellido);
    await this.page.locator(this.email).fill(datos.email);
    await this.page.locator(this.usuario).fill(datos.usuario);
  }

  /**
   * Tilda "Habilitar" (contrasena manual). Es lo que habilita "Guardar" en el alta y
   * lo que pasa el estado a Activo (togglePasswordFields, Customers/Detail.aspx:675).
   * El checkbox es un interruptor estilizado: se hace clic en su label.
   */
  async habilitarContrasena() {
    const check = this.page.locator(this.habilitarClave);
    if (!(await check.isChecked())) {
      const id = await check.getAttribute('id');
      await this.page.locator(`label[for="${id}"]`).click({ timeout: 10_000 }).catch(() => {});
      if (!(await check.isChecked())) await check.click({ force: true });
    }
    await expect(check, 'Habilitar tiene que quedar tildado').toBeChecked();
    await expect(this.page.locator(this.clave), 'Habilitar tiene que habilitar el campo de contrasena').toBeEnabled();
    await expect(this.page.locator(this.guardar), 'Habilitar tiene que habilitar Guardar').toBeEnabled();
  }

  /**
   * Devuelve la contrasena que la pantalla genero sola al tildar "Habilitar"
   * (`regenerateManualPassword` -> `randomPassword`, Customers/Detail.aspx:715/755), que es
   * la que el administrador ve en el campo y la que el servidor guarda al apretar Guardar
   * (`ViewState["Password"] = txtPass.Text`, Detail.aspx.cs:395). No se escribe nada: el
   * alta sigue el flujo real, el usuario entra despues con esta misma clave. Se lee con
   * `evaluate` (no es un paso "Fill" de Allure) para no publicar el valor en el reporte.
   */
  async contrasenaGenerada(): Promise<string> {
    const generada = await this.page.locator(this.clave).evaluate((el) => (el as HTMLInputElement).value);
    expect(generada.length, 'Al habilitar, la pantalla tiene que generar una contrasena en el campo').toBeGreaterThanOrEqual(8);
    return generada;
  }

  /**
   * Presiona "Guardar" y devuelve que paso: el alta redirige a
   * `customers/detail.aspx?CustomerID=<id>` (Customers/Detail.aspx.cs:402), y un rechazo
   * deja la pantalla donde estaba con un aviso que se va solo a los pocos segundos. Se
   * sondea el aviso en vez de esperar la recarga, como en las otras pantallas del
   * WebAdmin. El mensaje de exito no sirve: el Response.Redirect lo descarta.
   */
  async guardarAlta(): Promise<{ id: number | null; aviso: string }> {
    await this.page.locator(this.guardar).click();
    const avisos = new RegExp(
      '(El email cargado ya se encuentra registrado\\.[\\s\\S]{0,400}'
      + '|El nombre de usuario cargado ya se encuentra registrado\\.'
      + '|El email no puede contener espacios\\.'
      + '|Debe seleccionar [^\\n]+'
      + '|Debe ingresar una contrase[^\\n]+'
      + '|La contrase[^\\n]+ debe tener[^\\n]+)', 'i');
    const limite = Date.now() + 90_000;
    while (Date.now() < limite) {
      const id = /CustomerID=(\d+)/i.exec(this.page.url())?.[1];
      if (id) {
        await esperarFinDeCarga(this.page);
        return { id: Number(id), aviso: '' };
      }
      const cuerpo = await this.page.locator('body').innerText({ timeout: 2_000 }).catch(() => '');
      const aviso = cuerpo.match(avisos)?.[0];
      if (aviso) {
        await esperarFinDeCarga(this.page);
        return { id: null, aviso: aviso.trim() };
      }
      await this.page.waitForTimeout(300);
    }
    throw new Error('Guardar el alta no redirigio al usuario ni mostro un aviso conocido');
  }

  // ---------------------------------------------------------------- detalle

  async abrirDetalle(id: number) {
    await this.enmascararContrasenas();
    await this.page.goto(`/administration/customers/detail.aspx?CustomerID=${id}`);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator(this.nombre), 'La ficha del usuario tiene que cargar').toBeVisible();
  }

  async leerDetalle(): Promise<DetalleDeUsuario> {
    const texto = (css: string) => this.page.locator(css).inputValue();
    return {
      nombre: await texto(this.nombre),
      apellido: await texto(this.apellido),
      email: await texto(this.email),
      usuario: await texto(this.usuario),
      agencia: await this.opcion(this.agencia),
      pais: await this.opcion(this.pais),
      estado: await this.opcion(this.estado),
      tipo: await this.opcion(this.tipo),
      moneda: await this.opcion(this.moneda),
      publicado: await this.page.locator(this.publicado).isChecked(),
      mostrarMarkup: await this.page.locator(this.mostrarMarkup).isChecked(),
    };
  }

  /** Valor y texto de la opcion elegida de un combo (los combos pueden venir estilizados). */
  private async opcion(css: string): Promise<OpcionElegida> {
    const combo = this.page.locator(css);
    await expect(combo).toBeAttached();
    return combo.evaluate((el) => {
      const select = el as HTMLSelectElement;
      const elegida = select.selectedOptions[0];
      return { valor: select.value, texto: (elegida?.textContent ?? '').replace(/\s+/g, ' ').trim() };
    });
  }
}

/**
 * Intenta entrar al portal con el usuario y la contrasena dados. Devuelve true si el
 * login lo acepta y false si vuelve a mostrar el login con un error.
 *
 * Reusa `LoginPage` para abrir el login, pero no `LoginPage.ingresar`: esa escribe la
 * contrasena con `fill` y el reporte la mostraria (ver la nota del principio). El
 * campo es de tipo password, asi que las capturas la muestran como puntos.
 *
 * Se decide por la respuesta del POST: un login aceptado redirige (302, o el
 * `pageRedirect` de un PostBack asincronico) y uno rechazado devuelve la pagina del
 * login con el error.
 */
export async function intentarIngresoAlPortal(portal: Page, usuario: string, contrasena: string): Promise<boolean> {
  await new LoginPage(portal).abrir();
  await portal.locator('#txtUser').fill(usuario);
  await portal.locator('#txtPassword').evaluate((el, valor) => {
    (el as HTMLInputElement).value = valor;
  }, contrasena);

  // Se decide el resultado como un usuario real: si tras "Ingresar" la pantalla sale de
  // /login.aspx, entro; si se queda (con el aviso de credenciales), no. Es el mismo
  // criterio que usa el login de la suite (LoginPage.ingresar). Mirar la respuesta del
  // POST daba un falso negativo: el login redirige con un 200 + script, no con un 302.
  await portal.locator('#btnLogin').click();
  const entro = await portal
    .waitForURL((url) => !url.pathname.toLowerCase().includes('login'), { timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (entro) await esperarFinDeCarga(portal);
  return entro;
}
