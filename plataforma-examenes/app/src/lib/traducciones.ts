import type { Idioma } from './i18n';
import type { Examen, Pregunta, Traduccion } from './tipos';

/** La traducción del examen al idioma elegido; `undefined` en español o si no se preparó. */
export function traduccionDe(examen: Examen, idioma: Idioma): Traduccion | undefined {
  return idioma === 'es' ? undefined : examen.traducciones?.[idioma];
}

/** Enunciado y opciones tal y como se muestran (traducidos si procede y no se pide el original). */
export function textosPregunta(p: Pregunta, trad: Traduccion | undefined): { enunciado: string; opcion: (letra: string, original: string) => string } {
  const t = trad?.preguntas[p.id];
  return {
    enunciado: t?.enunciado ?? p.enunciado,
    opcion: (letra, original) => t?.opciones?.[letra] ?? original,
  };
}
