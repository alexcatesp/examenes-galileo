import type { Examen, Opcion, Pregunta } from './tipos';

function mulberry32(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function barajar<T>(lista: T[], azar: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export interface PreguntaVista extends Pregunta {
  parteId: string;
  parteTitulo: string;
  /** Posición (1..n) dentro de su parte, en el orden que ve el alumno. */
  numero: number;
  /** Opciones en el orden que ve el alumno; `letra` sigue siendo la canónica. */
  opcionesVista: Opcion[];
}

/**
 * Orden que ve el alumno: se barajan las preguntas dentro de cada parte y las
 * opciones de cada test. Las partes mantienen su orden (Básico → Avanzado).
 * Las respuestas se guardan siempre con la letra canónica.
 */
export function ordenAlumno(examen: Examen, semilla: number): PreguntaVista[] {
  const azar = mulberry32(semilla);
  return examen.partes.flatMap((parte) =>
    barajar(parte.preguntas, azar).map((p, i) => ({
      ...p,
      parteId: parte.id,
      parteTitulo: parte.titulo,
      numero: i + 1,
      opcionesVista: p.opciones.length ? barajar(p.opciones, azar) : [],
    })),
  );
}

export const LETRAS = 'abcdefgh';
