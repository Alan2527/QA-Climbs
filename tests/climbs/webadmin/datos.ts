import base from '../../../data/candidatos.json';

/**
 * Los datos AUTO-QA de los tests del WebAdmin de la app nueva.
 *
 * Con AMV_JUEGO_DATOS=B toman el juego B (`juegoBoNuevo` en candidatos.json: su mercado, su
 * agencia, su usuario, su hotel y su servicio), asi corren a la vez que los del WebAdmin viejo
 * sin pisarse los datos. Sin esa variable usan el juego de siempre. Lo que el juego B no nombra
 * (tarifario, serie, recargo fijo) es el mismo en los dos.
 */
export const JUEGO_B = process.env.AMV_JUEGO_DATOS === 'B';

const B = base.juegoBoNuevo;

const candidatos = JUEGO_B
  ? {
      ...base,
      markups: {
        ...base.markups,
        usuario: { ...base.markups.usuario, ...B.markups.usuario },
        agencia: { ...base.markups.agencia, ...B.markups.agencia },
        mercado: { ...base.markups.mercado, ...B.markups.mercado },
      },
      extensionTarifas: { ...base.extensionTarifas, ...B.extensionTarifas },
      tarifasServicio: { ...base.tarifasServicio, ...B.tarifasServicio },
    }
  : base;

export default candidatos;
