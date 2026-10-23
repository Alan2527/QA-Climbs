/**
 * Logica del monitoreo, sin nada de Cloudflare: se prueba en Node con un fetch
 * y un reloj falsos (test/monitor.test.mjs).
 */
import {
  FALLAS_PARA_AVISAR, REPETIR_AVISO_MIN, TIMEOUT_MS, MAX_BYTES_A_LEER,
  INTENTOS_POR_CHEQUEO, ESPERA_REINTENTO_MS, UMBRAL_GRUPOS_CAIDA_MASIVA,
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
 * parpadeo de red (un 522 o un timeout suelto) no cuenta. Devuelve el ultimo resultado
 * con cuantos intentos hicieron falta. Nunca tira. `dormir` se inyecta para los tests.
 */
export async function chequear(sitio, fetchImpl = fetch, dormir = esperar) {
  let ultimo;
  for (let intento = 1; intento <= INTENTOS_POR_CHEQUEO; intento++) {
    ultimo = await unChequeo(sitio, fetchImpl);
    if (ultimo.ok) return { ...ultimo, intentos: intento };
    if (intento < INTENTOS_POR_CHEQUEO) await dormir(ESPERA_REINTENTO_MS);
  }
  return { ...ultimo, intentos: INTENTOS_POR_CHEQUEO };
}

/** Un solo intento contra el sitio. Nunca tira: cualquier error es un caido con su motivo. */
async function unChequeo(sitio, fetchImpl = fetch) {
  const inicio = Date.now();
  try {
    const r = await fetchImpl(sitio.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
 * Caida masiva cruzada: en una misma pasada caen sitios de muchos grupos (clientes)
 * distintos. Eso casi siempre es la red del monitoreo —el Worker no llega a ningun
 * lado por un rato— y no que se cayeran a la vez servidores sin relacion entre si. En
 * cambio, si caen varias direcciones de UN solo cliente, es una caida real suya y no
 * entra aca. Devuelve cuantos grupos y cuantos sitios cayeron, para el aviso suave.
 */
export function caidaMasiva(resultados, sitios, umbral = UMBRAL_GRUPOS_CAIDA_MASIVA) {
  const grupos = new Set();
  let sitiosCaidos = 0;
  for (const [id, res] of Object.entries(resultados)) {
    if (res.ok) continue;
    sitiosCaidos++;
    grupos.add(sitios.find((s) => s.id === id)?.grupo ?? id);
  }
  return { masiva: grupos.size >= umbral, grupos: grupos.size, sitiosCaidos };
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

/**
 * Aviso suave de caida masiva: en vez de N "se cayo" (que asusta y suele ser falso),
 * un unico mensaje que dice que probablemente sea la red del monitoreo, no produccion.
 */
export function mensajeMasivo(grupos, sitiosCaidos, ahora) {
  return tarjetaTeams(
    '⚠️ Posible problema de red del monitoreo',
    'Warning',
    [
      `${sitiosCaidos} sitios de ${grupos} clientes distintos no respondieron a la vez.`,
      'Cuando caen muchos sitios no relacionados al mismo tiempo, casi siempre es la red del monitoreo (Cloudflare) y no una caida real de produccion. Si dudás, verificá a mano.',
    ],
    `Monitoreo AMV · ${hora(ahora)}`,
  );
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
