import base from './playwright.config';
import { defineConfig } from '@playwright/test';

/**
 * Config aparte para el capturador de linea base.
 *
 * No es un test de regresion: recorre las pestanias y vuelca a disco los importes
 * tal como se ven hoy. Vive fuera de `tests/` para que no corra con la suite ni
 * aparezca en el reporte. Se ejecuta a mano con `npm run lineabase` cuando se
 * cambian datos a proposito.
 */
export default defineConfig({ ...base, testDir: './tools' });
