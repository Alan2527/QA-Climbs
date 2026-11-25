import { expect } from '@playwright/test';

/**
 * Cliente mínimo de la API de MailerLite para los tests.
 *
 * El contacto se verifica contra la API y no contra el panel: el panel exige una sesión
 * propia, cambia de maquetado sin aviso y no permite leer campo por campo. La API devuelve
 * el contacto entero y es lo mismo que mira un operador en Subscribers.
 *
 * La clave sale de MAILERLITE_API_KEY y nunca se escribe en el test ni en el reporte. Es
 * la misma cuenta a la que apunta QA: la fila de Setting Advisor.Integration.MailerLite.ApiKey
 * manda por encima del Web.config, así que el ambiente y el test tienen que usar la misma.
 */

const BASE = 'https://connect.mailerlite.com/api/';

export type ContactoMailerLite = {
  email: string;
  status: string;
  fields: Record<string, string | null>;
  /** Grupos a los que MailerLite tiene asignado el contacto, con su id y su nombre. */
  grupos: { id: string; name: string }[];
};

function clave(): string {
  const valor = process.env.MAILERLITE_API_KEY;
  expect(valor, 'Falta MAILERLITE_API_KEY en el entorno: es la clave de la cuenta contra la que sincroniza QA').toBeTruthy();
  return valor!;
}

async function pedir(metodo: string, ruta: string): Promise<Response> {
  return fetch(new URL(ruta, BASE), {
    method: metodo,
    headers: {
      Authorization: `Bearer ${clave()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
}

/** El contacto con ese email, o null si MailerLite responde 404 (no existe). */
export async function buscarContacto(email: string): Promise<ContactoMailerLite | null> {
  const respuesta = await pedir('GET', `subscribers/${encodeURIComponent(email)}`);
  if (respuesta.status === 404) return null;
  expect(respuesta.ok, `MailerLite respondió ${respuesta.status} al buscar ${email}`).toBe(true);
  const cuerpo = await respuesta.json();
  const dato = cuerpo?.data;
  return {
    email: dato.email,
    status: dato.status,
    fields: dato.fields ?? {},
    grupos: (dato.groups ?? []).map((g: any) => ({ id: String(g.id), name: g.name })),
  };
}

/**
 * Espera a que el contacto exista (o deje de existir) y lo devuelve.
 *
 * La sincronización sale dentro del mismo guardado, así que al volver el PostBack el
 * contacto ya tendría que estar; el reintento cubre la latencia de la API, no un proceso
 * diferido. Si se agota, el error dice qué se esperaba, para que el rojo se lea solo.
 */
export async function esperarContacto(
  email: string,
  debeExistir: boolean,
  espera = 20_000,
): Promise<ContactoMailerLite | null> {
  const limite = Date.now() + espera;
  let ultimo: ContactoMailerLite | null = null;
  do {
    ultimo = await buscarContacto(email);
    if (!!ultimo === debeExistir) return ultimo;
    await new Promise((seguir) => setTimeout(seguir, 1_000));
  } while (Date.now() < limite);

  expect(!!ultimo, debeExistir
    ? `El contacto ${email} tenía que estar en MailerLite y no apareció en ${espera / 1000}s`
    : `El contacto ${email} tenía que salir de MailerLite y sigue estando`).toBe(debeExistir);
  return ultimo;
}

/** Borra el contacto si existe. Para dejar la cuenta como estaba al terminar el test. */
export async function borrarContacto(email: string): Promise<void> {
  const contacto = await buscarContacto(email).catch(() => null);
  if (!contacto) return;
  const encontrado = await pedir('GET', `subscribers/${encodeURIComponent(email)}`);
  const id = (await encontrado.json())?.data?.id;
  if (id) await pedir('DELETE', `subscribers/${encodeURIComponent(id)}`);
}

/** Los campos que la US autoriza a viajar, en el orden en que los nombra. */
export function camposDelContacto(contacto: ContactoMailerLite) {
  const f = contacto.fields;
  return {
    name: f.name ?? '',
    last_name: f.last_name ?? '',
    nombre: f.nombre ?? '',
    country: f.country ?? '',
    company: f.company ?? '',
    agencia: f.agencia ?? '',
    language: f.language ?? '',
    tiene_usuario: f.tiene_usuario ?? '',
    id: f.id ?? '',
  };
}
