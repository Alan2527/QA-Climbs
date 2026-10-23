/**
 * Logica del monitoreo, sin nada de Cloudflare: se prueba en Node con un fetch
 * y un reloj falsos (test/monitor.test.mjs).
 */
import {
  FALLAS_PARA_AVISAR, REPETIR_AVISO_MIN, TIMEOUT_MS, MAX_BYTES_A_LEER,
  INTENTOS_POR_CHEQUEO, ESPERA_REINTENTO_MS, TIMEOUT_REINTENTO_MS, CONTROLES, TIMEOUT_CONTROL_MS,
  PASADAS_SIN_SALIDA_PARA_AVISAR, AGRUPAR_DESDE,
} from './sitios.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Busca un texto en el cuerpo de la respuesta leyendolo de a partes, y corta apenas
 * lo encuentra o al llegar a `max` bytes. Asi no se decodifica la pagina entera:
 * con muchos sitios, eso es lo que consume el tiempo de procesador del plan gratis.
 */
export async function cuerpoContiene(respuesta, texto, max = MAX_BYTES_A_LEER) {
  if (!respuesta.body) return (await respuesta.text()).includes(texto);
  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder();
  let leido = '';
  let bytes = 0;
  try {
    while (bytes < max) {
      const { done, value } = await lector.read();
      if (done) break;
      bytes += value.byteLength;
      leido += decodificador.decode(value, { stream: true });
      if (leido.includes(texto)) return true;
      // Solo hace falta guardar la cola, por si el texto quedo partido entre dos partes.
      leido = leido.slice(-texto.length);
    }
    return false;
  } finally {
    lector.cancel().catch(() => {});
  }
}

/**
 * Consulta un sitio y, si falla, reintenta en el acto antes de darlo por caido: un
 * parpadeo de red (un 522 o un pedido que quedo colgado) no cuenta. El reintento tiene un
 * limite mas corto (TIMEOUT_REINTENTO_MS) para que un servidor caido no alargue la pasada.
 * Devuelve el ultimo resultado con cuantos intentos hicieron falta. Nunca tira.
 * `dormir` se inyecta para los tests.
 */
export async function chequear(sitio, fetchImpl = fetch, dormir = esperar) {
  let ultimo;
  for (let intento = 1; intento <= INTENTOS_POR_CHEQUEO; intento++) {
    ultimo = await unChequeo(sitio, fetchImpl, intento === 1 ? TIMEOUT_MS : TIMEOUT_REINTENTO_MS);
    if (ultimo.ok) return { ...ultimo, intentos: intento };
    if (intento < INTENTOS_POR_CHEQUEO) await dormir(ESPERA_REINTENTO_MS);
  }
  const motivo = INTENTOS_POR_CHEQUEO > 1 ? `${ultimo.motivo} (falló en los ${INTENTOS_POR_CHEQUEO} intentos)` : ultimo.motivo;
  return { ...ultimo, motivo, intentos: INTENTOS_POR_CHEQUEO };
}

/** Un solo intento contra el sitio. Nunca tira: cualquier error es un caido con su motivo. */
async function unChequeo(sitio, fetchImpl = fetch, limiteMs = TIMEOUT_MS) {
  const inicio = Date.now();
  try {
    const r = await fetchImpl(sitio.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(limiteMs),
      headers: { 'User-Agent': 'AMV-Monitoreo/1.0 (+Climbs QA)' },
    });
    const ms = Date.now() - inicio;
    if (r.status >= 400) {
      r.body?.cancel().catch(() => {});
      return { ok: false, status: r.status, ms, motivo: `respondió ${r.status}` };
    }
    if (sitio.contiene && !(await cuerpoContiene(r, sitio.contiene))) {
      return { ok: false, status: r.status, ms, motivo: 'respondió, pero sin el contenido esperado' };
    }
    if (!sitio.contiene) r.body?.cancel().catch(() => {});
    return { ok: true, status: r.status, ms };
  } catch (e) {
    const ms = Date.now() - inicio;
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    const motivo = timeout
      ? `no respondió en ${Math.round(limiteMs / 1000)} s`
      : `no se pudo conectar (${e?.message ?? e})`;
    return { ok: false, status: null, ms, motivo, ...(timeout ? { timeout: true } : {}) };
  }
}

/**
 * Cruza el estado anterior con los resultados de esta pasada.
 *
 * Avisa solo cuando cambia algo: "se cayo" a la segunda falla seguida, "sigue
 * caido" cada REPETIR_AVISO_MIN, y "volvio" con cuanto estuvo caido. Una falla
 * suelta que se recupera sola no genera ningun aviso.
 */
export function evaluar(estadoAnterior, resultados, ahora) {
  const estado = {};
  const avisos = [];
  for (const [id, res] of Object.entries(resultados)) {
    const prev = estadoAnterior?.[id] ?? { caido: false, fallas: 0 };
    const s = { ...prev, ultimoChequeo: ahora, ultimoMs: res.ms };

    if (res.ok) {
      if (prev.caido) avisos.push({ tipo: 'volvio', id, minutos: Math.round((ahora - prev.desde) / 60000) });
      s.caido = false; s.fallas = 0; s.desde = null; s.primeraFalla = null; s.ultimoAviso = null; s.motivo = null;
    } else {
      s.fallas = (prev.fallas ?? 0) + 1;
      s.motivo = res.motivo;
      if (s.fallas === 1) s.primeraFalla = ahora;
      if (!prev.caido && s.fallas >= FALLAS_PARA_AVISAR) {
        s.caido = true;
        // Se cuenta desde la primera falla, no desde que se aviso.
        s.desde = s.primeraFalla ?? ahora;
        s.ultimoAviso = ahora;
        avisos.push({ tipo: 'cayo', id, motivo: res.motivo });
      } else if (prev.caido && ahora - prev.ultimoAviso >= REPETIR_AVISO_MIN * 60000) {
        s.ultimoAviso = ahora;
        avisos.push({ tipo: 'sigue', id, motivo: res.motivo, minutos: Math.round((ahora - prev.desde) / 60000) });
      }
    }
    estado[id] = s;
  }
  return { estado, avisos };
}

/**
 * ¿El monitoreo tiene salida a internet? Consulta los sitios de control (fuera del
 * servidor de produccion) y alcanza con que responda uno. Si no responde ninguno, lo que
 * fallo es la red del monitoreo y las caidas de esa pasada no prueban nada. Nunca tira.
 */
export async function chequearControl(fetchImpl = fetch, controles = CONTROLES) {
  for (const url of controles) {
    try {
      const r = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_CONTROL_MS) });
      r.body?.cancel().catch(() => {});
      if (r.status < 400) return true;
    } catch { /* se prueba el siguiente */ }
  }
  return false;
}

/**
 * Decide la pasada segun el control. Sin salida a internet, la pasada se saltea: no se
 * cuenta ninguna falla de produccion. Si dura PASADAS_SIN_SALIDA_PARA_AVISAR pasadas se
 * avisa una sola vez que el monitoreo esta ciego, y al recuperar la salida, que volvio.
 */
export function aplicarControl(controlAnterior, controlOk) {
  const prev = controlAnterior ?? { fallas: 0, avisado: false };
  if (controlOk) {
    return { saltear: false, control: { fallas: 0, avisado: false }, aviso: prev.avisado ? 'recupero' : null };
  }
  const fallas = (prev.fallas ?? 0) + 1;
  const avisar = !prev.avisado && fallas >= PASADAS_SIN_SALIDA_PARA_AVISAR;
  return { saltear: true, control: { fallas, avisado: prev.avisado || avisar }, aviso: avisar ? 'sin-salida' : null };
}

/**
 * Corre `fn` sobre todos los elementos con a lo sumo `n` a la vez, y devuelve los
 * resultados en el mismo orden. Todos los sitios estan en el mismo servidor: asi no se
 * le manda una rafaga de pedidos simultaneos.
 */
export async function enLotes(items, n, fn) {
  const resultados = new Array(items.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultados[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, trabajador));
  return resultados;
}

/**
 * Lo que se guarda en KV. El plan gratis permite 1.000 escrituras por dia: se
 * escribe solo si cambio algo mas que la hora y la demora del chequeo, asi que
 * con todo arriba no se escribe nunca.
 */
export function cambioRelevante(anterior, nuevo) {
  const limpiar = (e) => JSON.stringify(Object.fromEntries(Object.entries(e ?? {})
    .map(([id, s]) => [id, { ...s, ultimoChequeo: undefined, ultimoMs: undefined }])));
  return limpiar(anterior) !== limpiar(nuevo);
}

export function duracion(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function hora(ms) {
  return new Date(ms).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Mensaje para Teams como Adaptive Card. Es el formato que aceptan tanto el
 * webhook entrante clasico como el flujo de Workflows ("Post to a channel when a
 * webhook request is received"), que es el que Microsoft deja como reemplazo.
 */
export function tarjetaTeams(titulo, color, lineas, pie) {
  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: titulo, weight: 'Bolder', size: 'Medium', color, wrap: true },
          ...lineas.map((l) => ({ type: 'TextBlock', text: l, wrap: true, spacing: 'Small' })),
          ...(pie ? [{ type: 'TextBlock', text: pie, isSubtle: true, size: 'Small', wrap: true }] : []),
        ],
      },
    }],
  };
}

/**
 * Arma un solo mensaje con todos los avisos de la pasada. Si muchos sitios cambian juntos
 * (AGRUPAR_DESDE o mas del mismo tipo), van en una linea con la lista de nombres: comparten
 * el servidor, y doce lineas iguales no dicen mas que una.
 */
export function mensajeDeAvisos(avisos, sitios, ahora) {
  if (!avisos.length) return null;
  const nombre = (id) => sitios.find((s) => s.id === id)?.nombre ?? id;
  const url = (id) => sitios.find((s) => s.id === id)?.url ?? '';
  const hayCaidas = avisos.some((a) => a.tipo !== 'volvio');
  const lineas = [];
  for (const tipo of ['cayo', 'sigue', 'volvio']) {
    const delTipo = avisos.filter((a) => a.tipo === tipo);
    if (!delTipo.length) continue;
    if (delTipo.length >= AGRUPAR_DESDE) {
      const nombres = delTipo.map((a) => nombre(a.id)).join(', ');
      if (tipo === 'cayo') lineas.push(`🔴 **${delTipo.length} sitios se cayeron a la vez** (${delTipo[0].motivo}): ${nombres}.`);
      else if (tipo === 'sigue') lineas.push(`🔴 **${delTipo.length} sitios siguen caídos** hace ${duracion(delTipo[0].minutos)}: ${nombres}.`);
      else lineas.push(`🟢 **${delTipo.length} sitios volvieron**. Estuvieron caídos ${duracion(delTipo[0].minutos)}: ${nombres}.`);
      continue;
    }
    for (const a of delTipo) {
      if (tipo === 'cayo') lineas.push(`🔴 **${nombre(a.id)} se cayó**: ${a.motivo}. ${url(a.id)}`);
      else if (tipo === 'sigue') lineas.push(`🔴 **${nombre(a.id)} sigue caído** hace ${duracion(a.minutos)}: ${a.motivo}.`);
      else lineas.push(`🟢 **${nombre(a.id)} volvió**. Estuvo caído ${duracion(a.minutos)}.`);
    }
  }
  const titulo = hayCaidas ? 'Producción: hay sitios caídos' : 'Producción: todo volvió a responder';
  return tarjetaTeams(titulo, hayCaidas ? 'Attention' : 'Good', lineas, `Monitoreo AMV · ${hora(ahora)}`);
}

/**
 * Aviso del propio monitoreo, no de produccion: se quedo sin salida a internet (no llega
 * ni a los sitios de control) o la recupero. Mientras no tiene salida, no ve produccion.
 */
export function mensajeControl(aviso, ahora) {
  const pie = `Monitoreo AMV · ${hora(ahora)}`;
  if (aviso === 'sin-salida') {
    return tarjetaTeams('⚠️ El monitoreo no tiene salida a internet', 'Warning', [
      `Hace ${PASADAS_SIN_SALIDA_PARA_AVISAR * 5} minutos que no llega ni a los sitios de control (Google), que están fuera del servidor de producción.`,
      'Mientras dure, el monitoreo no puede ver producción. No es una caída de producción.',
    ], pie);
  }
  return tarjetaTeams('🟢 El monitoreo volvió a tener salida a internet', 'Good',
    ['Vuelve a chequear producción normalmente.'], pie);
}

/** Resumen diario: confirma que el monitoreo sigue vivo. Si un dia no llega, el que se cayo es el vigilante. */
export function mensajeDiario(estado, sitios, ahora) {
  const activos = sitios.filter((s) => s.activo);
  const caidos = activos.filter((s) => estado?.[s.id]?.caido);
  const lineas = activos.map((s) => {
    const e = estado?.[s.id];
    if (!e) return `⚪ ${s.nombre}: sin chequeos todavía.`;
    if (e.caido) return `🔴 ${s.nombre}: caído desde ${hora(e.desde)} (${e.motivo}).`;
    return `🟢 ${s.nombre}: responde${e.ultimoMs != null ? ` en ${(e.ultimoMs / 1000).toFixed(1)} s` : ''}.`;
  });
  const titulo = caidos.length ? `Monitoreo activo: ${caidos.length} sitio${caidos.length > 1 ? 's' : ''} caído${caidos.length > 1 ? 's' : ''}` : 'Monitoreo activo: todo responde';
  return tarjetaTeams(titulo, caidos.length ? 'Attention' : 'Good', lineas,
    `Chequeo cada 5 minutos. Si este resumen no llega algún día, revisar el Worker. · ${hora(ahora)}`);
}
