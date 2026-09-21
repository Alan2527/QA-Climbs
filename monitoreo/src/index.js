/**
 * Monitoreo de produccion de AMV Travel — Cloudflare Worker.
 *
 * Dos tareas programadas (wrangler.toml):
 *   cada 5 minutos     chequea los sitios y avisa a Teams si alguno se cae o vuelve
 *   una vez por dia    manda el resumen que confirma que el monitoreo sigue vivo
 *
 * Y dos rutas:
 *   GET  /estado       el estado actual en JSON, para el tablero (no expone secretos)
 *   POST /probar       manda una tarjeta de prueba a Teams; pide el header X-Clave
 *
 * Secretos (wrangler secret put): TEAMS_WEBHOOK y CLAVE.
 * KV: ESTADO, con una sola clave "estado".
 */
import { SITIOS } from './sitios.js';
import { chequear, evaluar, cambioRelevante, mensajeDeAvisos, mensajeDiario, tarjetaTeams, hora } from './monitor.js';

const CRON_DIARIO = '0 12 * * *'; // 9:00 en Argentina

async function leerEstado(env) {
  return (await env.ESTADO.get('estado', 'json')) ?? {};
}

async function avisarTeams(env, tarjeta) {
  if (!env.TEAMS_WEBHOOK) throw new Error('Falta el secreto TEAMS_WEBHOOK');
  const r = await fetch(env.TEAMS_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tarjeta),
  });
  // Workflows responde 202; el webhook clasico, 200.
  if (!r.ok) throw new Error(`Teams respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function pasada(env) {
  const ahora = Date.now();
  const activos = SITIOS.filter((s) => s.activo);
  const resultados = Object.fromEntries(await Promise.all(activos.map(async (s) => [s.id, await chequear(s)])));
  const anterior = await leerEstado(env);
  const { estado, avisos } = evaluar(anterior, resultados, ahora);

  const mensaje = mensajeDeAvisos(avisos, SITIOS, ahora);
  if (mensaje) await avisarTeams(env, mensaje);
  // Se guarda despues de avisar: si Teams falla, la pasada siguiente vuelve a intentarlo.
  if (cambioRelevante(anterior, estado)) await env.ESTADO.put('estado', JSON.stringify(estado));

  console.log(JSON.stringify({ ahora, resultados, avisos: avisos.map((a) => `${a.tipo}:${a.id}`) }));
}

export default {
  async scheduled(evento, env, ctx) {
    if (evento.cron === CRON_DIARIO) {
      ctx.waitUntil(avisarTeams(env, mensajeDiario(await leerEstado(env), SITIOS, Date.now())));
      return;
    }
    ctx.waitUntil(pasada(env));
  },

  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/estado') {
      const estado = await leerEstado(env);
      const sitios = SITIOS.filter((s) => s.activo).map((s) => ({
        id: s.id, nombre: s.nombre, url: s.url,
        caido: !!estado[s.id]?.caido,
        desde: estado[s.id]?.desde ?? null,
        motivo: estado[s.id]?.motivo ?? null,
      }));
      return Response.json({ sitios, generado: Date.now() }, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
      });
    }

    if (req.method === 'POST' && url.pathname === '/probar') {
      if (!env.CLAVE || req.headers.get('X-Clave') !== env.CLAVE) return new Response('No autorizado', { status: 401 });
      await avisarTeams(env, tarjetaTeams('Prueba del monitoreo', 'Accent',
        ['Si ves este mensaje, los avisos de caída llegan a este canal.'], `Monitoreo AMV · ${hora(Date.now())}`));
      return new Response('Enviado');
    }

    return new Response('Monitoreo AMV Travel. Estado en /estado', { status: 404 });
  },
};
