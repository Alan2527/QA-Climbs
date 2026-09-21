/**
 * Logica del monitoreo, sin nada de Cloudflare: se prueba en Node con un fetch
 * y un reloj falsos (test/monitor.test.mjs).
 */
import { FALLAS_PARA_AVISAR, REPETIR_AVISO_MIN, TIMEOUT_MS } from './sitios.js';

/** Consulta un sitio. Nunca tira: cualquier error es un sitio caido con su motivo. */
export async function chequear(sitio, fetchImpl = fetch) {
  const inicio = Date.now();
  try {
    const r = await fetchImpl(sitio.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'AMV-Monitoreo/1.0 (+Climbs QA)' },
    });
    const ms = Date.now() - inicio;
    if (r.status >= 400) return { ok: false, status: r.status, ms, motivo: `respondió ${r.status}` };
    if (sitio.contiene) {
      const cuerpo = await r.text();
      if (!cuerpo.includes(sitio.contiene)) {
        return { ok: false, status: r.status, ms, motivo: 'respondió, pero sin la pantalla de ingreso' };
      }
    }
    return { ok: true, status: r.status, ms };
  } catch (e) {
    const ms = Date.now() - inicio;
    const motivo = e?.name === 'TimeoutError' || e?.name === 'AbortError'
      ? `no respondió en ${Math.round(TIMEOUT_MS / 1000)} s`
      : `no se pudo conectar (${e?.message ?? e})`;
    return { ok: false, status: null, ms, motivo };
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

/** Arma un solo mensaje con todos los avisos de la pasada. */
export function mensajeDeAvisos(avisos, sitios, ahora) {
  if (!avisos.length) return null;
  const nombre = (id) => sitios.find((s) => s.id === id)?.nombre ?? id;
  const url = (id) => sitios.find((s) => s.id === id)?.url ?? '';
  const hayCaidas = avisos.some((a) => a.tipo !== 'volvio');
  const lineas = avisos.map((a) => {
    if (a.tipo === 'cayo') return `🔴 **${nombre(a.id)} se cayó**: ${a.motivo}. ${url(a.id)}`;
    if (a.tipo === 'sigue') return `🔴 **${nombre(a.id)} sigue caído** hace ${duracion(a.minutos)}: ${a.motivo}.`;
    return `🟢 **${nombre(a.id)} volvió**. Estuvo caído ${duracion(a.minutos)}.`;
  });
  const titulo = hayCaidas ? 'Producción: hay sitios caídos' : 'Producción: todo volvió a responder';
  return tarjetaTeams(titulo, hayCaidas ? 'Attention' : 'Good', lineas, `Monitoreo AMV · ${hora(ahora)}`);
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
