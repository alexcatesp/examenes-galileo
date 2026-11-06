import {
  acceptCompletion, autocompletion, closeBrackets, closeBracketsKeymap, type Completion, type CompletionContext, type CompletionResult,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentLess, insertNewline, insertNewlineAndIndent } from '@codemirror/commands';
import { indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { Compartment, EditorState } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';
import { useIdioma } from '../lib/i18n';
import { analizar } from '../lib/java/analisis';
import type { Miembro } from '../lib/java/catalogo';
import { enComentarioOTexto, sugerenciasPunto, variablesDeclaradas } from '../lib/java/completado';
import { ANCHO_TAB, LENGUAJES, RESALTADO, tabulador } from './EditorCodigo';

interface Problema {
  gravedad: 'error' | 'warning';
  linea: number;
  desde: number;
  mensaje: string;
}

// ── Ayuda contextual ──────────────────────────────────────────────────────

const parametrosDe = (m: Miembro) => (m.clave === 'c' ? '' : `(${m.parametros.map((p) => `${p.tipo} ${p.nombre}`).join(', ')})`);

function ayudaMiembros(ms: Miembro[], clase: string, modo: 'estatico' | 'instancia'): HTMLElement {
  const raiz = document.createElement('div');
  raiz.className = 'ayuda-java';
  for (const m of ms) {
    const bloque = document.createElement('div');
    bloque.className = 'ayuda-java-miembro';
    const firma = document.createElement('code');
    const retorno = m.retorno === '?' ? 'Object' : m.retorno;
    firma.textContent = `${m.clave === 's' && modo === 'estatico' ? `${clase}.` : ''}${m.nombre}${parametrosDe(m)}${m.clave === 'c' ? '' : ` → ${retorno}`}`;
    const texto = document.createElement('p');
    texto.textContent = m.ayuda;
    bloque.append(firma, texto);
    raiz.append(bloque);
  }
  const pie = document.createElement('small');
  pie.textContent = `${clase} · ${modo === 'estatico' ? 'estático' : 'de instancia'}`;
  raiz.append(pie);
  return raiz;
}

/** Inserta «nombre()» dejando el cursor dentro de los paréntesis si el método recibe argumentos. */
function aplicarMetodo(nombre: string, conArgumentos: boolean) {
  return (vista: EditorView, _c: Completion, desde: number, hasta: number) => {
    const sigue = vista.state.doc.sliceString(hasta, hasta + 1) === '(';
    const texto = sigue ? nombre : `${nombre}()`;
    const cursor = desde + nombre.length + (sigue ? 0 : conArgumentos ? 1 : 2);
    vista.dispatch({ changes: { from: desde, to: hasta, insert: texto }, selection: { anchor: cursor }, userEvent: 'input.complete' });
  };
}

const ATAJOS: Completion[] = [
  { label: 'sysout', type: 'keyword', detail: 'System.out.println()', info: 'Escribe una línea en la consola.', apply: (v, _c, d, h) => v.dispatch({ changes: { from: d, to: h, insert: 'System.out.println()' }, selection: { anchor: d + 19 } }) },
  { label: 'main', type: 'keyword', detail: 'método main', info: 'Punto de entrada del programa.', apply: (v, _c, d, h) => v.dispatch({ changes: { from: d, to: h, insert: 'public static void main(String[] args) {\n    \n}' }, selection: { anchor: d + 46 } }) },
];

function fuenteJava(contexto: CompletionContext): CompletionResult | null {
  const codigo = contexto.state.doc.toString();
  if (enComentarioOTexto(codigo, contexto.pos)) return null;
  const s = sugerenciasPunto(codigo, contexto.pos);
  if (s) {
    const porNombre = new Map<string, Miembro[]>();
    for (const m of s.miembros) porNombre.set(m.nombre, [...(porNombre.get(m.nombre) ?? []), m]);
    const opciones: Completion[] = [...porNombre.entries()].map(([nombre, ms]) => {
      const esMetodo = ms.some((m) => m.clave === 'm' || m.clave === 's');
      const unico = ms.length === 1;
      const retorno = ms[0].retorno === '?' ? 'Object' : ms[0].retorno;
      return {
        label: nombre,
        type: esMetodo ? 'method' : 'constant',
        detail: esMetodo ? (unico ? `${parametrosDe(ms[0])} → ${retorno}` : `  ${ms.length} variantes`) : ` : ${retorno}`,
        info: () => ayudaMiembros(ms, s.clase, s.modo),
        apply: esMetodo ? aplicarMetodo(nombre, ms.every((m) => m.parametros.length > 0)) : nombre,
        // Primero lo estático o lo propio de la clase; lo heredado de Object, al final.
        boost: ms[0].clase === 'Object' || ['equals', 'hashCode', 'toString', 'getClass'].includes(nombre) ? -5 : 0,
      };
    });
    return { from: s.desde, options: opciones, validFor: /^\w*$/ };
  }
  const palabra = contexto.matchBefore(/[A-Za-z_$][\w$]*/);
  if (!palabra) return null;
  const antes = codigo.slice(0, palabra.from).trimEnd();
  if (antes.endsWith('.') || /(^|\s)(import|package)\s[\w.]*$/.test(codigo.slice(codigo.lastIndexOf('\n', palabra.from) + 1, palabra.to))) return null;
  if (palabra.to - palabra.from < 2 && !contexto.explicit) return null;
  const variables: Completion[] = variablesDeclaradas(codigo).map((v) => ({ label: v, type: 'variable' }));
  return { from: palabra.from, options: [...variables, ...ATAJOS], validFor: /^[\w$]*$/ };
}

function diagnosticos(vista: EditorView): Diagnostic[] {
  const doc = vista.state.doc;
  return analizar(doc.toString()).map((d) => ({
    from: d.desde,
    to: Math.min(doc.length, Math.max(d.hasta, d.desde + 1)),
    severity: d.gravedad,
    message: d.mensaje,
  }));
}

// ── Componente ────────────────────────────────────────────────────────────

interface Props {
  valor: string;
  alCambiar: (valor: string) => void;
  fichero: string;
  /** Sugerencias de miembros con ayuda en español y errores subrayados. */
  ayudas?: boolean;
  /** Sangría automática y cierre de llaves, paréntesis y comillas. */
  autoEscritura?: boolean;
}

/** Editor con aspecto de IDE (pestaña, números de línea, barra de estado). */
export function EditorIDE({ valor, alCambiar, fichero, ayudas = false, autoEscritura = false }: Props) {
  const { t } = useIdioma();
  const contenedor = useRef<HTMLDivElement>(null);
  const vista = useRef<EditorView | null>(null);
  const cambio = useRef(alCambiar);
  cambio.current = alCambiar;
  const [posicion, setPosicion] = useState({ l: 1, c: 1 });
  const [problemas, setProblemas] = useState<Problema[]>([]);

  useEffect(() => {
    const idioma = new Compartment();
    const extensiones = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      indentUnit.of(' '.repeat(ANCHO_TAB)),
      EditorState.tabSize.of(ANCHO_TAB),
      EditorView.lineWrapping,
      syntaxHighlighting(RESALTADO, { fallback: true }),
      ...(autoEscritura ? [closeBrackets(), indentOnInput()] : []),
      ...(ayudas
        ? [
            autocompletion({ override: [fuenteJava], icons: true, maxRenderedOptions: 60, closeOnBlur: true }),
            lintGutter(),
            linter((v) => {
              const lista = diagnosticos(v);
              setProblemas(lista.map((d) => ({ gravedad: d.severity as 'error' | 'warning', linea: v.state.doc.lineAt(d.from).number, desde: d.from, mensaje: d.message })));
              return lista;
            }, { delay: 350 }),
          ]
        : []),
      keymap.of([
        { key: 'Tab', run: acceptCompletion },
        { key: 'Enter', run: autoEscritura ? insertNewlineAndIndent : insertNewline, shift: autoEscritura ? insertNewlineAndIndent : insertNewline },
        { key: 'Tab', run: tabulador },
        { key: 'Shift-Tab', run: indentLess },
        ...(autoEscritura ? closeBracketsKeymap : []),
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) cambio.current(u.state.doc.toString());
        if (u.docChanged || u.selectionSet) {
          const cabeza = u.state.selection.main.head;
          const linea = u.state.doc.lineAt(cabeza);
          setPosicion({ l: linea.number, c: cabeza - linea.from + 1 });
        }
      }),
      idioma.of([]),
    ];
    const view = new EditorView({ parent: contenedor.current!, state: EditorState.create({ doc: valor, extensions: extensiones }) });
    vista.current = view;
    view.focus();
    let vivo = true;
    LENGUAJES.java?.().then((ext) => vivo && view.dispatch({ effects: idioma.reconfigure(ext) }));
    return () => {
      vivo = false;
      view.destroy();
      vista.current = null;
    };
    // El editor se crea una vez por pregunta (key en el padre); `valor` es solo el inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayudas, autoEscritura]);

  const irA = (desde: number) => {
    const v = vista.current;
    if (!v) return;
    v.dispatch({ selection: { anchor: desde }, scrollIntoView: true });
    v.focus();
  };

  const errores = problemas.filter((p) => p.gravedad === 'error').length;
  const avisos = problemas.length - errores;

  return (
    <div className="ide">
      <div className="ide-pestanas">
        <span className="ide-pestana"><span className="ide-icono" aria-hidden="true">J</span>{fichero}</span>
        {ayudas && <span className="ide-ayudas">{t('ideAyudas')}</span>}
      </div>
      <div className="ide-editor editor-codigo" ref={contenedor} />
      {ayudas && (
        <div className="ide-problemas" role="region" aria-label={t('ideProblemas')}>
          <div className="ide-problemas-titulo">{t('ideProblemas')} <span className="ide-contador">{problemas.length}</span></div>
          {problemas.length === 0 ? (
            <p className="ide-sin-problemas">{t('ideSinProblemas')}</p>
          ) : (
            <ul>
              {problemas.map((p, i) => (
                <li key={`${p.desde}-${i}`}>
                  <button type="button" onClick={() => irA(p.desde)} className={`ide-problema ${p.gravedad}`}>
                    <span className="ide-problema-icono" aria-hidden="true">{p.gravedad === 'error' ? '✖' : '▲'}</span>
                    <span className="ide-problema-texto">{p.mensaje}</span>
                    <span className="ide-problema-linea">{t('ideLinea', { n: p.linea })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="ide-estado">
        <span>Java</span>
        <span>{t('ideEstado', { l: posicion.l, c: posicion.c })}</span>
        {ayudas && <span className={errores ? 'con-errores' : ''}>{t('ideContador', { e: errores, a: avisos })}</span>}
      </div>
    </div>
  );
}
