import { useEffect, useMemo, useState, type KeyboardEvent as TeclaReact } from 'react';
import { LETRAS, type PreguntaVista } from '../lib/barajar';
import { formatear } from '../lib/cripto';
import { formatoPuntos, respondida } from '../lib/entrega';
import { useIdioma } from '../lib/i18n';
import { renderizar, renderizarLinea } from '../lib/markdown';
import { textosPregunta, traduccionDe } from '../lib/traducciones';
import type { Estado, Examen, Respuesta } from '../lib/tipos';
import { ANCHO_TAB, EditorCodigo } from './EditorCodigo';
import { SelectorIdioma } from './Pantallas';
import { Rico } from './Rico';

const NIVEL_CLASE: Record<string, string> = { Básico: 'basico', Intermedio: 'intermedio', Avanzado: 'avanzado' };
const NIVEL_CLAVE = { Básico: 'nivelBasico', Intermedio: 'nivelIntermedio', Avanzado: 'nivelAvanzado' } as const;

/** Tab en un textarea inserta espacios hasta el siguiente tope de 4 columnas, igual que el editor de código,
 *  en vez de saltar al siguiente campo.
 *  Con Mayús+Tab o Ctrl/Alt/Meta se conserva el comportamiento normal para poder salir con el teclado. */
function sangrarConTab(e: TeclaReact<HTMLTextAreaElement>, alCambiar: (v: string) => void) {
  if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
  e.preventDefault();
  const t = e.currentTarget;
  const { selectionStart: a, selectionEnd: b, value } = t;
  const columna = a - (value.lastIndexOf('\n', a - 1) + 1);
  const espacios = ' '.repeat(ANCHO_TAB - (columna % ANCHO_TAB));
  alCambiar(value.slice(0, a) + espacios + value.slice(b));
  requestAnimationFrame(() => t.setSelectionRange(a + espacios.length, a + espacios.length));
}

export function horaDe(ms: number): string {
  return new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function formatoReloj(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h ? `${h}:` : ''}${pad(m)}:${pad(s % 60)}`;
}

function Reloj({ restante, hasta }: { restante: number; hasta?: number }) {
  const { t } = useIdioma();
  const min = restante / 60000;
  const clase = min <= 5 ? 'reloj rojo' : min <= 10 ? 'reloj ambar' : 'reloj';
  return (
    <div className={clase} aria-label={t('tiempoRestante')}>
      {formatoReloj(restante)}
      {hasta && <small className="reloj-fin">{t('hastaLas', { h: horaDe(hasta) })}</small>}
    </div>
  );
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
  const { idioma, t } = useIdioma();
  const [confirmar, setConfirmar] = useState(false);
  // Por defecto se ve el idioma elegido; el alumno puede pedir el original en español de una pregunta.
  const [original, setOriginal] = useState<Record<string, boolean>>({});
  const trad = traduccionDe(examen, idioma);
  const tituloParte = (id: string, titulo: string) => trad?.partes?.[id] ?? titulo;
  const actual = Math.min(estado.actual, vista.length - 1);
  const p = vista[actual];
  const textos = textosPregunta(p, original[p.id] ? undefined : trad);
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
          <span className="codigo-alumno">{t('codigo')} {formatear(estado.codigo)}</span>
        </div>
        <div className="cabecera-aviso">{t('noNombre')}</div>
        <SelectorIdioma />
        <Reloj restante={restante} hasta={examen.fin} />
      </header>

      <nav className="indice" aria-label={t('preguntasNav')}>
        {partes.map((g) => (
          <div key={g.id} className="indice-parte">
            <h2 title={tituloParte(g.id, g.titulo)}>{tituloParte(g.id, g.titulo)}</h2>
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
                    title={`${hecha ? t('respondida') : t('pendiente')}${marcada ? ` · ${t('marcadaRevisar')}` : ''}`}
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
          <p>{t('respondidasDe', { a: respondidas, b: vista.length })}</p>
          <p className="leyenda"><span className="punto hecha" /> {t('leyendaRespondida')} <span className="punto marcada" /> {t('leyendaRevisar')}</p>
          <button className="boton peligro" onClick={() => setConfirmar(true)}>{t('entregarExamen')}</button>
        </div>
      </nav>

      <main className="pregunta" key={p.id}>
        <div className="pregunta-meta">
          <span>{tituloParte(p.parteId, p.parteTitulo)}</span>
          <span className="pregunta-num">{t('pregunta')} {p.parteId}{p.numero}</span>
          {p.nivel && <span className={`nivel ${NIVEL_CLASE[p.nivel] ?? ''}`}>{p.nivel in NIVEL_CLAVE ? t(NIVEL_CLAVE[p.nivel as keyof typeof NIVEL_CLAVE]) : p.nivel}</span>}
          {!!p.puntos && (
            <span className="puntos" title={t('puntosTitulo')}>
              {t('puntosPregunta', { n: formatoPuntos(p.puntos) })}
            </span>
          )}
        </div>
        {idioma !== 'es' && (
          <div className="barra-traduccion">
            <span lang={idioma}>{trad?.preguntas[p.id] ? t('avisoTraduccion') : t('sinTraduccion')}</span>
            {trad?.preguntas[p.id] && (
              <button className="boton discreto" onClick={() => setOriginal((o) => ({ ...o, [p.id]: !o[p.id] }))}>
                {original[p.id] ? t('verTraduccion') : t('verOriginal')}
              </button>
            )}
          </div>
        )}
        <article
          className="enunciado"
          lang={original[p.id] ? 'es' : idioma}
          dangerouslySetInnerHTML={{ __html: renderizar(textos.enunciado) }}
        />
        <ZonaRespuesta
          pregunta={p}
          textoOpcion={textos.opcion}
          respuesta={estado.respuestas[p.id]}
          alResponder={(r) => alResponder(p.id, r)}
        />
        <div className="navegacion">
          <button className="boton" disabled={actual === 0} onClick={() => alMover(actual - 1)}>{t('anterior')}</button>
          <button className={`boton ${estado.marcadas.includes(p.id) ? 'activo' : ''}`} onClick={() => alMarcar(p.id)}>
            {estado.marcadas.includes(p.id) ? t('marcada') : t('marcar')}
          </button>
          {actual < vista.length - 1 ? (
            <button className="boton primario" onClick={() => alMover(actual + 1)}>{t('siguiente')}</button>
          ) : (
            <button className="boton peligro" onClick={() => setConfirmar(true)}>{t('entregar')}</button>
          )}
        </div>
      </main>

      {confirmar && (
        <div className="capa-modal" role="dialog" aria-modal="true">
          <div className="tarjeta modal">
            <h2>{t('entregarTitulo')}</h2>
            <p><Rico texto={t('hasRespondido', { a: respondidas, b: vista.length })} /></p>
            {respondidas < vista.length && <p className="aviso aviso-alerta">{t('teQuedan', { n: vista.length - respondidas })}</p>}
            {estado.marcadas.length > 0 && <p>{t('tienesMarcadas', { n: estado.marcadas.length })}</p>}
            <p>{t('noVolverEntrar')}</p>
            <div className="navegacion">
              <button className="boton" onClick={() => setConfirmar(false)} autoFocus>{t('seguir')}</button>
              <button className="boton peligro" onClick={() => { setConfirmar(false); alEntregar(); }}>{t('entregarDef')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ZonaRespuesta({ pregunta: p, textoOpcion, respuesta, alResponder }: {
  pregunta: PreguntaVista;
  textoOpcion: (letra: string, original: string) => string;
  respuesta: Respuesta | undefined;
  alResponder: (r: Respuesta) => void;
}) {
  const { t } = useIdioma();
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
        <legend>{p.tipo === 'unica' ? t('eligeUna') : t('marcaTodas')}</legend>
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
            <span dangerouslySetInnerHTML={{ __html: renderizarLinea(textoOpcion(o.letra, o.texto)) }} />
          </label>
        ))}
      </fieldset>
    );
  }
  if (p.tipo === 'codigo') {
    return (
      <div className="respuesta-codigo">
        {/* «Tu código» solo si la pregunta se marcó como código puro; si no, puede mezclar teoría y código. */}
        <label className="etiqueta">
          {p.soloCodigo ? <>{t('tuCodigo')} <span className="lenguaje">{p.lenguaje}</span></> : t('tuRespuesta')}
        </label>
        <EditorCodigo
          key={p.id}
          lenguaje={p.lenguaje ?? 'texto'}
          valor={typeof respuesta?.valor === 'string' ? respuesta.valor : ''}
          alCambiar={(valor) => alResponder({ valor, explicacion: respuesta?.explicacion })}
        />
        <label className="etiqueta" htmlFor={`exp-${p.id}`}>{t('explicacion')}</label>
        <textarea
          id={`exp-${p.id}`}
          className="texto-libre corto"
          wrap="soft"
          spellCheck={false}
          value={respuesta?.explicacion ?? ''}
          onChange={(e) => alResponder({ valor: typeof respuesta?.valor === 'string' ? respuesta.valor : '', explicacion: e.target.value })}
          onKeyDown={(e) => sangrarConTab(e, (v) => alResponder({ valor: typeof respuesta?.valor === 'string' ? respuesta.valor : '', explicacion: v }))}
        />
      </div>
    );
  }
  return (
    <div className="respuesta-texto">
      <label className="etiqueta" htmlFor={`txt-${p.id}`}>{t('tuRespuesta')}</label>
      <textarea
        id={`txt-${p.id}`}
        className="texto-libre"
        wrap="soft"
          spellCheck={false}
        autoFocus
        value={typeof respuesta?.valor === 'string' ? respuesta.valor : ''}
        onChange={(e) => alResponder({ valor: e.target.value })}
        onKeyDown={(e) => sangrarConTab(e, (v) => alResponder({ valor: v }))}
      />
    </div>
  );
}
