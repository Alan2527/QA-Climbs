import { Browser, expect } from '@playwright/test';
import candidatos from '../data/candidatos.json';

/**
 * El link de autologin del pasajero AUTO-QA del SIX, pedido al sistema en cada corrida.
 *
 * El link no vence: la API lo firma con su clave interna y el SaltKey del pasajero. Pero
 * "Nueva clave" en el rooming (BO viejo o app nueva) renueva el SaltKey y lo invalida, sin
 * dejar rastro. El 27/11/2026 el link fijo del secret (AMV_SIX_AUTOLOGIN_URL) habia quedado
 * viejo y todos los tests del SIX caian al login con "Invalid token.".
 *
 * Por eso se pide el link vigente al BO viejo, con la misma consulta que usa el modal SIX del
 * rooming para mostrarlo: sixcredentials con newPassword=false, que solo lee (no genera clave).
 * Se entra con el usuario de BO de la suite (BO_USER / BO_PASS). Si el BO no responde, se usa
 * AMV_SIX_AUTOLOGIN_URL como respaldo.
 *
 * El link es una credencial: no se adjunta, no se loguea y no se escribe en disco. La consulta
 * devuelve tambien la clave del pasajero en claro: no sale de la pagina del BO.
 */

const FORMA = /^https:\/\/[^/]+\/autologin\?token=.+/;
const PASAJERO = candidatos.six.pasajeroAppId;

let enCurso: Promise<string> | undefined;
let vigente: string | undefined;

async function pedirAlBackOffice(browser: Browser): Promise<string> {
  const usuario = process.env.BO_USER;
  const clave = process.env.BO_PASS;
  if (!usuario || !clave) throw new Error('faltan BO_USER / BO_PASS en el entorno');
  const base = process.env.AMV_BO_URL || 'https://qa.bo.amv.travel';
  // Contexto propio, de escritorio y sin sesion: el de los tests del SIX es mobile y no
  // tiene que quedar con la sesion del BO.
  const contexto = await browser.newContext({
    storageState: { cookies: [], origins: [] }, viewport: { width: 1920, height: 1080 }, isMobile: false, hasTouch: false,
    deviceScaleFactor: 1,
  });
  try {
    const page = await contexto.newPage();
    await page.goto(`${base}/Login.aspx`, { timeout: 90_000 });
    await page.locator('#txtUser').fill(usuario);
    await page.locator('#txtPassword').fill(clave);
    await page.locator('#btnLogin').click();
    await page.waitForURL((u) => !u.pathname.toLowerCase().includes('login'), { timeout: 90_000 });
    // FILEWEBSERVICEPATH lo define BOMaster.Master: es la misma ruta que usa el modal SIX.
    await page.waitForFunction(() => typeof (window as any).FILEWEBSERVICEPATH === 'string', undefined, { timeout: 60_000 });
    const r = await page.evaluate(async (id) => {
      const x = await fetch(`${(window as any).FILEWEBSERVICEPATH}/sixcredentials/?userAppId=${id}&newPassword=false`);
      const j = await x.json().catch(() => null);
      // Solo el link y el motivo si no lo hay: la clave del pasajero no sale de aca.
      return { http: x.status, ok: !!j?.ok, url: (j?.autologinUrl as string) || '', error: (j?.autologinError || j?.message || '') as string };
    }, PASAJERO);
    if (!r.ok || !r.url) throw new Error(`el BO no devolvio el link (HTTP ${r.http}${r.error ? `: ${r.error}` : ''})`);
    if (!FORMA.test(r.url)) throw new Error('el BO devolvio un link con otra forma que https://.../autologin?token=...');
    return r.url;
  } finally {
    await contexto.close();
  }
}

/** Deja listo el link vigente para linkDelSix(). Va en el beforeAll de cada spec del SIX; una vez por proceso. */
export async function prepararLinkDelSix(browser: Browser): Promise<void> {
  if (vigente) return;
  enCurso ??= pedirAlBackOffice(browser).catch((e: Error) => {
    enCurso = undefined;
    const respaldo = process.env.AMV_SIX_AUTOLOGIN_URL;
    if (respaldo && FORMA.test(respaldo)) {
      console.warn(`[SIX] No se pudo pedir el link vigente al BO (${e.message}); se usa AMV_SIX_AUTOLOGIN_URL.`);
      return respaldo;
    }
    throw new Error(`No se pudo obtener el link de autologin del pasajero ${PASAJERO}: ${e.message}. Tampoco hay un AMV_SIX_AUTOLOGIN_URL valido de respaldo.`);
  });
  vigente = await enCurso;
}

/** El link de autologin del pasajero AUTO-QA (prepararLinkDelSix tiene que haber corrido antes). */
export function linkDelSix(): string {
  expect(vigente, 'El link del SIX no esta listo: falta prepararLinkDelSix(browser) en el beforeAll del spec').toMatch(FORMA);
  return vigente!;
}
