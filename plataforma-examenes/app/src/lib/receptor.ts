// Cliente del receptor de entregas (Google Apps Script, ver apps-script/Code.gs).
// Se envía como text/plain para evitar la petición previa CORS.
//
// Nada de lo que hay aquí puede dejar al alumno sin examen: si el receptor no
// responde, la app sigue funcionando con el reloj y el almacenamiento locales.
import { formatear } from './cripto';
import type { Respuesta } from './tipos';

export type ResultadoEnvio = 'ok' | 'sin-confirmar' | 'error';

export interface EstadoRemoto {
  estado: 'nuevo' | 'en-curso' | 'entregado';
  inicio?: number;
  respuestas?: Record<string, Respuesta>;
  ahora?: number;
}

interface Carga {
  accion: 'inicio' | 'autosave' | 'final';
  examen: string;
  codigo: string;
  inicio?: number | null;
  respuestas?: Record<string, Respuesta>;
  md?: string;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function conTiempo(url: string, init: RequestInit, ms: number): Promise<Response> {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: control.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Diferencia entre la hora del receptor y la del equipo, para no fiarnos del reloj local. */
export function desfaseDe(ahoraServidor: number | undefined, antesDeLlamar: number): number | null {
  if (!ahoraServidor) return null;
  // La respuesta se emitió en algún momento entre la ida y la vuelta: se reparte el viaje.
  const viaje = (Date.now() - antesDeLlamar) / 2;
  return Math.round(ahoraServidor + viaje - Date.now());
}

async function postear(receptor: string, carga: Carga, intentos: number): Promise<{ datos: unknown; ok: boolean } | null> {
  const cuerpo = JSON.stringify({ ...carga, codigo: formatear(carga.codigo) });
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await conTiempo(receptor, {
        method: 'POST',
        body: cuerpo,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      }, 20_000);
      const datos = await r.json();
      if (datos?.ok) return { datos, ok: true };
      if (datos?.error) console.warn('Receptor:', datos.error);
      return { datos, ok: false };
    } catch {
      if (i === intentos - 1) return null;
      await esperar(1500 * (i + 1));
    }
  }
  return null;
}

export interface Envio {
  resultado: ResultadoEnvio;
  desfase: number | null;
}

export async function enviar(receptor: string, carga: Carga, intentos = 3): Promise<Envio> {
  const antes = Date.now();
  const r = await postear(receptor, carga, intentos);
  if (r?.ok) {
    return { resultado: 'ok', desfase: desfaseDe((r.datos as { ahora?: number }).ahora, antes) };
  }
  if (r) return { resultado: 'error', desfase: null };
  // Si CORS impide leer la respuesta, se envía a ciegas como último recurso.
  try {
    await fetch(receptor, {
      method: 'POST',
      body: JSON.stringify({ ...carga, codigo: formatear(carga.codigo) }),
      mode: 'no-cors',
    });
    return { resultado: 'sin-confirmar', desfase: null };
  } catch {
    return { resultado: 'error', desfase: null };
  }
}

/** Pide al receptor la hora de inicio: la fija él, no el reloj del alumno. */
export async function marcarInicio(
  receptor: string,
  examen: string,
  codigo: string,
): Promise<{ inicio: number; desfase: number | null } | null> {
  const antes = Date.now();
  const r = await postear(receptor, { accion: 'inicio', examen, codigo }, 2);
  if (!r?.ok) return null;
  const datos = r.datos as { inicio?: number; ahora?: number };
  if (!datos.inicio) return null;
  return { inicio: datos.inicio, desfase: desfaseDe(datos.ahora, antes) };
}

export async function consultarEstado(
  receptor: string,
  examen: string,
  codigo: string,
): Promise<EstadoRemoto | null> {
  try {
    const url = `${receptor}?accion=estado&examen=${encodeURIComponent(examen)}&codigo=${encodeURIComponent(formatear(codigo))}`;
    const r = await conTiempo(url, {}, 10_000);
    const datos = await r.json();
    return datos?.ok ? datos as EstadoRemoto : null;
  } catch {
    return null; // sin red o receptor caído: la app sigue funcionando en local
  }
}
