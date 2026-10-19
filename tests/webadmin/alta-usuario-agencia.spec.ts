import { test, expect, BrowserContext, Page } from '@playwright/test';

import { WebAdminUsuariosPage, intentarIngresoAlPortal, DetalleDeUsuario } from '../../pages/webadmin-usuarios.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const M = candidatos.markups;
const SALTO = String.fromCharCode(10);

// Dominio del email del usuario de prueba. En QA los correos no se envian (quedan en
// QueuedEmail) y "Guardar" no manda ninguno; se usa el de los usuarios de prueba del
// sistema (Pablo@amv.travel). Se puede cambiar sin tocar el test con esta variable.
const DOMINIO = process.env.AMV_ALTA_USUARIO_DOMINIO ?? 'amv.travel';

// La contrasena del usuario nuevo nunca sale de este archivo: ni se adjunta, ni se loguea,
// ni se imprime en un mensaje de aserto. Tampoco se graba traza ni video: la traza
// guarda los parametros de cada accion y los cuerpos de los POST.
test.use({ trace: 'off', video: 'off' });

/**
 * WebAdmin — alta de un usuario web de una agencia.
 *
 * Es sensible porque es la puerta de entrada al portal: el usuario que se da de alta
 * es el que despues entra a vender con el markup, la moneda y el pais que se le cargan
 * aca. Si el alta guarda mal el estado (queda "Pendiente de blanqueo" y el login lo
 * rechaza), la agencia o el tipo, o deja crear dos usuarios con el mismo email, el
 * problema aparece despues en el portal o en las notificaciones, lejos de su causa.
 *
 * Con la agencia propia 6334 (la misma de los tests de markups, candidatos.json):
 *   1. desde la solapa Usuarios de la agencia, "Crear usuario" abre el alta con la
 *      agencia, el tipo "Agencia - Vendedor" y la moneda precargados, el estado
 *      "Pendiente de blanqueo de clave" bloqueado y "Guardar" deshabilitado hasta que se
 *      habilita la contrasena manual;
 *   2. se completa un usuario unico (nombre "AUTO-QA USUARIO <sello>", email
 *      autoqa.usuario+<sello>@<dominio>) con una contrasena aleatoria y se guarda: la
 *      pantalla redirige a la ficha del usuario nuevo;
 *   3. la ficha guarda lo cargado (con el usuario en minusculas) y el estado queda
 *      Activo y publicado;
 *   4. el usuario aparece en la solapa Usuarios de la agencia con su ID, nombre, usuario,
 *      email y estado;
 *   5. un segundo alta con el MISMO email (otro usuario) se rechaza con el aviso de email
 *      ya registrado y no crea una segunda fila;
 *   6. el usuario nuevo entra al portal con su contrasena, en un navegador limpio;
 *   7. "Borrar" lo saca del listado y el portal deja de aceptarlo.
 *
 * Pantallas y de donde sale cada selector (repo WEB, rama qa, Web/Administration):
 *   - Alta y ficha: Customers/Detail.aspx. Controles txtName 218, txtLastName 228,
 *     txtEmail 237, ddlAgencies 246, ddlCountry 256, txtUserName 278, chkEnablePassword
 *     289, hdnPassword 293, txtPass 295, cbPublicado 338, ddlWebUserStatus 348,
 *     ddlWebUserType 360, ddlCurrency 383, cbShowMarkup 393, btnSave 434. Los ids reales
 *     llevan el prefijo `ctl00_cph1_CustomerTabContainer_pnlDetails_`: se usa sufijo.
 *   - Reglas del servidor: Customers/Detail.aspx.cs. Precarga del alta :199-232, Guardar
 *     (SaveUser) :405-509, email duplicado (HasDuplicateEmail) :624-642, usuario
 *     duplicado :424-429, contrasena fuerte (IsStrongPassword) :678-686, redireccion a la
 *     ficha :400-403. El nombre de usuario se guarda en minusculas y recortado a 20
 *     (:464) y el email a 50 (:466); el idioma se guarda siempre en 1 (:468), no hay
 *     combo.
 *   - Listado y baja: Modules/WebUsersControl.ascx (grilla gvWebUsers :32, lnkDelete :76,
 *     link "Crear usuario" :13) y .ascx.cs (:65-76, la baja es logica). La solapa es
 *     Agencies/Detail.aspx:366 (`TabID=pnlWebUsers`).
 *   - Portal: Login.aspx (txtUser, txtPassword, btnLogin, ya usados por `LoginPage`) y
 *     WebUserManager.Login (BusinessLogic/ObjectManager/WebUserManager.cs:192): rechaza
 *     estado distinto de 1/40, agencia inactiva y usuarios Deleted.
 *
 * Lo que el codigo hace y la US 4758 (duplicidad de email) no necesariamente define: el
 * texto exacto del aviso y que liste el ID/agencia del usuario existente. Se exige el
 * aviso de "ya se encuentra registrado"; el ID es una verificacion extra de este test.
 *
 * Deja la agencia como estaba: la baja es logica (la fila de WebUser queda con
 * Deleted=1), asi que cada corrida suma una fila oculta que solo se limpia por SQL.
 * Si el test falla a mitad de camino, el finally da de baja el usuario igual.
 */
test.describe('WebAdmin — alta de usuario de agencia', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  test('El alta crea el usuario, aparece en el listado, rechaza el email duplicado, entra al portal y se da de baja', async ({ page, browser, baseURL }) => {
    test.setTimeout(600_000);
    const usuarios = new WebAdminUsuariosPage(page);
    const agencia = M.agencia.id;
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const datos = {
      nombre: `AUTO-QA USUARIO ${sello}`,
      apellido: 'AUTO-QA',
      email: `autoqa.usuario+${sello}@${DOMINIO}`,
      // Con mayusculas a proposito: el sistema lo guarda en minusculas y recortado a 20.
      usuario: `AQ${sello}`,
    };
    // Segundo alta: mismo email, otro nombre de usuario, para que el rechazo sea por el
    // email y no por el usuario repetido.
    const repetido = { ...datos, nombre: `AUTO-QA USUARIO REPETIDO ${sello}`, usuario: `AQR${sello}` };
    // La genera la pantalla al habilitar la contrasena; se lee en el paso del alta.
    let contrasena = '';

    let id = 0;
    let precargado: Awaited<ReturnType<WebAdminUsuariosPage['estadoInicialDelAlta']>>;
    let bajaHecha = false;
    // Si el segundo alta se guardara por error, hay una fila de mas para dar de baja.
    let segundoCreado = false;
    let contextoPortal: BrowserContext | undefined;
    let portal: Page;

    try {
      await paso(page, `Entrar al alta desde la solapa Usuarios de la agencia ${agencia} y verificar lo que precarga`, async () => {
        await usuarios.abrirAlta(agencia);
        precargado = await usuarios.estadoInicialDelAlta();
        await adjuntarTexto('Precarga del alta', JSON.stringify(precargado, null, 2));
        expect(precargado.agencia.texto, `La agencia elegida tiene que ser la ${agencia}`).toContain(`[${agencia}]`);
        expect(precargado.tipo.valor, 'El tipo tiene que venir en "Agencia - Vendedor" (3)').toBe('3');
        expect(precargado.pais.valor, 'El pais tiene que venir cargado con el de la agencia').not.toBe('0');
        expect(precargado.publicado, 'El usuario nuevo tiene que venir publicado').toBe(true);
        expect(precargado.estado.valor, 'El estado inicial tiene que ser "Pendiente de blanqueo de clave" (40)').toBe('40');
        expect(precargado.estadoHabilitado, 'El estado no se puede editar en el alta').toBe(false);
        expect(precargado.guardarHabilitado, 'Guardar tiene que estar deshabilitado hasta habilitar la contrasena').toBe(false);
      });

      await paso(page, 'Completar los datos, habilitar la contrasena que genera la pantalla y guardar', async () => {
        await usuarios.completarDatos(datos);
        await usuarios.habilitarContrasena();
        // Como un administrador real: se toma la contrasena que la pantalla genero sola al
        // habilitar (la que queda en el campo), no se inyecta una propia. Es la que guarda
        // el servidor y con la que despues el usuario entra al portal.
        contrasena = await usuarios.contrasenaGenerada();
        const resultado = await usuarios.guardarAlta();
        expect(resultado.aviso, 'El alta no tiene que ser rechazada').toBe('');
        expect(resultado.id, 'Guardar tiene que redirigir a la ficha del usuario nuevo (CustomerID)').not.toBeNull();
        id = resultado.id!;
        await adjuntarTexto('Usuario creado', [
          `ID: ${id}`, `Nombre: ${datos.nombre} ${datos.apellido}`, `Usuario: ${datos.usuario}`, `Email: ${datos.email}`,
        ].join(SALTO));
      });

      await paso(page, 'La ficha guarda lo cargado: usuario en minusculas, agencia, estado Activo y publicado', async () => {
        await usuarios.abrirDetalle(id);
        const ficha: DetalleDeUsuario = await usuarios.leerDetalle();
        await adjuntarTexto('Ficha del usuario', JSON.stringify(ficha, null, 2));
        expect(ficha.nombre).toBe(datos.nombre);
        expect(ficha.apellido).toBe(datos.apellido);
        expect(ficha.email).toBe(datos.email);
        expect(ficha.usuario, 'El nombre de usuario se guarda en minusculas').toBe(datos.usuario.toLowerCase());
        expect(ficha.agencia.texto, 'La ficha tiene que mostrar la agencia elegida').toContain(`[${agencia}]`);
        expect(ficha.estado.valor, 'Con la contrasena habilitada el usuario queda Activo (1)').toBe('1');
        expect(ficha.publicado, 'El usuario tiene que quedar publicado').toBe(true);
        expect(ficha.tipo.valor, 'El tipo tiene que ser el que traia el alta').toBe(precargado.tipo.valor);
        expect(ficha.moneda.valor, 'La moneda tiene que ser la que traia el alta').toBe(precargado.moneda.valor);
        expect(ficha.pais.valor, 'El pais tiene que ser el que traia el alta').toBe(precargado.pais.valor);
        expect(ficha.mostrarMarkup, 'Mostrar Markup tiene que quedar como lo traia el alta (tildado)').toBe(true);
      });

      await paso(page, `El usuario aparece en la solapa Usuarios de la agencia ${agencia}`, async () => {
        const fila = await usuarios.filaDelUsuario(agencia, datos.email);
        await adjuntarTexto('Fila del listado', JSON.stringify(fila, null, 2));
        expect(fila, `El listado de la agencia ${agencia} tiene que incluir el email ${datos.email}`).not.toBeNull();
        expect(fila!.id, 'La fila tiene que ser del usuario recien creado').toBe(id);
        expect(fila!.nombre).toBe(`${datos.nombre} ${datos.apellido}`);
        expect(fila!.usuario).toBe(datos.usuario.toLowerCase());
        expect(fila!.email).toBe(datos.email);
        expect(fila!.estado.length, 'La fila tiene que mostrar el estado').toBeGreaterThan(0);
      });

      await paso(page, 'Un segundo alta con el mismo email es rechazada y no crea otra fila', async () => {
        await usuarios.abrirAlta(agencia);
        await usuarios.completarDatos(repetido);
        // Esta contrasena la genera la propia pantalla al habilitar: el alta no se guarda.
        await usuarios.habilitarContrasena();
        const resultado = await usuarios.guardarAlta();
        await adjuntarTexto('Aviso del segundo alta', resultado.aviso || '(sin aviso)');
        segundoCreado = resultado.id !== null;
        expect(resultado.id, 'El segundo alta no tiene que crear un usuario').toBeNull();
        expect(resultado.aviso, 'Tiene que avisar que el email ya esta registrado')
          .toMatch(/El email cargado ya se encuentra registrado/i);
        expect(resultado.aviso, 'El aviso tiene que nombrar al usuario que ya tiene ese email').toContain(`ID: ${id}`);

        expect(await usuarios.cuantosConElEmail(agencia, datos.email),
          'El listado tiene que seguir con una sola fila con ese email').toBe(1);
      });

      await paso(page, 'El usuario nuevo entra al portal con su contrasena, en un navegador limpio', async () => {
        contextoPortal = await browser.newContext({
          baseURL,
          viewport: { width: 1920, height: 1080 },
          ignoreHTTPSErrors: true,
          storageState: { cookies: [], origins: [] },
        });
        portal = await contextoPortal.newPage();
        const acepto = await intentarIngresoAlPortal(portal, datos.usuario.toLowerCase(), contrasena);
        expect(acepto, 'El portal tiene que aceptar al usuario recien dado de alta').toBe(true);
        await expect(portal).not.toHaveURL(/login/i);
      });

      await paso(page, 'Dar de baja el usuario: sale del listado y el portal deja de aceptarlo', async () => {
        const borro = await usuarios.darDeBaja(agencia, datos.email);
        expect(borro, 'El usuario tenia que estar en el listado para poder borrarlo').toBe(true);
        bajaHecha = true;
        expect(await usuarios.cuantosConElEmail(agencia, datos.email),
          'Despues de recargar el listado el usuario no tiene que aparecer').toBe(0);

        // Navegador limpio otra vez: el contexto anterior ya tiene la sesion abierta.
        await contextoPortal?.close();
        contextoPortal = await browser.newContext({
          baseURL,
          viewport: { width: 1920, height: 1080 },
          ignoreHTTPSErrors: true,
          storageState: { cookies: [], origins: [] },
        });
        portal = await contextoPortal.newPage();
        const acepto = await intentarIngresoAlPortal(portal, datos.usuario.toLowerCase(), contrasena);
        expect(acepto, 'El portal no tiene que aceptar a un usuario dado de baja').toBe(false);
      });
    } finally {
      await contextoPortal?.close().catch(() => {});
      // Si el test fallo antes de la baja, el usuario no puede quedar vivo en QA.
      if (id && (!bajaHecha || segundoCreado)) {
        await paso(page, `Restaurar: dar de baja los usuarios con el email ${datos.email}`, async () => {
          for (let i = 0; i < 3; i++) {
            if (!(await usuarios.darDeBaja(agencia, datos.email))) break;
          }
        });
      }
    }
  });
});
