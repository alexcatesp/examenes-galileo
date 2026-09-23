// Genera el .md de respuestas: SIN datos del alumno, solo el código de acceso.
import { formatear } from './cripto';
import type { Estado, Examen, Pregunta, Respuesta } from './tipos';

const FENCE_LENGUAJE: Record<string, string> = { texto: 'text', shell: 'bash' };

/** Fecha local con desfase horario: 2026-10-05T09:02:11+02:00 */
export function isoLocal(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${off >= 0 ? '+' : '-'}${p(Math.trunc(off / 60))}:${p(off % 60)}`
  );
}

/** Bloque de código cuyo delimitador no aparece dentro del contenido. */
function bloque(contenido: string, lenguaje: string): string {
  const mayor = Math.max(2, ...[...contenido.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(mayor + 1);
  return `${fence}${lenguaje}\n${contenido.replace(/\s+$/, '')}\n${fence}`;
}

/** «0,70» — con coma decimal, que es como se escribe una nota en castellano. */
export function formatoPuntos(puntos: number): string {
  return puntos.toFixed(2).replace('.', ',');
}

function describirTipo(p: Pregunta): string {
  switch (p.tipo) {
    case 'unica': return 'test (única)';
    case 'multiple': return 'test (múltiple)';
    case 'codigo': return `código (${p.lenguaje ?? 'texto'})`;
    default: return 'desarrollo';
  }
}

function vacia(r: Respuesta | undefined): boolean {
  if (!r) return true;
  const v = Array.isArray(r.valor) ? r.valor.length : r.valor.trim().length;
  return !v && !r.explicacion?.trim();
}

function respuestaMd(p: Pregunta, r: Respuesta | undefined): string {
  if (vacia(r)) return '**Respuesta:** _(sin responder)_';
  const valor = r!.valor;
  if (p.tipo === 'unica' || p.tipo === 'multiple') {
    const letras = (Array.isArray(valor) ? valor : [valor]).slice().sort();
    return `**Respuesta:** ${letras.join(', ')}`;
  }
  if (p.tipo === 'codigo') {
    const lenguaje = FENCE_LENGUAJE[p.lenguaje ?? ''] ?? p.lenguaje ?? '';
    const codigo = String(valor).trim() ? bloque(String(valor), lenguaje) : '_(sin código)_';
    const partes = ['**Respuesta — código:**', '', codigo];
    if (r!.explicacion?.trim()) partes.push('', '**Respuesta — explicación:**', '', bloque(r!.explicacion, 'text'));
    return partes.join('\n');
  }
  return `**Respuesta:**\n\n${bloque(String(valor), 'text')}`;
}

export function generarMd(examen: Examen, estado: Estado, fin: number, automatica: boolean): string {
  const codigo = formatear(estado.codigo);
  const inicio = estado.inicio ?? fin;
  const yaml = [
    '---',
    `examen: ${JSON.stringify(examen.id)}`,
    `modulo: ${JSON.stringify(examen.modulo)}`,
    `ciclo: ${JSON.stringify(examen.ciclo)}`,
    `curso: ${JSON.stringify(examen.curso)}`,
    `ra: ${JSON.stringify(examen.ra)}`,
    `codigo: ${JSON.stringify(codigo)}`,
    `fecha: ${isoLocal(inicio).slice(0, 10)}`,
    `inicio: ${isoLocal(inicio)}`,
    `entrega: ${isoLocal(fin)}`,
    `duracion_min: ${Math.round((fin - inicio) / 60000)}`,
    `entrega_automatica: ${automatica}`,
    '---',
  ];
  const cuerpo = [`# Examen ${examen.id} — Código ${codigo}`, ''];
  if (examen.raTexto) cuerpo.push(`> ${examen.ra}: ${examen.raTexto}`, '');
  for (const parte of examen.partes) {
    cuerpo.push(`## ${parte.titulo}`, '');
    for (const p of parte.preguntas) {
      const meta = [
        p.id, p.item, p.nivel,
        p.ce?.length ? `CE ${p.ce.join(', ')}` : null,
        p.puntos ? `${formatoPuntos(p.puntos)} pts` : null,
        describirTipo(p),
      ];
      cuerpo.push(`### ${meta.filter(Boolean).join(' · ')}`, '', p.enunciado.trim(), '');
      if (p.opciones.length) {
        cuerpo.push(...p.opciones.map((o) => `- ${o.letra}) ${o.texto}`), '');
      }
      cuerpo.push(respuestaMd(p, estado.respuestas[p.id]), '');
    }
  }
  return [...yaml, '', ...cuerpo].join('\n').replace(/\n{3,}/g, '\n\n');
}

/** `1DAM_LMSG_RA1_K7FM-2QXR-9TPA.md`, igual que en Drive (ver apps-script/Code.gs). */
export function nombreFichero(examen: Examen, codigo: string): string {
  const partes = [examen.grupo, examen.siglas, examen.ra].filter(Boolean);
  if (!partes.length) return `${examen.id}_${formatear(codigo)}.md`;
  if (examen.convocatoria && examen.convocatoria !== 'ev_continua') partes.push(examen.convocatoria);
  return `${partes.join('_')}_${formatear(codigo)}.md`;
}

export function descargar(nombre: string, contenido: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/markdown;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function respondida(r: Respuesta | undefined): boolean {
  return !vacia(r);
}
