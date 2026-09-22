# Monitoreo de producción — AMV Travel

Worker de Cloudflare que cada 5 minutos consulta el portal, el WebAdmin y el
BackOffice de producción y avisa a un canal de Teams cuando alguno se cae, sigue
caído (cada 30 minutos) o vuelve. Todos los días a las 9 manda un resumen: si un
día no llega, el que se cayó es el monitoreo.

No inicia sesión ni carga datos: pide la pantalla de ingreso y verifica que traiga
el formulario (`txtPassword`). Un 200 con una página de error cuenta como caído.

Qué se vigila y con qué criterio: `src/sitios.js`. El portal se chequea en `/login.aspx` y no en `/online/`, que en producción redirige a `/home/` y no trae el formulario en el HTML. La API está declarada pero
desactivada hasta tener un endpoint liviano confirmado por el dev.

## Sumar un cliente o un sitio

Todo se declara en `src/sitios.js`:

- **Un cliente nuevo** es una entrada más en `CLIENTES`, con sus direcciones:

  ```js
  { id: 'nuevo', nombre: 'Cliente Nuevo', portal: 'https://portal.nuevo.com',
    sherpa: 'https://sherpa.nuevo.com', api: 'https://api.nuevo.com' },
  ```

  Cada dirección arma sola su chequeo: el portal en `/login.aspx`, el BackOffice en
  su raíz y la API en `/location/getlanguages`, con el contenido que tienen que traer.
- **Un sitio que no sigue ese patrón** (un sitio público, otra API) va en `OTROS`,
  con su dirección y el texto que tiene que traer la respuesta.
- `activo: false` lo deja declarado sin vigilar.

Antes de sumarlo, probar la dirección a mano y confirmar que el texto esperado
aparece. Después `npm test` y desplegar.

## Desplegarlo por primera vez

1. Crear la cuenta gratis en https://dash.cloudflare.com/sign-up con el mail laboral
   de Alan (alan.herrera@amv.travel, no el personal). Más adelante, desde **Manage Account → Members**, invitar a otra
   persona del equipo como administrador: así el acceso no depende de una sola persona.
2. Crear el canal de aviso en Teams: en el canal, **Workflows** → "Post to a channel
   when a webhook request is received" (o "Enviar al canal cuando se reciba una
   solicitud de webhook"). Copiar la URL que genera.
3. Desde esta carpeta:

   ```bash
   npx wrangler login
   npx wrangler kv namespace create ESTADO
   ```

   Pegar el `id` que devuelve en `wrangler.toml`, en lugar de `COMPLETAR_CON_EL_ID_DEL_NAMESPACE`.

4. Cargar los dos secretos (los pide por consola, no quedan en el repo):

   ```bash
   npx wrangler secret put TEAMS_WEBHOOK
   npx wrangler secret put CLAVE
   ```

   `CLAVE` es cualquier texto largo: protege la ruta de prueba.

5. Desplegar y probar que el aviso llega:

   ```bash
   npx wrangler deploy
   curl -X POST -H "X-Clave: LA_CLAVE" https://amv-monitoreo.<subdominio>.workers.dev/probar
   ```

   Tiene que aparecer "Prueba del monitoreo" en el canal.

## Día a día

- Estado actual: `https://amv-monitoreo.<subdominio>.workers.dev/estado`.
- Ver qué está chequeando en vivo: `npx wrangler tail`.
- Pruebas de la lógica, sin Cloudflare: `npm test`.

## Límites del plan gratis

100.000 pedidos por día (se usan unos 300: una invocación cada 5 minutos) y 1.000 escrituras de KV por día: el
estado se guarda solo cuando algo cambia, así que con todo arriba no se escribe nada.
