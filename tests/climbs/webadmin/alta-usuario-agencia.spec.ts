import { test, expect, BrowserContext, Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { UsuarioDeAgenciaPage, intentarIngresoAlPortalNuevo } from '../../../pages/climbs/usuario-agencia.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import candidatos from '../../../data/candidatos.json';

const M = candidatos.markups;
const SALTO = String.fromCharCode(10);
const DOMINIO = process.env.AMV_ALTA_USUARIO_DOMINIO ?? 'amv.travel';

// La clave del usuario nuevo nunca sale de este archivo: ni se adjunta, ni se loguea. Tampoco se
// graba traza ni video (guardan lo que se escribe en los campos).
test.use({ trace: 'off', video: 'off' });

/**
 * WEBADMIN — app nueva (ClimbsApp). Alta de un usuario web de una agencia.
 *
 * El mismo test que tests/webadmin/alta-usuario-agencia.spec.ts, con el mismo titulo. En la app
 * nueva el alta se hace en el Backoffice: solapa "Usuarios" de la agencia › "Nuevo usuario", que
 * abre la ficha de Usuarios de agencias con la agencia elegida. La clave la escribe quien da el
 * alta (el WebAdmin la generaba al habilitar la contrasena manual).
 *
 * Con la agencia propia 6334:
 *   1. el alta trae la agencia, el tipo "Agencia - Vendedor" (3), el pais de la agencia y
 *      habilitado; sin clave no se guarda;
 *   2. con un usuario unico (email autoqa.usuario+<sello>@<dominio>) y una clave aleatoria, se
 *      guarda y lleva a la ficha del usuario nuevo;
 *   3. la ficha guarda lo cargado y el usuario queda Activo y habilitado;
 *   4. aparece en la solapa Usuarios de la agencia;
 *   5. un segundo alta con el MISMO email se rechaza y no crea otra fila;
 *   6. el usuario nuevo entra al portal nuevo con su clave, en un navegador limpio;
 *   7. "Borrar" lo saca del listado y el portal deja de aceptarlo.
 *
 * El WebAdmin arrancaba el alta en "Pendiente de blanqueo de clave" porque la clave era opcional;
 * en la app nueva la clave es obligatoria (se exige que sin clave no guarde): misma proteccion.
 * Diferencias que se marcan (soft): el pais venia cargado con el de la agencia; el nombre de
 * usuario se guardaba en minusculas; el aviso de email repetido nombraba al usuario que lo tiene.
 */
test.describe('WebAdmin — alta de usuario de agencia', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  test('El alta crea el usuario, aparece en el listado, rechaza el email duplicado, entra al portal y se da de baja', async ({ page, browser, baseURL }) => {
    test.setTimeout(600_000);
    const usuarios = new UsuarioDeAgenciaPage(page);
    const agencia = M.agencia.id;
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const datos = { nombre: `AUTO-QA USUARIO ${sello}`, apellido: 'AUTO-QA', email: `autoqa.usuario+${sello}@${DOMINIO}`, usuario: `AQ${sello}` };
    const repetido = { ...datos, nombre: `AUTO-QA USUARIO REPETIDO ${sello}`, usuario: `AQR${sello}` };
    // Cumple la regla de la pantalla: 8 o mas, mayuscula, minuscula, numero y simbolo.
    const clave = `Aq#${randomBytes(6).toString('hex')}9Z`;
    let id = 0;
    let bajaHecha = false;
    let segundo: number | null = null;
    let precarga: Awaited<ReturnType<UsuarioDeAgenciaPage['leer']>>;
    let contextoPortal: BrowserContext | undefined;
    let portal: Page;
    const navegadorLimpio = async () => {
      await contextoPortal?.close();
      contextoPortal = await browser.newContext({ baseURL, locale: 'es-AR', viewport: { width: 1920, height: 1080 }, storageState: { cookies: [], origins: [] } });
      portal = await contextoPortal.newPage();
      return portal;
    };

    try {
      await paso(page, `Entrar al alta desde la solapa Usuarios de la agencia ${agencia} y verificar lo que precarga`, async () => {
        await usuarios.abrirAlta(agencia);
        precarga = await usuarios.leer();
        const tipo = await usuarios.ficha.locator('#au-type').inputValue();
        await adjuntarTexto('Precarga del alta', JSON.stringify({ ...precarga, tipoValor: tipo }, null, 2));
        expect(precarga.agencia, `La agencia elegida tiene que ser la ${agencia}`).toContain(M.agencia.nombre);
        expect(tipo, 'El tipo tiene que venir en "Agencia - Vendedor" (3)').toBe('3');
        expect(precarga.habilitado, 'El usuario nuevo tiene que venir habilitado').toBe(true);
        expect.soft(precarga.pais, 'DIFERENCIA con el WebAdmin: el pais tiene que venir cargado con el de la agencia').not.toBe('');
      });

      await paso(page, 'Sin clave el alta no se guarda', async () => {
        await usuarios.completar(datos, '');
        if (!precarga.pais) await usuarios.ficha.locator('#au-country').selectOption({ label: 'Argentina' });
        const resultado = await usuarios.guardarAlta();
        await adjuntarTexto('Aviso sin clave', resultado.aviso || '(sin aviso)');
        expect(resultado.id, 'Sin clave no se tiene que crear el usuario').toBeNull();
        expect(resultado.aviso, 'Tiene que avisar por la clave').not.toBe('');
      });

      await paso(page, 'Completar la clave y guardar', async () => {
        await usuarios.ficha.locator('#au-pass').fill(clave);
        const resultado = await usuarios.guardarAlta();
        expect(resultado.aviso, 'El alta no tiene que ser rechazada').toBe('');
        expect(resultado.id, 'Guardar tiene que llevar a la ficha del usuario nuevo').not.toBeNull();
        id = resultado.id!;
        await adjuntarTexto('Usuario creado', [`ID: ${id}`, `Nombre: ${datos.nombre} ${datos.apellido}`, `Usuario: ${datos.usuario}`, `Email: ${datos.email}`].join(SALTO));
      });

      await paso(page, 'La ficha guarda lo cargado: usuario, agencia, estado Activo y habilitado', async () => {
        await usuarios.abrir(id);
        const ficha = await usuarios.leer();
        await adjuntarTexto('Ficha del usuario', JSON.stringify(ficha, null, 2));
        expect(ficha.nombre).toBe(datos.nombre);
        expect(ficha.apellido).toBe(datos.apellido);
        expect(ficha.email).toBe(datos.email);
        expect(ficha.usuario.toLowerCase(), 'El nombre de usuario tiene que quedar guardado').toBe(datos.usuario.toLowerCase());
        expect.soft(ficha.usuario, 'DIFERENCIA con el WebAdmin: el nombre de usuario se guardaba en minusculas').toBe(datos.usuario.toLowerCase());
        expect(ficha.agencia, 'La ficha tiene que mostrar la agencia elegida').toContain(M.agencia.nombre);
        expect(ficha.estado, 'Con clave el usuario queda Activo').toMatch(/^Activo/i);
        expect(ficha.habilitado, 'El usuario tiene que quedar habilitado').toBe(true);
        expect(ficha.tipo, 'El tipo tiene que ser el que traia el alta').toBe(precarga.tipo);
        expect(ficha.moneda, 'La moneda tiene que ser la que traia el alta').toBe(precarga.moneda);
        expect(ficha.veMarkup, '"Ve el markup" tiene que quedar como lo traia el alta (tildado)').toBe(true);
      });

      await paso(page, `El usuario aparece en la solapa Usuarios de la agencia ${agencia}`, async () => {
        const filas = await usuarios.filasDelListado(agencia, datos.email);
        await adjuntarTexto('Fila del listado', filas.join(SALTO) || 'ninguna');
        expect(filas.length, `El listado de la agencia ${agencia} tiene que incluir el email ${datos.email}`).toBe(1);
        expect(filas[0]).toContain(`${datos.nombre} ${datos.apellido}`);
        expect(filas[0], 'La fila tiene que mostrar el estado').toMatch(/Habilitado/);
      });

      await paso(page, 'Un segundo alta con el mismo email es rechazada y no crea otra fila', async () => {
        await usuarios.abrirAlta(agencia);
        await usuarios.completar(repetido, clave);
        if (!(await usuarios.leer()).pais) await usuarios.ficha.locator('#au-country').selectOption({ label: 'Argentina' });
        const resultado = await usuarios.guardarAlta();
        await adjuntarTexto('Aviso del segundo alta', resultado.aviso || '(sin aviso)');
        segundo = resultado.id;
        expect(resultado.id, 'El segundo alta no tiene que crear un usuario').toBeNull();
        expect(resultado.aviso, 'Tiene que avisar que el email ya esta registrado').toMatch(/email/i);
        expect.soft(resultado.aviso, 'DIFERENCIA con el WebAdmin: el aviso nombraba al usuario que ya tiene ese email').toContain(`${id}`);
        expect(await usuarios.filasDelListado(agencia, datos.email), 'El listado tiene que seguir con una sola fila con ese email').toHaveLength(1);
      });

      await paso(page, 'El usuario nuevo entra al portal con su contrasena, en un navegador limpio', async () => {
        const acepto = await intentarIngresoAlPortalNuevo(await navegadorLimpio(), datos.usuario, clave);
        expect(acepto, 'El portal tiene que aceptar al usuario recien dado de alta').toBe(true);
      });

      await paso(page, 'Dar de baja el usuario: sale del listado y el portal deja de aceptarlo', async () => {
        await usuarios.darDeBaja(id);
        bajaHecha = true;
        expect(await usuarios.filasDelListado(agencia, datos.email), 'Despues de la baja el usuario no tiene que aparecer').toHaveLength(0);
        const acepto = await intentarIngresoAlPortalNuevo(await navegadorLimpio(), datos.usuario, clave);
        expect(acepto, 'El portal no tiene que aceptar a un usuario dado de baja').toBe(false);
      });
    } finally {
      await contextoPortal?.close().catch(() => {});
      if ((id && !bajaHecha) || segundo) {
        await paso(page, `Restaurar: dar de baja los usuarios con el email ${datos.email}`, async () => {
          if (id && !bajaHecha) await usuarios.darDeBaja(id);
          if (segundo) await usuarios.darDeBaja(segundo);
        });
      }
    }
  });
});
