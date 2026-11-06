// Análisis ligero de código Java para el editor con ayudas. No es un compilador: solo avisa de lo que se
// puede afirmar con seguridad con el catálogo de la UT02 (ver catalogo.ts) y calla ante lo que no conoce.
//
//  · Estructura: llaves, paréntesis y corchetes sin cerrar o de más; comillas sin cerrar; falta de «;».
//  · Clases: una clase del catálogo sin su import; una clase que no se reconoce (aviso).
//  · Miembros: método o atributo que no existe en esa clase, método estático llamado sobre un objeto
//    o de instancia llamado sobre la clase, método usado sin paréntesis o atributo con ellos.
//  · Llamadas: número de argumentos y tipos que no encajan, constructor sin `new`.
//  · Declaraciones: valor de un tipo asignado a una variable de otro (String ← int, int ← double…).
//
// Los mensajes están en español y evitan copiar los de javac, que son crípticos.
import {
  asignable, constructoresDe, esClaseConocida, esPrimitivo, miembrosDe, paqueteDe, type Miembro,
} from './catalogo';

export interface Diagnostico {
  desde: number;
  hasta: number;
  gravedad: 'error' | 'warning';
  mensaje: string;
}

// ───────────────────────────── 1. Enmascarado ─────────────────────────────

/**
 * Devuelve el código con los comentarios convertidos en espacios y el contenido de cadenas y
 * caracteres sustituido por «x». Conserva las posiciones y los saltos de línea.
 */
export function enmascarar(codigo: string): { texto: string; errores: Diagnostico[]; dentro: 'comentario' | 'texto' | null } {
  const salida: string[] = [];
  const errores: Diagnostico[] = [];
  const n = codigo.length;
  let i = 0;
  /** Si el texto termina dentro de un comentario o de un texto entre comillas. */
  let dentro: 'comentario' | 'texto' | null = null;
  while (i < n) {
    const c = codigo[i];
    const d = codigo[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && codigo[i] !== '\n') { salida.push(' '); i++; }
      if (i >= n) dentro = 'comentario';
    } else if (c === '/' && d === '*') {
      salida.push(' ', ' ');
      i += 2;
      while (i < n && !(codigo[i] === '*' && codigo[i + 1] === '/')) { salida.push(codigo[i] === '\n' ? '\n' : ' '); i++; }
      if (i < n) { salida.push(' ', ' '); i += 2; } else dentro = 'comentario';
    } else if (c === '"' && d === '"' && codigo[i + 2] === '"') {
      salida.push('"', '"', '"');
      i += 3;
      while (i < n && !(codigo[i] === '"' && codigo[i + 1] === '"' && codigo[i + 2] === '"')) { salida.push(codigo[i] === '\n' ? '\n' : 'x'); i++; }
      if (i < n) { salida.push('"', '"', '"'); i += 3; } else dentro = 'texto';
    } else if (c === '"' || c === "'") {
      const inicio = i;
      salida.push(c);
      i++;
      let cerrada = false;
      while (i < n && codigo[i] !== '\n') {
        if (codigo[i] === '\\' && i + 1 < n && codigo[i + 1] !== '\n') { salida.push('x', 'x'); i += 2; continue; }
        if (codigo[i] === c) { salida.push(c); i++; cerrada = true; break; }
        salida.push('x');
        i++;
      }
      if (!cerrada) {
        if (i >= n) dentro = 'texto';
        errores.push({
          desde: inicio, hasta: Math.max(inicio + 1, i), gravedad: 'error',
          mensaje: c === '"' ? 'Falta cerrar las comillas del texto.' : 'Falta cerrar la comilla simple del carácter.',
        });
      }
    } else {
      salida.push(c);
      i++;
    }
  }
  return { texto: salida.join(''), errores, dentro };
}

// ───────────────────────────── 2. Estructura ─────────────────────────────

const PARES: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
const CIERRE: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const NOMBRE_SIGNO: Record<string, string> = { '(': 'paréntesis', ')': 'paréntesis', '[': 'corchete', ']': 'corchete', '{': 'llave', '}': 'llave' };

export function equilibrio(t: string): Diagnostico[] {
  const pila: { c: string; p: number }[] = [];
  const diag: Diagnostico[] = [];
  for (let p = 0; p < t.length; p++) {
    const c = t[p];
    if (c === '(' || c === '[' || c === '{') pila.push({ c, p });
    else if (c === ')' || c === ']' || c === '}') {
      const cima = pila[pila.length - 1];
      if (cima && cima.c === PARES[c]) pila.pop();
      else if (pila.some((x) => x.c === PARES[c])) {
        // Hay un cierre que corresponde a una apertura más profunda: lo que falta es lo de en medio.
        while (pila.length && pila[pila.length - 1].c !== PARES[c]) {
          const x = pila.pop()!;
          diag.push({ desde: x.p, hasta: x.p + 1, gravedad: 'error', mensaje: `Falta cerrar «${x.c}» con «${CIERRE[x.c]}».` });
        }
        pila.pop();
      } else {
        diag.push({ desde: p, hasta: p + 1, gravedad: 'error', mensaje: `Sobra «${c}»: no hay ${NOMBRE_SIGNO[c] === 'llave' ? 'ninguna llave abierta' : `ningún ${NOMBRE_SIGNO[c]} abierto`} que cerrar.` });
      }
    }
  }
  for (const x of pila) diag.push({ desde: x.p, hasta: x.p + 1, gravedad: 'error', mensaje: `Falta cerrar «${x.c}» con «${CIERRE[x.c]}».` });
  return diag;
}

const NO_TERMINAN = ';{},(+-*/%=&|?:.<>!^~';

export function puntoYComa(t: string): Diagnostico[] {
  const diag: Diagnostico[] = [];
  const lineas = t.split('\n');
  const inicios: number[] = [];
  let acum = 0;
  for (const l of lineas) { inicios.push(acum); acum += l.length + 1; }
  let parentesis = 0;
  for (let k = 0; k < lineas.length; k++) {
    const linea = lineas[k];
    for (const ch of linea) { if (ch === '(') parentesis++; else if (ch === ')') parentesis--; }
    const contenido = linea.trim();
    if (!contenido || parentesis > 0) continue;
    const ultimo = contenido[contenido.length - 1];
    const finLinea = inicios[k] + linea.trimEnd().length;
    // Una línea que acaba en «;», «{», «}», «,», un operador o un punto no necesita «;» (continúa o es un bloque),
    // salvo «x++» y «x--», que sí son instrucciones completas.
    const necesita = /(\+\+|--)$/.test(contenido) || !(NO_TERMINAN.includes(ultimo) || ultimo === '}');
    if (!necesita) continue;
    if (contenido.startsWith('@')) continue;
    if (/^(else|do|try|finally)$/.test(contenido)) continue;
    if (/^(case\b|default\b)/.test(contenido)) continue;
    if (/^(if|for|while|switch|catch|else\s+if|synchronized)\b/.test(contenido) && ultimo === ')') continue;
    let siguiente = '';
    for (let m = k + 1; m < lineas.length; m++) { if (lineas[m].trim()) { siguiente = lineas[m].trim(); break; } }
    if (/^[.+\-*/%&|?:)\]{,=<>]/.test(siguiente) || /^(throws|extends|implements)\b/.test(siguiente)) continue;
    diag.push({ desde: Math.max(inicios[k], finLinea - 1), hasta: finLinea, gravedad: 'error', mensaje: 'Falta «;» al final de la instrucción.' });
  }
  return diag;
}

// ───────────────────────────── 3. Contexto del archivo ─────────────────────────────

export interface Contexto {
  vars: Map<string, string>;
  declaradas: Set<string>;
  importadas: Set<string>;
  comodines: Set<string>;
}

const TIPO_DECL = /\b(int|double|long|boolean|char|float|byte|short|[A-Z]\w*)(\s*<[^<>;(){}]*>)?((?:\s*\[\s*\])*)\s+([a-z_$][\w$]*)\s*(?=[=;,):])/g;

export function contexto(t: string): Contexto {
  const vars = new Map<string, string>();
  const declaradas = new Set<string>();
  const importadas = new Set<string>();
  const comodines = new Set<string>();
  for (const m of t.matchAll(/\b(?:class|interface|enum|record)\s+([A-Z]\w*)/g)) declaradas.add(m[1]);
  for (const m of t.matchAll(/^[ \t]*import\s+(?:static\s+)?([\w.]+?)(\.\*)?\s*;/gm)) {
    if (m[2]) comodines.add(m[1]);
    else importadas.add(m[1].slice(m[1].lastIndexOf('.') + 1));
  }
  for (const m of t.matchAll(TIPO_DECL)) {
    const dims = (m[3].match(/\[/g) ?? []).length;
    vars.set(m[4], m[1] + '[]'.repeat(dims));
  }
  return { vars, declaradas, importadas, comodines };
}

// ───────────────────────────── 4. Expresiones ─────────────────────────────

const PALABRAS = new Set((
  'abstract assert boolean break byte case catch char class const continue default do double else enum extends final ' +
  'finally float for goto if implements import instanceof int interface long native package private protected public ' +
  'return short static strictfp super switch synchronized this throw throws transient try void volatile while var record ' +
  'true false null yield sealed permits'
).split(' '));
const PRIMITIVAS = new Set(['int', 'double', 'long', 'boolean', 'char', 'float', 'byte', 'short']);

const esInicioIdent = (c: string | undefined) => !!c && /[A-Za-z_$]/.test(c);
const esCharIdent = (c: string | undefined) => !!c && /[\w$]/.test(c);

export interface Resultado {
  tipo: string | null;
  /** Posición donde termina la cadena de accesos. */
  fin: number;
  /** Si toda la cadena es el nombre de una clase («Math», «LocalDate»): sus accesos serán estáticos. */
  clase?: string | null;
}

interface Arg {
  tipo: string | null;
  desde: number;
  hasta: number;
}

export class Analizador {
  readonly diag: Diagnostico[] = [];
  private vistas = new Set<string>();

  constructor(private readonly t: string, private readonly ctx: Contexto, private readonly emitir = true) {}

  private avisar(desde: number, hasta: number, gravedad: 'error' | 'warning', mensaje: string): void {
    if (!this.emitir) return;
    const clave = `${desde}:${hasta}:${mensaje}`;
    if (this.vistas.has(clave)) return;
    this.vistas.add(clave);
    this.diag.push({ desde, hasta, gravedad, mensaje });
  }

  private ws(i: number): number {
    while (i < this.t.length && /\s/.test(this.t[i])) i++;
    return i;
  }

  private leerIdent(i: number): string {
    let j = i;
    while (esCharIdent(this.t[j])) j++;
    return this.t.slice(i, j);
  }

  /** Posición del paréntesis (o corchete) de cierre que corresponde al de apertura en `i`, o -1. */
  private cierre(i: number): number {
    const abre = this.t[i];
    const cierra = CIERRE[abre];
    let prof = 0;
    for (let j = i; j < this.t.length; j++) {
      if (this.t[j] === abre) prof++;
      else if (this.t[j] === cierra && --prof === 0) return j;
    }
    return -1;
  }

  // Un uso de clase: comprueba que se pueda reconocer.
  private usarClase(nombre: string, pos: number): void {
    if (this.ctx.declaradas.has(nombre) || PRIMITIVAS.has(nombre)) return;
    if (esClaseConocida(nombre)) {
      const paquete = paqueteDe(nombre)!;
      if (paquete === 'java.lang') return;
      if (this.ctx.importadas.has(nombre) || this.ctx.comodines.has(paquete)) return;
      this.avisar(pos, pos + nombre.length, 'error', `«${nombre}» no se reconoce como tipo. ¿Falta un import?`);
      return;
    }
    if (nombre === nombre.toUpperCase() && nombre.length > 1) return;
    this.avisar(pos, pos + nombre.length, 'warning', `«${nombre}» no se reconoce como tipo o clase. Revisa el nombre y el import.`);
  }

  /** Separa los argumentos de una llamada cuyo paréntesis de apertura está en `abre`. */
  private argumentos(abre: number, cierre: number): Arg[] {
    const args: Arg[] = [];
    let desde = abre + 1;
    let prof = 0;
    const cortar = (hasta: number) => {
      let a = desde;
      let b = hasta;
      while (a < b && /\s/.test(this.t[a])) a++;
      while (b > a && /\s/.test(this.t[b - 1])) b--;
      if (b > a) args.push({ tipo: null, desde: a, hasta: b });
    };
    for (let j = abre + 1; j < cierre; j++) {
      const c = this.t[j];
      if ('([{'.includes(c)) prof++;
      else if (')]}'.includes(c)) prof--;
      else if (c === ',' && prof === 0) { cortar(j); desde = j + 1; }
    }
    cortar(cierre);
    for (const a of args) {
      const r = this.cadena(a.desde);
      const fin = this.ws(r.fin);
      if (fin >= a.hasta) a.tipo = r.tipo;
      else this.escanear(r.fin, a.hasta);
    }
    return args;
  }

  /** Elige la sobrecarga que encaja con los argumentos y avisa si no hay ninguna. */
  private resolver(candidatos: Miembro[], args: Arg[], nombre: string, desde: number, hasta: number, de: string): string | null {
    const n = args.length;
    const porAridad = candidatos.filter((m) => {
      const ps = m.parametros.length;
      const variable = ps > 0 && m.parametros[ps - 1].tipo.endsWith('...');
      return variable ? n >= ps - 1 : n === ps;
    });
    const opciones = candidatos.map((m) => m.firma).join('  ·  ');
    if (!porAridad.length) {
      const esperados = [...new Set(candidatos.map((m) => m.parametros.length))].sort((a, b) => a - b);
      const cuantos = esperados.length === 1 ? `${esperados[0]} argumento${esperados[0] === 1 ? '' : 's'}` : `${esperados.join(' o ')} argumentos`;
      this.avisar(desde, hasta, 'error', `«${nombre}» de ${de} espera ${cuantos} y se le pasan ${n}. Opciones: ${opciones}`);
      return null;
    }
    const encajan = porAridad.filter((m) => args.every((a, k) => {
      const p = m.parametros[Math.min(k, m.parametros.length - 1)].tipo;
      return asignable(a.tipo, p) !== false;
    }));
    if (!encajan.length) {
      const m = porAridad[0];
      const k = args.findIndex((a) => asignable(a.tipo, m.parametros[Math.min(args.indexOf(a), m.parametros.length - 1)].tipo) === false);
      const a = args[k];
      const esperado = m.parametros[Math.min(k, m.parametros.length - 1)].tipo.replace('...', '');
      const detalle = porAridad.length === 1
        ? `El argumento ${k + 1} de «${nombre}» es de tipo ${a.tipo} y se esperaba ${esperado}.`
        : `Ningún «${nombre}» acepta esos argumentos (el ${k + 1}.º es de tipo ${a.tipo}). Opciones: ${opciones}`;
      this.avisar(a.desde, a.hasta, 'error', detalle);
      return null;
    }
    const ret = encajan[0].retorno;
    return ret === '?' ? null : ret;
  }

  /**
   * Interpreta desde `i` una cadena de accesos: «Clase.metodo(args).otro()», «variable.campo», «new T(args)»,
   * un literal… Devuelve el tipo del resultado y dónde acaba.
   */
  cadena(i: number): Resultado {
    const t = this.t;
    i = this.ws(i);
    let tipo: string | null = null;
    let clase: string | null = null; // la cadena es, por ahora, una clase (accesos estáticos)
    const c = t[i];

    if (c === '"') {
      const j = t.indexOf('"', i + 1);
      tipo = 'String';
      i = j < 0 ? t.length : j + 1;
    } else if (c === "'") {
      const j = t.indexOf("'", i + 1);
      tipo = 'char';
      i = j < 0 ? t.length : j + 1;
    } else if (/\d/.test(c ?? '') || (c === '.' && /\d/.test(t[i + 1] ?? ''))) {
      const m = /^(0[xX][\da-fA-F_]+[lL]?|\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?[fFdDlL]?|\.\d[\d_]*(?:[eE][+-]?\d+)?[fFdD]?)/.exec(t.slice(i))!;
      const lit = m[0];
      tipo = /[fF]$/.test(lit) && !/^0[xX]/.test(lit) ? 'float'
        : /[lL]$/.test(lit) ? 'long'
        : /[.eE]|[dD]$/.test(lit) && !/^0[xX]/.test(lit) ? 'double' : 'int';
      i += lit.length;
    } else if (c === '(') {
      const f = this.cierre(i);
      if (f < 0) return { tipo: null, fin: t.length };
      this.escanear(i + 1, f);
      return { tipo: null, fin: f + 1 };
    } else if (esInicioIdent(c)) {
      const inicio = i;
      const id = this.leerIdent(i);
      i += id.length;
      if (id === 'new') {
        i = this.ws(i);
        let nombre = this.leerIdent(i);
        const posClase = i;
        i += nombre.length;
        while (t[i] === '.' && esInicioIdent(t[i + 1])) { // new java.util.Scanner(...)
          const sig = this.leerIdent(i + 1);
          nombre = sig;
          i += sig.length + 1;
        }
        const posNombre = i - nombre.length;
        if (nombre) {
          if (posNombre === posClase) this.usarClase(nombre, posNombre);
          else if (!esClaseConocida(nombre)) this.usarClase(nombre, posNombre);
        }
        i = this.ws(i);
        if (t[i] === '<') { const f = t.indexOf('>', i); i = f < 0 ? i : this.ws(f + 1); }
        if (t[i] === '(') {
          const f = this.cierre(i);
          if (f < 0) return { tipo: nombre || null, fin: t.length };
          const args = this.argumentos(i, f);
          const ctors = constructoresDe(nombre);
          if (ctors.length) this.resolver(ctors, args, nombre, posNombre, posNombre + nombre.length, `la clase ${nombre}`);
          else if (esClaseConocida(nombre) && !ctors.length && !miembrosDe(nombre).length) { /* sin información */ }
          tipo = nombre || null;
          i = f + 1;
        } else if (t[i] === '[') {
          const f = this.cierre(i);
          this.escanear(i + 1, f < 0 ? t.length : f);
          tipo = `${nombre}[]`;
          i = f < 0 ? t.length : f + 1;
        } else {
          tipo = nombre || null;
        }
      } else if (id === 'true' || id === 'false') {
        tipo = 'boolean';
      } else if (id === 'null' || id === 'this' || id === 'super') {
        tipo = null;
      } else if (PALABRAS.has(id) && !PRIMITIVAS.has(id)) {
        return { tipo: null, fin: i };
      } else {
        const j = this.ws(i);
        if (t[j] === '(') {
          // Llamada a un método propio, o a una clase sin `new`.
          const f = this.cierre(j);
          if (esClaseConocida(id) && !this.ctx.declaradas.has(id) && /^[A-Z]/.test(id)) {
            this.avisar(inicio, inicio + id.length, 'error', `Falta «new» para crear el objeto: new ${id}(…).`);
          }
          if (f < 0) return { tipo: null, fin: t.length };
          this.argumentos(j, f);
          tipo = null;
          i = f + 1;
        } else if (this.ctx.vars.has(id)) {
          tipo = this.ctx.vars.get(id)!;
        } else if (/^[A-Z]/.test(id)) {
          this.usarClase(id, inicio);
          clase = id;
        }
      }
    } else {
      return { tipo: null, fin: i };
    }

    // Accesos encadenados.
    for (;;) {
      const j = this.ws(i);
      if (t[j] === '[') {
        const f = this.cierre(j);
        if (f < 0) return { tipo: null, fin: t.length };
        this.escanear(j + 1, f);
        tipo = tipo && tipo.endsWith('[]') ? tipo.slice(0, -2) : null;
        clase = null;
        i = f + 1;
        continue;
      }
      if (t[j] !== '.' || !esInicioIdent(t[this.ws(j + 1)])) break;
      const k = this.ws(j + 1);
      const nombre = this.leerIdent(k);
      const despues = this.ws(k + nombre.length);
      const llamada = t[despues] === '(';
      let fin = k + nombre.length;
      let args: Arg[] = [];
      if (llamada) {
        const f = this.cierre(despues);
        if (f < 0) return { tipo: null, fin: t.length };
        args = this.argumentos(despues, f);
        fin = f + 1;
      }
      const rango: [number, number] = [k, k + nombre.length];

      if (clase) {
        tipo = this.accesoEstatico(clase, nombre, llamada, args, rango);
        clase = null;
      } else if (tipo) {
        tipo = this.accesoInstancia(tipo, nombre, llamada, args, rango);
      } else {
        tipo = null;
      }
      i = fin;
    }
    return { tipo: clase ? null : tipo, fin: i, clase };
  }

  private accesoEstatico(clase: string, nombre: string, llamada: boolean, args: Arg[], r: [number, number]): string | null {
    if (!esClaseConocida(clase) || this.ctx.declaradas.has(clase)) return null;
    const todos = miembrosDe(clase).filter((m) => m.nombre === nombre);
    const estaticos = todos.filter((m) => m.clave === 's' || m.clave === 'c');
    if (llamada) {
      if (estaticos.some((m) => m.clave === 's')) return this.resolver(estaticos.filter((m) => m.clave === 's'), args, nombre, r[0], r[1], clase);
      if (estaticos.some((m) => m.clave === 'c')) {
        this.avisar(r[0], r[1], 'error', `«${nombre}» es una propiedad de ${clase}, no un método: quita los paréntesis.`);
        return estaticos[0].retorno;
      }
      if (todos.length) {
        this.avisar(r[0], r[1], 'error', `«${nombre}» es un método de instancia: se llama sobre un objeto, no sobre la clase ${clase}. Ejemplo: miObjeto.${nombre}(…).`);
        return null;
      }
      if (!miembrosDe(clase).length) return null;
      this.avisar(r[0], r[1], 'error', `La clase ${clase} no tiene ningún método estático llamado «${nombre}».`);
      return null;
    }
    const constante = estaticos.find((m) => m.clave === 'c');
    if (constante) return constante.retorno;
    if (todos.some((m) => m.clave === 'm' || m.clave === 's')) {
      this.avisar(r[0], r[1], 'error', `«${nombre}» es un método de ${clase}: se usa con paréntesis, ${nombre}(…).`);
      return null;
    }
    if (!miembrosDe(clase).length || /^[A-Z]/.test(nombre) && nombre !== nombre.toUpperCase()) return null;
    this.avisar(r[0], r[1], 'error', `La clase ${clase} no tiene ninguna propiedad llamada «${nombre}».`);
    return null;
  }

  private accesoInstancia(tipo: string, nombre: string, llamada: boolean, args: Arg[], r: [number, number]): string | null {
    if (esPrimitivo(tipo)) {
      this.avisar(r[0], r[1], 'error', `Un valor de tipo ${tipo} es un dato primitivo y no tiene métodos ni propiedades: no se puede usar «.${nombre}».`);
      return null;
    }
    if (tipo.endsWith('[]')) {
      if (nombre === 'length' && !llamada) return 'int';
      if (nombre === 'length' && llamada) { this.avisar(r[0], r[1], 'error', 'En un array, length es una propiedad: se escribe sin paréntesis, array.length.'); return 'int'; }
      return null;
    }
    if (!esClaseConocida(tipo) || this.ctx.declaradas.has(tipo)) return null;
    const todos = miembrosDe(tipo).filter((m) => m.nombre === nombre);
    if (llamada) {
      const metodos = todos.filter((m) => m.clave === 'm' || m.clave === 's');
      if (metodos.length) return this.resolver(metodos, args, nombre, r[0], r[1], tipo);
      if (todos.some((m) => m.clave === 'c')) {
        this.avisar(r[0], r[1], 'error', `«${nombre}» es una propiedad de ${tipo}, no un método: quita los paréntesis.`);
        return todos[0].retorno;
      }
      if (!miembrosDe(tipo).length) return null;
      this.avisar(r[0], r[1], 'error', `La clase ${tipo} no tiene ningún método llamado «${nombre}».`);
      return null;
    }
    const campo = todos.find((m) => m.clave === 'c');
    if (campo) return campo.retorno;
    if (todos.some((m) => m.clave === 'm' || m.clave === 's')) {
      this.avisar(r[0], r[1], 'error', `«${nombre}» es un método de ${tipo}, no una propiedad: se escribe con paréntesis, ${nombre}(…).`);
      return null;
    }
    if (!miembrosDe(tipo).length) return null;
    this.avisar(r[0], r[1], 'error', `La clase ${tipo} no tiene ninguna propiedad llamada «${nombre}».`);
    return null;
  }

  /** ¿Se puede guardar un valor de tipo `valor` en una variable declarada de tipo `declarado`? */
  private comprobarAsignacion(declarado: string, valor: Resultado, literalInt: boolean, desde: number, hasta: number): void {
    if (!valor.tipo || valor.tipo === 'void') return;
    if (literalInt && ['byte', 'short', 'char'].includes(declarado)) return;
    if (asignable(valor.tipo, declarado) !== false) return;
    const perdida = esPrimitivo(valor.tipo) && esPrimitivo(declarado) && valor.tipo !== 'boolean' && declarado !== 'boolean';
    this.avisar(
      desde, hasta, 'error',
      perdida
        ? `No se puede guardar un ${valor.tipo} en un ${declarado} sin perder información. Hace falta un cast: (${declarado}) valor.`
        : `No se puede convertir un valor de tipo ${valor.tipo} a ${declarado}.`,
    );
  }

  /** Recorre el texto entre `a` y `b` buscando cadenas de accesos y declaraciones. */
  escanear(a: number, b: number): void {
    const t = this.t;
    let i = a;
    const limite = Math.min(b, t.length);
    while (i < limite) {
      const c = t[i];
      if (!esInicioIdent(c) && !/\d/.test(c) && c !== '"' && c !== "'") { i++; continue; }
      if (esCharIdent(t[i - 1]) && i > a) { i++; continue; }
      if (esInicioIdent(c) && t.slice(0, i).trimEnd().endsWith('.')) { i += this.leerIdent(i).length; continue; }
      if (esInicioIdent(c)) {
        const id = this.leerIdent(i);
        if (id === 'import' || id === 'package') { const f = t.indexOf(';', i); i = f < 0 ? limite : f + 1; continue; }
        // Declaración con valor inicial: «Tipo nombre = expresión ;»
        const decl = /^(int|double|long|boolean|char|float|byte|short|[A-Z]\w*)(\s*<[^<>;(){}]*>)?((?:\s*\[\s*\])*)\s+([a-z_$][\w$]*)\s*=(?!=)/.exec(t.slice(i, limite));
        if (decl && !(PALABRAS.has(id) && !PRIMITIVAS.has(id))) {
          const tipoBase = decl[1];
          if (!PRIMITIVAS.has(tipoBase)) this.usarClase(tipoBase, i);
          const declarado = tipoBase + '[]'.repeat((decl[3].match(/\[/g) ?? []).length);
          let j = this.ws(i + decl[0].length);
          const inicioValor = j;
          const r = this.cadena(j);
          j = this.ws(r.fin);
          if (j >= limite || t[j] === ';' || t[j] === ',') {
            const literalInt = /^\d/.test(t.slice(inicioValor)) && r.tipo === 'int';
            this.comprobarAsignacion(declarado, r, literalInt, inicioValor, Math.max(inicioValor + 1, r.fin));
          }
          i = Math.max(r.fin, i + decl[0].length);
          continue;
        }
        if (PALABRAS.has(id) && !PRIMITIVAS.has(id)) { i += id.length; continue; }
        if (PRIMITIVAS.has(id)) { i += id.length; continue; }
      }
      const r = this.cadena(i);
      i = Math.max(r.fin, i + 1);
    }
  }
}

// ───────────────────────────── 5. Punto de entrada ─────────────────────────────

export function analizar(codigo: string): Diagnostico[] {
  const { texto, errores } = enmascarar(codigo);
  const ctx = contexto(texto);
  const an = new Analizador(texto, ctx);
  an.escanear(0, texto.length);
  const todos = [...errores, ...equilibrio(texto), ...puntoYComa(texto), ...an.diag];
  const vistos = new Set<string>();
  return todos
    .filter((d) => (vistos.has(`${d.desde}:${d.mensaje}`) ? false : (vistos.add(`${d.desde}:${d.mensaje}`), true)))
    .sort((x, y) => x.desde - y.desde);
}

