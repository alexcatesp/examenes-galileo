import { describe, expect, it } from 'vitest';
import { ordenAlumno } from '../barajar';
import { abrirPaquete, CodigoNoValido, codigoValido, contrasenaCorrecta, formatear, normalizar, semilla } from '../cripto';
import { formatoPuntos, generarMd, nombreFichero, respondida } from '../entrega';
import { desfaseDe } from '../receptor';
import type { Estado, Examen, Paquete } from '../tipos';
import datos from './paquete-python.json';

// paquete-python.json lo genera scripts/cripto.py: estos tests garantizan que
// la app descifra exactamente lo que cifra el script.
const paquete = datos.paquete as Paquete;

describe('códigos', () => {
  it('acepta los códigos del script con cualquier formato tecleado', () => {
    for (const c of datos.codigos) {
      expect(codigoValido(c)).toBe(true);
      expect(codigoValido(c.toLowerCase().replaceAll('-', ' ').replaceAll('0', 'o').replaceAll('1', 'l'))).toBe(true);
      expect(formatear(normalizar(c))).toBe(c);
    }
  });
  it('rechaza una errata', () => {
    const c = normalizar(datos.codigos[0]);
    const otra = c[0] === 'A' ? 'B' : 'A';
    expect(codigoValido(otra + c.slice(1))).toBe(false);
  });
});

describe('cifrado compatible con Python', () => {
  it('abre el paquete con cada código', async () => {
    for (const c of datos.codigos) {
      const { examen } = await abrirPaquete(paquete, c.toLowerCase());
      expect(examen).toEqual(datos.examen);
    }
  });
  it('rechaza un código válido de otro examen', async () => {
    await expect(abrirPaquete(paquete, 'ABCD-EFGH-JKM' + 'N')).rejects.toThrow();
    const ajeno = '0000-0000-000' + '0';
    await expect(abrirPaquete(paquete, ajeno)).rejects.toBeInstanceOf(CodigoNoValido);
  });
  it('comprueba la contraseña del profesor', async () => {
    const { examen } = await abrirPaquete(paquete, datos.codigos[0]);
    expect(await contrasenaCorrecta(examen, 'profe123')).toBe(true);
    expect(await contrasenaCorrecta(examen, ' profe123 ')).toBe(true);
    expect(await contrasenaCorrecta(examen, 'PROFE123')).toBe(true);
    expect(await contrasenaCorrecta(examen, 'profe124')).toBe(false);
  });
});

describe('barajado', () => {
  const examen = datos.examen as unknown as Examen;
  it('es estable para el mismo código y conserva todas las preguntas y opciones', async () => {
    const s = await semilla(examen.id, datos.codigos[0]);
    const a = ordenAlumno(examen, s);
    expect(ordenAlumno(examen, s)).toEqual(a);
    expect(a.map((p) => p.id).sort()).toEqual(['A1', 'A2', 'B1', 'B2']);
    expect(a.slice(0, 2).every((p) => p.parteId === 'A')).toBe(true);
    const a1 = a.find((p) => p.id === 'A1')!;
    expect(a1.opcionesVista.map((o) => o.letra).sort()).toEqual(['a', 'b', 'c']);
  });
  it('cambia de un código a otro', async () => {
    const ordenes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const v = ordenAlumno(examen, await semilla(examen.id, `codigo-${i}`));
      ordenes.add(v.map((p) => p.id + p.opcionesVista.map((o) => o.letra).join('')).join());
    }
    expect(ordenes.size).toBeGreaterThan(3);
  });
});

describe('fichero de respuestas', () => {
  const examen = datos.examen as unknown as Examen;
  const estado: Estado = {
    id: examen.id, loc: 'x', codigo: datos.codigos[0].toLowerCase(), inicio: Date.UTC(2026, 9, 5, 7, 0), desfase: 0, marcadas: [], actual: 0, entregado: null,
    respuestas: {
      A1: { valor: 'a' },
      A2: { valor: ['b', 'a'] },
      B1: { valor: '<a>```x```</a>', explicacion: 'Uso un elemento raíz' },
    },
  };
  const md = generarMd(examen, estado, Date.UTC(2026, 9, 5, 8, 0), false);

  it('lleva el código y ningún dato personal', () => {
    expect(md).toContain(`codigo: "${datos.codigos[0]}"`);
    expect(md).not.toMatch(/nombre|alumno/i);
  });
  it('mantiene el orden y las letras canónicas', () => {
    expect(md.indexOf('### A1')).toBeLessThan(md.indexOf('### A2'));
    expect(md.indexOf('### A2')).toBeLessThan(md.indexOf('### B1'));
    expect(md).toContain('- a) Un lenguaje');
    expect(md).toContain('**Respuesta:** a\n');
    expect(md).toContain('**Respuesta:** a, b');
  });
  it('protege el código con un delimitador más largo que su contenido', () => {
    expect(md).toContain('**Respuesta — código:**\n\n````xml\n<a>```x```</a>\n````');
    expect(md).toContain('**Respuesta — explicación:**\n\n```text\nUso un elemento raíz\n```');
  });
  it('marca las preguntas sin responder', () => {
    expect(md).toMatch(/### B2[^\n]*\n\nExplica ñandú\n\n\*\*Respuesta:\*\* _\(sin responder\)_/);
    expect(md).toContain('### B1 · RA1-INT-I-01 · Intermedio · CE c, d · código (xml)');
    expect(md).toContain('duracion_min: 60');
  });
});

// ── Flujos alternativos: lo que pasa cuando algo no va como debería ──────

describe('entrega en casos límite', () => {
  const examen = datos.examen as unknown as Examen;
  const base: Estado = {
    id: examen.id, loc: 'x', codigo: datos.codigos[0], inicio: Date.UTC(2026, 9, 5, 7, 0), desfase: 0,
    marcadas: [], actual: 0, entregado: null, respuestas: {},
  };

  it('entrega un examen en blanco sin romperse', () => {
    const md = generarMd(examen, base, Date.UTC(2026, 9, 5, 8, 0), true);
    expect(md.match(/_\(sin responder\)_/g)).toHaveLength(4);
    expect(md).toContain('entrega_automatica: true');
  });

  it('ignora respuestas de preguntas que ya no existen', () => {
    // Pasa si se recifra el examen y el navegador conserva el estado anterior.
    const estado = { ...base, respuestas: { BORRADA: { valor: 'algo de otro examen' } } };
    const md = generarMd(examen, estado, Date.UTC(2026, 9, 5, 8, 0), false);
    expect(md).not.toContain('algo de otro examen');
    expect(md).not.toContain('BORRADA');
  });

  it('no cuenta como respondida una respuesta vacía o en blanco', () => {
    expect(respondida(undefined)).toBe(false);
    expect(respondida({ valor: '' })).toBe(false);
    expect(respondida({ valor: '   \n  ' })).toBe(false);
    expect(respondida({ valor: [] })).toBe(false);
    expect(respondida({ valor: '', explicacion: 'solo la explicación' })).toBe(true);
    expect(respondida({ valor: ['a'] })).toBe(true);
  });

  it('nunca produce una fecha de entrega anterior al inicio', () => {
    const md = generarMd(examen, base, base.inicio!, false);
    expect(md).toContain('duracion_min: 0');
  });
});

describe('nombre del fichero de entrega', () => {
  const examen = datos.examen as unknown as Examen;

  it('usa grupo, módulo y RA', () => {
    expect(nombreFichero(examen, datos.codigos[0])).toBe(`1DAM_LMSG_RA1_${datos.codigos[0]}.md`);
  });

  it('añade la convocatoria solo en las finales', () => {
    const final = { ...examen, convocatoria: '1a_final' };
    expect(nombreFichero(final, datos.codigos[0])).toBe(`1DAM_LMSG_RA1_1a_final_${datos.codigos[0]}.md`);
  });

  it('vuelve al id del examen si un paquete antiguo no trae grupo ni siglas', () => {
    const antiguo = { ...examen, grupo: '', siglas: '', ra: '' };
    expect(nombreFichero(antiguo, datos.codigos[0])).toBe(`COMPAT-RA1_${datos.codigos[0]}.md`);
  });

  it('normaliza el código aunque venga mal tecleado', () => {
    const tecleado = datos.codigos[0].toLowerCase().replaceAll('-', '');
    expect(nombreFichero(examen, tecleado)).toBe(nombreFichero(examen, datos.codigos[0]));
  });
});

describe('puntos por pregunta', () => {
  it('los escribe con coma decimal, como una nota', () => {
    expect(formatoPuntos(0.7)).toBe('0,70');
    expect(formatoPuntos(1.71)).toBe('1,71');
    expect(formatoPuntos(5)).toBe('5,00');
  });

  it('aparecen en la cabecera de cada pregunta del fichero de respuestas', () => {
    const examen = datos.examen as unknown as Examen;
    const conPuntos: Examen = {
      ...examen,
      partes: examen.partes.map((p) => ({ ...p, preguntas: p.preguntas.map((q) => ({ ...q, puntos: 1.25 })) })),
    };
    const estado: Estado = {
      id: examen.id, loc: 'x', codigo: datos.codigos[0], inicio: 1, desfase: 0,
      marcadas: [], actual: 0, entregado: null, respuestas: {},
    };
    const md = generarMd(conPuntos, estado, 2, false);
    expect(md).toContain('### A1 · Básico · CE a · 1,25 pts · test (única)');
  });

  it('una pregunta sin puntos no ensucia la cabecera', () => {
    const md = generarMd(datos.examen as unknown as Examen, {
      id: 'x', loc: 'x', codigo: datos.codigos[0], inicio: 1, desfase: 0,
      marcadas: [], actual: 0, entregado: null, respuestas: {},
    }, 2, false);
    expect(md).toContain('### A1 · Básico · CE a · test (única)');
    expect(md).not.toContain('pts');
  });
});

describe('reloj del receptor', () => {
  it('no se fía del reloj local si el receptor no responde', () => {
    expect(desfaseDe(undefined, Date.now())).toBeNull();
    expect(desfaseDe(0, Date.now())).toBeNull();
  });

  it('calcula el desfase descontando medio viaje de red', () => {
    const antes = Date.now() - 1000; // la llamada tardó ~1 s
    const desfase = desfaseDe(Date.now() + 60_000, antes)!;
    expect(desfase).toBeGreaterThan(60_000);
    expect(desfase).toBeLessThan(61_000);
  });

  it('detecta un reloj local atrasado a propósito', () => {
    // El alumno atrasa su equipo una hora para ganar tiempo.
    const desfase = desfaseDe(Date.now() + 3_600_000, Date.now())!;
    expect(Math.round(desfase / 60_000)).toBe(60);
  });
});
