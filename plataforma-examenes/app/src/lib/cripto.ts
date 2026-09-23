// Espejo de scripts/cripto.py y apps-script/Code.gs: mantenerlos sincronizados.
import type { Examen, Paquete } from './tipos';

export const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LONG_CODIGO = 12;
const texto = new TextEncoder();

export function normalizar(codigo: string): string {
  return codigo
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function formatear(codigo: string): string {
  return (normalizar(codigo).match(/.{1,4}/g) ?? []).join('-');
}

export function codigoValido(codigo: string): boolean {
  const n = normalizar(codigo);
  if (n.length !== LONG_CODIGO || [...n].some((c) => !ALFABETO.includes(c))) return false;
  let total = 0;
  for (let i = 0; i < LONG_CODIGO - 1; i++) total += (i + 1) * ALFABETO.indexOf(n[i]);
  return ALFABETO[total % 31] === n[LONG_CODIGO - 1];
}

export const b64 = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function localizador(sal: Uint8Array<ArrayBuffer>, codigo: string): Promise<string> {
  const clave = await crypto.subtle.importKey('raw', sal, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', clave, texto.encode(normalizar(codigo)));
  return hex(mac.slice(0, 8));
}

async function pbkdf2(secreto: string, sal: Uint8Array<ArrayBuffer>, iter: number): Promise<ArrayBuffer> {
  const base = await crypto.subtle.importKey('raw', texto.encode(secreto), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iter }, base, 256);
}

async function aesDescifrar(clave: ArrayBuffer, iv: Uint8Array<ArrayBuffer>, datos: Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey('raw', clave, 'AES-GCM', false, ['decrypt']);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, datos);
}

export class CodigoNoValido extends Error {}

/**
 * Comprueba que lo descargado es de verdad un paquete de examen.
 *
 * Hace falta porque un servidor de ficheros estáticos puede responder 200 con la
 * propia página (el index.html) cuando el examen no existe: sin esto, el alumno
 * vería un error de JSON en la cara en lugar de «ese examen no existe».
 */
export function esPaquete(valor: unknown): valor is Paquete {
  const p = valor as Paquete | null;
  return (
    !!p && typeof p === 'object' &&
    typeof p.sal === 'string' && typeof p.iv === 'string' &&
    typeof p.datos === 'string' && typeof p.iter === 'number' &&
    Array.isArray(p.entradas) && p.entradas.length > 0 &&
    p.entradas.every((e) => typeof e?.loc === 'string' && typeof e?.iv === 'string' && typeof e?.clave === 'string')
  );
}

/** Abre el paquete con un código. Lanza CodigoNoValido si no le corresponde. */
export async function abrirPaquete(paquete: Paquete, codigo: string): Promise<{ examen: Examen; loc: string }> {
  const sal = b64(paquete.sal);
  const loc = await localizador(sal, codigo);
  const entrada = paquete.entradas.find((e) => e.loc === loc);
  if (!entrada) throw new CodigoNoValido('Este código no corresponde a este examen');
  const kek = await pbkdf2(normalizar(codigo), sal, paquete.iter);
  const clave = await aesDescifrar(kek, b64(entrada.iv), b64(entrada.clave));
  const claro = await aesDescifrar(clave, b64(paquete.iv), b64(paquete.datos));
  return { examen: JSON.parse(new TextDecoder().decode(claro)) as Examen, loc };
}

/** Compara en tiempo constante el PBKDF2 de la contraseña con el hash del examen. */
export async function contrasenaCorrecta(examen: Examen, contrasena: string): Promise<boolean> {
  const { sal, iter, hash } = examen.desbloqueo;
  // Sin distinguir mayúsculas: el bloqueo de mayúsculas no debe dejar al profesor fuera.
  const obtenido = new Uint8Array(await pbkdf2(contrasena.trim().toLowerCase(), b64(sal), iter));
  const esperado = b64(hash);
  if (obtenido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < obtenido.length; i++) dif |= obtenido[i] ^ esperado[i];
  return dif === 0;
}

/** Semilla de 32 bits estable para el barajado de este alumno. */
export async function semilla(id: string, codigo: string): Promise<number> {
  const h = await crypto.subtle.digest('SHA-256', texto.encode(`${id}|${normalizar(codigo)}`));
  return new DataView(h).getUint32(0);
}
