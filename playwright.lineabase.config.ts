import base from './playwright.config';
import { defineConfig, devices } from '@playwright/test';

/**
 * Config aparte para el capturador de linea base.
 *
 * No es un test de regresion: recorre las pestanias y vuelca a disco los importes
 * tal como se ven hoy. Vive fuera de `tests/` para que no corra con la suite ni
 * aparezca en el reporte. Se ejecuta a mano con `npm run lineabase` cuando se
 * cambian datos a proposito.
 *
 * **Declara sus propios proyectos y no solo su `testDir`.** Hasta el 2026-09-07
 * alcanzaba con `{ ...base, testDir: './tools' }`, porque la suite tenia un unico
 * proyecto sin `testDir` propio. Al partirla en un proyecto por bloque, cada uno
 * paso a declarar el suyo, **y el del proyecto le gana al de arriba**: la captura
 * dejo de correr y en su lugar se ejecutaba la suite entera. Quince minutos, y de
 * paso emitia reservas y movimientos de caja que nadie pidio.
 */
export default defineConfig({
  ...base,
  testDir: './tools',
  projects: [
    // La captura entra al portal como cualquier test: necesita la sesion.
    { name: 'Login', testDir: './tests', testMatch: /auth\.setup\.ts/ },
    {
      name: 'Captura de linea base',
      testDir: './tools',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/front.json' },
      dependencies: ['Login'],
    },
  ],
});
