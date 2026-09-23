import { useEffect, useMemo, useState } from 'react';
import { LETRAS, type PreguntaVista } from '../lib/barajar';
import { formatear } from '../lib/cripto';
import { formatoPuntos, respondida } from '../lib/entrega';
import { renderizar, renderizarLinea } from '../lib/markdown';
import type { Estado, Examen, Respuesta } from '../lib/tipos';
import { EditorCodigo } from './EditorCodigo';

const NIVEL_CLASE: Record<string, string> = { Básico: 'basico', Intermedio: 'intermedio', Avanzado: 'avanzado' };

export function formatoReloj(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h ? `${h}:` : ''}${pad(m)}:${pad(s % 60)}`;
}

function Reloj({ restante }: { restante: number }) {
  const min = restante / 60000;
  const clase = min <= 5 ? 'reloj rojo' : min <= 10 ? 'reloj ambar' : 'reloj';
  return <div className={clase} aria-label="Tiempo restante">{formatoReloj(restante)}</div>;
}

interface Props {
  examen: Examen;
  vista: PreguntaVista[];
  estado: Estado;
  restante: number;
  alResponder: (id: string, r: Respuesta) => void;
  alMover: (indice: number) => void;
  alMarcar: (id: string) => void;
  alEntregar: () => void;
}

export function VistaExamen({ examen, vista, estado, restante, alResponder, alMover, alMarcar, alEntregar }: Props) {
  const [confirmar, setConfirmar] = useState(false);
  const actual = Math.min(estado.actual, vista.length - 1);
  const p = vista[actual];
  const respondidas = vista.filter((q) => respondida(estado.respuestas[q.id])).length;
  const partes = useMemo(() => {
    const grupos: { id: string; titulo: string; items: { q: PreguntaVista; i: number }[] }[] = [];
    vista.forEach((q, i) => {
      let g = grupos.find((x) => x.id === q.parteId);
      if (!g) grupos.push((g = { id: q.parteId, titulo: q.parteTitulo, items: [] }));
      g.items.push({ q, i });
    });
    return grupos;
  }, [vista]);

  // Atajos: Alt+→ / Alt+← para moverse sin ratón.
  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === 'ArrowRight' && actual < vista.length - 1) alMover(actual + 1);
      if (e.key === 'ArrowLeft' && actual > 0) alMover(actual - 1);
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  }, [actual, vista.length, alMover]);

  return (
    <div className="examen">
      <header className="cabecera">
        <div className="cabecera-titulo">
          <strong>{examen.id}</strong>
          <span className="codigo-alumno">Código {formatear(estado.codigo)}</span>
        </div>
        <div className="cabecera-aviso">No escribas tu nombre en ninguna respuesta</div>
        <Reloj restante={restante} />
      </header>

      <nav className="indice" aria-label="Preguntas">
        {partes.map((g) => (
          <div key={g.id} className="indice-parte">
            <h2 title={g.titulo}>{g.titulo}</h2>
            <div className="indice-botones">
              {g.items.map(({ q, i }) => {
                const hecha = respondida(estado.respuestas[q.id]);
                const marcada = estado.marcadas.includes(q.id);
                return (
                  <button
                    key={q.id}
                    className={`indice-boton ${i === actual ? 'actual' : ''} ${hecha ? 'hecha' : ''} ${marcada ? 'marcada' : ''}`}
                    onClick={() => alMover(i)}
                    aria-current={i === actual}
                    title={`${hecha ? 'Respondida' : 'Pendiente'}${marcada ? ' · marcada para revisar' : ''}`}
                  >
                    {q.parteId}{q.numero}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="indice-pie">
          <div className="progreso">
            <div className="progreso-barra" style={{ width: `${(respondidas / vista.length) * 100}%` }} />
          </div>
          <p>{respondidas} de {vista.length} respondidas</p>
          <p className="leyenda"><span className="punto hecha" /> respondida <span className="punto marcada" /> revisar</p>
          <button className="boton peligro" onClick={() => setConfirmar(true)}>Entregar examen</button>
        </div>
      </nav>

      <main className="pregunta" key={p.id}>
        <div className="pregunta-meta">
          <span>{p.parteTitulo}</span>
          <span className="pregunta-num">Pregunta {p.parteId}{p.numero}</span>
          {p.nivel && <span className={`nivel ${NIVEL_CLASE[p.nivel] ?? ''}`}>{p.nivel}</span>}
          {!!p.puntos && (
            <span className="puntos" title="Lo que suma esta pregunta a la nota del examen, sobre 10">
              {formatoPuntos(p.puntos)} puntos
            </span>
          )}
        </div>
        <article className="enunciado" dangerouslySetInnerHTML={{ __html: renderizar(p.enunciado) }} />
        <ZonaRespuesta pregunta={p} respuesta={estado.respuestas[p.id]} alResponder={(r) => alResponder(p.id, r)} />
        <div className="navegacion">
          <button className="boton" disabled={actual === 0} onClick={() => alMover(actual - 1)}>← Anterior</button>
          <button className={`boton ${estado.marcadas.includes(p.id) ? 'activo' : ''}`} onClick={() => alMarcar(p.id)}>
            {estado.marcadas.includes(p.id) ? '★ Marcada para revisar' : '☆ Marcar para revisar'}
          </button>
          {actual < vista.length - 1 ? (
            <button className="boton primario" onClick={() => alMover(actual + 1)}>Siguiente →</button>
          ) : (
            <button className="boton peligro" onClick={() => setConfirmar(true)}>Entregar</button>
          )}
        </div>
      </main>

      {confirmar && (
        <div className="capa-modal" role="dialog" aria-modal="true">
          <div className="tarjeta modal">
            <h2>¿Entregar el examen?</h2>
            <p>Has respondido <strong>{respondidas} de {vista.length}</strong> preguntas.</p>
            {respondidas < vista.length && <p className="aviso aviso-alerta">Te quedan {vista.length - respondidas} preguntas sin responder.</p>}
            {estado.marcadas.length > 0 && <p>Tienes {estado.marcadas.length} marcadas para revisar.</p>}
            <p>Una vez entregado no podrás volver a entrar.</p>
            <div className="navegacion">
              <button className="boton" onClick={() => setConfirmar(false)} autoFocus>Seguir con el examen</button>
              <button className="boton peligro" onClick={() => { setConfirmar(false); alEntregar(); }}>Entregar definitivamente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ZonaRespuesta({ pregunta: p, respuesta, alResponder }: {
  pregunta: PreguntaVista;
  respuesta: Respuesta | undefined;
  alResponder: (r: Respuesta) => void;
}) {
  if (p.tipo === 'unica' || p.tipo === 'multiple') {
    const marcadas = new Set(Array.isArray(respuesta?.valor) ? respuesta.valor : respuesta?.valor ? [respuesta.valor] : []);
    const alternar = (letra: string) => {
      if (p.tipo === 'unica') return alResponder({ valor: marcadas.has(letra) ? '' : letra });
      const s = new Set(marcadas);
      s.has(letra) ? s.delete(letra) : s.add(letra);
      alResponder({ valor: [...s].sort() });
    };
    return (
      <fieldset className="opciones">
        <legend>{p.tipo === 'unica' ? 'Elige una opción' : 'Marca todas las correctas'}</legend>
        {p.opcionesVista.map((o, i) => (
          <label key={o.letra} className={`opcion ${marcadas.has(o.letra) ? 'elegida' : ''}`}>
            <input
              type={p.tipo === 'unica' ? 'radio' : 'checkbox'}
              name={`p-${p.id}`}
              checked={marcadas.has(o.letra)}
              onChange={() => alternar(o.letra)}
              onClick={(e) => p.tipo === 'unica' && marcadas.has(o.letra) && (e.preventDefault(), alternar(o.letra))}
            />
            <span className="opcion-letra">{LETRAS[i]})</span>
            <span dangerouslySetInnerHTML={{ __html: renderizarLinea(o.texto) }} />
          </label>
        ))}
      </fieldset>
    );
  }
  if (p.tipo === 'codigo') {
    return (
      <div className="respuesta-codigo">
        <label className="etiqueta">Tu código <span className="lenguaje">{p.lenguaje}</span></label>
        <EditorCodigo
          key={p.id}
          lenguaje={p.lenguaje ?? 'texto'}
          valor={typeof respuesta?.valor === 'string' ? respuesta.valor : ''}
          alCambiar={(valor) => alResponder({ valor, explicacion: respuesta?.explicacion })}
        />
        <label className="etiqueta" htmlFor={`exp-${p.id}`}>Explicación o respuestas a los apartados (opcional)</label>
        <textarea
          id={`exp-${p.id}`}
          className="texto-libre corto"
          spellCheck={false}
          value={respuesta?.explicacion ?? ''}
          onChange={(e) => alResponder({ valor: typeof respuesta?.valor === 'string' ? respuesta.valor : '', explicacion: e.target.value })}
        />
      </div>
    );
  }
  return (
    <div className="respuesta-texto">
      <label className="etiqueta" htmlFor={`txt-${p.id}`}>Tu respuesta</label>
      <textarea
        id={`txt-${p.id}`}
        className="texto-libre"
        spellCheck={false}
        autoFocus
        value={typeof respuesta?.valor === 'string' ? respuesta.valor : ''}
        onChange={(e) => alResponder({ valor: e.target.value })}
      />
    </div>
  );
}
