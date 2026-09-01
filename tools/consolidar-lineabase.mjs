import * as fs from 'fs';
import * as path from 'path';

/**
 * Vuelca lo que capturo `capturar-lineabase.spec.ts` a la linea base que leen
 * los tests.
 *
 * El capturador escribe un archivo por pestania en `lineabase/`, pero la suite
 * compara contra `data/importes-lineabase.json`. Sin este paso, `npm run
 * lineabase` corria entero, dejaba los siete archivos nuevos y la comparacion
 * seguia usando la linea base vieja.
 *
 * Se ejecuta encadenado al capturador desde el script `lineabase` de package.json.
 */

const ORIGEN = 'lineabase';
const DESTINO = path.join('data', 'importes-lineabase.json');

const NOTA =
  'Linea base de los importes tal como los muestra el tarifario. Capturada con ' +
  'tools/capturar-lineabase.spec.ts y consolidada con tools/consolidar-lineabase.mjs ' +
  '(npm run lineabase). Si un cambio del sistema altera un importe, el recargo por ' +
  'idioma o la marca TARIFA EXTENDIDA, la comparacion falla.';

if (!fs.existsSync(ORIGEN)) {
  console.error(`No existe la carpeta "${ORIGEN}". Correr antes el capturador.`);
  process.exit(1);
}

const archivos = fs.readdirSync(ORIGEN).filter((f) => f.endsWith('.json')).sort();
if (!archivos.length) {
  console.error(`No hay capturas en "${ORIGEN}".`);
  process.exit(1);
}

// Se conserva el orden alfabetico de las claves para que el diff del archivo
// muestre solo lo que cambio de verdad y no un reordenamiento.
const items = {};
for (const archivo of archivos) {
  const clave = path.basename(archivo, '.json');
  items[clave] = JSON.parse(fs.readFileSync(path.join(ORIGEN, archivo), 'utf8'));
}

const hoy = new Date();
const fecha =
  `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-` +
  `${String(hoy.getDate()).padStart(2, '0')}`;

const previa = fs.existsSync(DESTINO)
  ? JSON.parse(fs.readFileSync(DESTINO, 'utf8'))
  : { items: {} };

fs.writeFileSync(
  DESTINO,
  JSON.stringify({ _nota: NOTA, _capturada: fecha, _ambiente: 'QA', items }, null, 2) + '\n',
  'utf8',
);

// Resumen en consola: es la unica forma de darse cuenta de que una pestania
// perdio solapas o filas respecto de la linea base anterior.
console.log(`Linea base consolidada en ${DESTINO} (${archivos.length} pestanias)`);
for (const [clave, item] of Object.entries(items)) {
  const filas = Object.values(item.porIdioma).reduce((n, f) => n + f.length, 0);
  const antes = previa.items?.[clave];
  const filasAntes = antes
    ? Object.values(antes.porIdioma).reduce((n, f) => n + f.length, 0)
    : null;

  const cambio =
    antes && (antes.solapasIdioma !== item.solapasIdioma || filasAntes !== filas)
      ? `   <-- antes ${antes.solapasIdioma} solapas / ${filasAntes} filas`
      : '';

  console.log(
    `  ${clave.padEnd(12)} ${String(item.solapasIdioma).padStart(2)} solapas  ` +
      `${String(filas).padStart(4)} filas  ` +
      `${String(item.tarifaExtendida).padStart(4)} tarifa extendida${cambio}`,
  );
}
