// Sugerencias al escribir: miembros de una clase u objeto tras un punto, y variables y atajos al escribir una palabra.
import { Analizador, contexto, enmascarar } from './analisis';
import { esClaseConocida, miembrosDe, type Miembro } from './catalogo';

const esCharIdent = (c: string | undefined) => !!c && /[\w$]/.test(c);

export interface SugerenciasPunto {
  /** Dónde empieza lo que el alumno ya ha escrito tras el punto. */
  desde: number;
  /** «estatico» tras una clase (Math.), «instancia» tras un objeto (texto.). */
  modo: 'estatico' | 'instancia';
  clase: string;
  miembros: Miembro[];
}

/** Inicio de la expresión cuyo último elemento termina justo antes del punto `dot`, o -1. */
export function inicioReceptor(t: string, dot: number): number {
  let j = dot - 1;
  for (;;) {
    while (j >= 0 && /\s/.test(t[j])) j--;
    if (j < 0) return -1;
    let inicioElemento: number;
    if (t[j] === ')' || t[j] === ']') {
      const cierra = t[j];
      const abre = cierra === ')' ? '(' : '[';
      let prof = 0;
      let k = j;
      for (; k >= 0; k--) {
        if (t[k] === cierra) prof++;
        else if (t[k] === abre && --prof === 0) break;
      }
      if (k < 0) return -1;
      let m = k - 1;
      while (m >= 0 && /\s/.test(t[m])) m--;
      if (esCharIdent(t[m])) {
        let s = m;
        while (s > 0 && esCharIdent(t[s - 1])) s--;
        inicioElemento = s;
      } else inicioElemento = k;
    } else if (esCharIdent(t[j])) {
      let s = j;
      while (s > 0 && esCharIdent(t[s - 1])) s--;
      inicioElemento = s;
    } else if (t[j] === '"' || t[j] === "'") {
      const s = t.lastIndexOf(t[j], j - 1);
      if (s < 0) return -1;
      inicioElemento = s;
    } else return -1;
    let m = inicioElemento - 1;
    while (m >= 0 && /\s/.test(t[m])) m--;
    if (t[m] === '.') { j = m - 1; continue; }
    const antes = t.slice(0, inicioElemento).trimEnd();
    if (/(^|[^\w$])new$/.test(antes)) return antes.length - 3;
    return inicioElemento;
  }
}

/** Miembros que se pueden sugerir tras el punto que precede al cursor (con lo ya escrito de por medio), o `null`. */
export function sugerenciasPunto(codigo: string, cursor: number): SugerenciasPunto | null {
  const { texto } = enmascarar(codigo);
  let inicio = cursor;
  while (inicio > 0 && esCharIdent(texto[inicio - 1])) inicio--;
  let p = inicio;
  while (p > 0 && /\s/.test(texto[p - 1])) p--;
  if (texto[p - 1] !== '.') return null;
  const punto = p - 1;
  // En una línea de import o package no se sugiere nada.
  const linea = texto.slice(texto.lastIndexOf('\n', punto) + 1, punto);
  if (/^\s*(import|package)\b/.test(linea)) return null;
  const comienzo = inicioReceptor(texto, punto);
  if (comienzo < 0) return null;
  const analizador = new Analizador(texto.slice(0, punto), contexto(texto), false);
  const r = analizador.cadena(comienzo);
  if (texto.slice(r.fin, punto).trim()) return null;
  if (r.clase) {
    if (!esClaseConocida(r.clase)) return null;
    const miembros = miembrosDe(r.clase).filter((m) => m.clave === 's' || m.clave === 'c');
    return miembros.length ? { desde: inicio, modo: 'estatico', clase: r.clase, miembros } : null;
  }
  if (r.tipo && esClaseConocida(r.tipo)) {
    const miembros = miembrosDe(r.tipo).filter((m) => m.clave === 'm' || m.clave === 'c');
    return miembros.length ? { desde: inicio, modo: 'instancia', clase: r.tipo, miembros } : null;
  }
  return null;
}

/** Nombres de variable declarados en el código (para sugerirlos al escribir una palabra). */
export function variablesDeclaradas(codigo: string): string[] {
  const { texto } = enmascarar(codigo);
  return [...contexto(texto).vars.keys()];
}

/** ¿El cursor está dentro de un comentario o de un texto entre comillas? Ahí no se sugiere nada. */
export function enComentarioOTexto(codigo: string, cursor: number): boolean {
  return enmascarar(codigo.slice(0, cursor)).dentro !== null;
}
