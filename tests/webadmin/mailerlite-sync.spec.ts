import { test, expect } from '@playwright/test';

import { WebAdminUsuariosPage } from '../../pages/webadmin-usuarios.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import { esperarContacto, buscarContacto, borrarContacto, camposDelContacto } from '../../utils/mailerlite';
import candidatos from '../../data/candidatos.json';

const AGENCIA = candidatos.markups.agencia;
const AGENCIA_AMV = 1;
const DOMINIO = process.env.AMV_ALTA_USUARIO_DOMINIO ?? 'amv.travel';
const SALTO = String.fromCharCode(10);

/**
 * Idioma que el sistema manda hoy a MailerLite para cada pais. Es LINEA BASE, no la regla
 * escrita: la tabla dbo.Language guarda "Español", "English", "Portuguese" e "Italian",
 * y el sistema manda los cuatro traducidos al español. El 23/09/2026 se planteo al PM y
 * quedo pendiente de que lo defina con marketing ("entiendo que ellos ponen los idiomas en
 * español"). Si se corrige, este test se pone rojo aca y hay que actualizar la linea base.
 */
const IDIOMA_QUE_MANDA_HOY: Record<string, string> = {
  Argentina: 'Español',
  Brasil: 'Portugués',
};

/**
 * Grupo al que tienen que caer los contactos, cuando el ambiente tiene uno configurado en
 * el Config JSON de la fila de conexion. Si no se setea, el test no lo verifica: con el
 * grupo vacio la US dice que el contacto va a la lista general.
 */
const GRUPO_ESPERADO = process.env.MAILERLITE_GROUP_ID ?? '';

/**
 * WebAdmin — sincronizacion de los clientes con MailerLite.
 *
 * Es sensible porque toca una lista de contactos externa que usa marketing para enviar
 * campañas: un usuario que no sale cuando tiene que salir sigue recibiendo correo, y un
 * borrado de mas se lleva un contacto real. El disparador es el guardado del usuario, asi
 * que cualquier cambio en la pantalla de clientes puede mover la lista sin que se note.
 *
 * El contacto se verifica contra la API de MailerLite (utils/mailerlite.ts), no contra el
 * panel. Requiere MAILERLITE_API_KEY con la clave de la MISMA cuenta a la que apunta QA.
 *
 * Condiciones que gobiernan la sincronizacion (BusinessLogic/Integration/
 * MailerLiteSyncManager.cs, SyncableFilter): estado distinto de "Pendiente Validacion" y
 * de "Dado de baja", publicado, no borrado, agencia distinta de la 1 (AMV), tipo distinto
 * de Administrador, y la agencia publicada y no borrada. El enganche esta en
 * WebUserManager.Save (:446-452), despues de SaveChanges.
 *
 * El ambiente necesita los tres Settings prendidos: Advisor.Integration.MailerLite.Enabled,
 * Advisor.Integration.MailerLite.Allowed (manda por encima del Web.config) y
 * Advisor.Integration.MailerLite.ApiKey, que pisa la clave del Web.config. Sin el tercero
 * QA sincroniza contra la cuenta de produccion de marketing.
 *
 * Deja la cuenta como estaba: el finally da de baja el usuario y borra los contactos de
 * MailerLite, incluido el email viejo que queda del paso de cambio de direccion.
 */
test.describe('WebAdmin — sincronizacion con MailerLite', () => {
  // Pedido de Alan el 26/11/2026: fuera de la corrida mientras no haya clave de MailerLite en el
  // pipeline (la tiene el PM). Al cargar el secret MAILERLITE_API_KEY vuelven a correr solos.
  test.skip(!process.env.MAILERLITE_API_KEY, 'Sin MAILERLITE_API_KEY: los tests de MailerLite quedan fuera hasta tener la clave');

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  test('El alta sincroniza el contacto, y el pais, el email, el publicado, el estado y la baja lo actualizan', async ({ page }) => {
    test.setTimeout(900_000);
    const usuarios = new WebAdminUsuariosPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const email = `autoqa.mailerlite+${sello}@${DOMINIO}`;
    const emailNuevo = `autoqa.mailerlite+${sello}b@${DOMINIO}`;
    const datos = {
      nombre: 'AUTO-QA ANA',
      apellido: `MAILERLITE ${sello}`,
      email,
      usuario: `AQML${sello}`,
    };

    let id = 0;
    let bajaHecha = false;

    try {
      await paso(page, `Alta en la agencia ${AGENCIA.id} con pais Argentina: el contacto aparece en MailerLite con los datos del cliente`, async () => {
        await usuarios.abrirAlta(AGENCIA.id);
        await usuarios.completarDatos(datos);
        await usuarios.editar({ pais: 'Argentina' });
        await usuarios.habilitarContrasena();
        const alta = await usuarios.guardarAlta();
        expect(alta.aviso, 'El alta no tiene que ser rechazada').toBe('');
        expect(alta.id, 'Guardar tiene que redirigir a la ficha del usuario nuevo').not.toBeNull();
        id = alta.id!;

        const contacto = await esperarContacto(email, true);
        const campos = camposDelContacto(contacto!);
        await adjuntarTexto('Contacto en MailerLite', JSON.stringify(campos, null, 2));

        expect(campos.name, 'El nombre del cliente').toBe(datos.nombre);
        expect(campos.last_name, 'El apellido del cliente').toBe(datos.apellido);
        expect(campos.nombre, 'El campo "nombre" lleva nombre y apellido juntos').toBe(`${datos.nombre} ${datos.apellido}`);
        expect(campos.country, 'El pais del cliente').toBe('Argentina');
        expect(campos.company, 'La agencia del cliente').toContain(AGENCIA.nombre);
        expect(campos.agencia, '"company" y "agencia" llevan lo mismo').toBe(campos.company);
        expect(campos.tiene_usuario, 'La marca de cliente con usuario').toBe('Sí');
        expect(campos.id, 'El id del contacto es el del cliente, que es la clave de la sincronizacion').toBe(String(id));
        expect(campos.language, 'El idioma que corresponde al pais').toBe(IDIOMA_QUE_MANDA_HOY.Argentina);

        // El grupo de destino sale del Config JSON de la fila de conexion, no del test. Se
        // verifica solo cuando el ambiente tiene uno configurado: con el grupo vacio el
        // contacto va a la lista general, que es lo que la US contempla para ese caso.
        if (GRUPO_ESPERADO) {
          const ids = contacto!.grupos.map((g) => g.id);
          await adjuntarTexto('Grupos del contacto', JSON.stringify(contacto!.grupos, null, 2));
          expect(ids, `El contacto tiene que quedar en el grupo ${GRUPO_ESPERADO}`).toContain(GRUPO_ESPERADO);
        }
      });

      await paso(page, 'Cambiar el pais a Brasil: el contacto actualiza pais e idioma y sigue siendo uno solo', async () => {
        await usuarios.abrirDetalle(id);
        await usuarios.editar({ pais: 'Brasil' });
        await usuarios.guardarEdicion();

        const contacto = await esperarContacto(email, true);
        const campos = camposDelContacto(contacto!);
        await adjuntarTexto('Contacto con pais Brasil', JSON.stringify(campos, null, 2));
        expect(campos.country, 'El pais tiene que seguir al del cliente').toBe('Brasil');
        expect(campos.language, 'El idioma tiene que seguir al del pais').toBe(IDIOMA_QUE_MANDA_HOY.Brasil);
        expect(campos.id, 'Sigue siendo el mismo contacto, no uno nuevo').toBe(String(id));
      });

      await paso(page, 'Cambiar el email: el contacto viejo deja de existir y el nuevo queda con los mismos datos', async () => {
        const antes = camposDelContacto((await buscarContacto(email))!);
        await usuarios.abrirDetalle(id);
        await usuarios.editar({ email: emailNuevo });
        await usuarios.guardarEdicion();

        const contacto = await esperarContacto(emailNuevo, true);
        await esperarContacto(email, false);
        const campos = camposDelContacto(contacto!);
        await adjuntarTexto('Contacto con el email nuevo', JSON.stringify(campos, null, 2));
        expect(campos.name, 'El nombre viaja al contacto nuevo').toBe(antes.name);
        expect(campos.last_name, 'El apellido viaja al contacto nuevo').toBe(antes.last_name);
        expect(campos.country, 'El pais viaja al contacto nuevo').toBe(antes.country);
        expect(campos.agencia, 'La agencia viaja al contacto nuevo').toBe(antes.agencia);
        expect(campos.language, 'El idioma viaja al contacto nuevo').toBe(antes.language);
      });

      await paso(page, 'Despublicar saca el contacto y volver a publicar lo trae de nuevo', async () => {
        await usuarios.abrirDetalle(id);
        await usuarios.editar({ publicado: false });
        await usuarios.guardarEdicion();
        await esperarContacto(emailNuevo, false);

        await usuarios.abrirDetalle(id);
        await usuarios.editar({ publicado: true });
        await usuarios.guardarEdicion();
        const contacto = await esperarContacto(emailNuevo, true);
        expect(camposDelContacto(contacto!).id, 'Al volver a publicar el contacto vuelve con sus datos').toBe(String(id));
      });

      await paso(page, '"Pendiente Validacion" saca el contacto, "Activo" lo trae y "Pendiente blanqueo de clave" lo deja', async () => {
        await usuarios.abrirDetalle(id);
        await usuarios.editar({ estado: 'Pendiente Validación' });
        await usuarios.guardarEdicion();
        await esperarContacto(emailNuevo, false);

        await usuarios.abrirDetalle(id);
        await usuarios.editar({ estado: 'Activo' });
        await usuarios.guardarEdicion();
        await esperarContacto(emailNuevo, true);

        // Control de la serie: si los dos anteriores pasaran por una integracion caida,
        // este tambien daria "no esta" y el escenario entero seria un falso verde.
        await usuarios.abrirDetalle(id);
        await usuarios.editar({ estado: 'Pendiente blanqueo de clave' });
        await usuarios.guardarEdicion();
        const contacto = await esperarContacto(emailNuevo, true);
        expect(contacto, 'Ese estado no tiene que sacar al contacto de la lista').not.toBeNull();
      });

      await paso(page, 'Borrar el cliente desde el listado lo saca de MailerLite', async () => {
        const borro = await usuarios.darDeBaja(AGENCIA.id, emailNuevo);
        expect(borro, 'El cliente tenia que estar en el listado para poder borrarlo').toBe(true);
        bajaHecha = true;
        await esperarContacto(emailNuevo, false);
      });
    } finally {
      if (id && !bajaHecha) {
        await paso(page, 'Restaurar: dar de baja el cliente de prueba', async () => {
          await usuarios.darDeBaja(AGENCIA.id, emailNuevo).catch(() => false);
          await usuarios.darDeBaja(AGENCIA.id, email).catch(() => false);
        });
      }
      // Los dos emails: el cambio de direccion deja el viejo dado de baja y el nuevo vivo.
      await borrarContacto(email).catch(() => {});
      await borrarContacto(emailNuevo).catch(() => {});
    }
  });

  test('Un cliente de la agencia AMV no se sincroniza', async ({ page }) => {
    test.setTimeout(600_000);
    const usuarios = new WebAdminUsuariosPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const email = `autoqa.mailerlite.amv+${sello}@${DOMINIO}`;
    const datos = {
      nombre: 'AUTO-QA ANA',
      apellido: `MAILERLITE AMV ${sello}`,
      email,
      usuario: `AQMA${sello}`,
    };

    let id = 0;

    try {
      await paso(page, `Alta en la agencia AMV (${AGENCIA_AMV}): el cliente se guarda y no aparece en MailerLite`, async () => {
        await usuarios.abrirAlta(AGENCIA_AMV);
        await usuarios.completarDatos(datos);
        await usuarios.habilitarContrasena();
        const alta = await usuarios.guardarAlta();
        expect(alta.aviso, 'El alta no tiene que ser rechazada').toBe('');
        expect(alta.id, 'El cliente se tiene que guardar igual').not.toBeNull();
        id = alta.id!;

        await esperarContacto(email, false, 10_000);
        await adjuntarTexto('Resultado', [
          `Cliente ${id} creado en la agencia ${AGENCIA_AMV}.`,
          'No aparece contacto en MailerLite, que es lo esperado para la agencia propia.',
        ].join(SALTO));
      });

      await paso(page, 'Editarlo tampoco lo sincroniza: no era sincronizable y sigue sin serlo', async () => {
        await usuarios.abrirDetalle(id);
        await usuarios.editar({ pais: 'Brasil' });
        await usuarios.guardarEdicion();
        await esperarContacto(email, false, 10_000);
      });
    } finally {
      if (id) {
        await paso(page, 'Restaurar: dar de baja el cliente de prueba', async () => {
          await usuarios.darDeBaja(AGENCIA_AMV, email).catch(() => false);
        });
      }
      await borrarContacto(email).catch(() => {});
    }
  });
});
