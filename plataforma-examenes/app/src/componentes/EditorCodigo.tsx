import { defaultKeymap, history, historyKeymap, indentLess, indentMore, insertNewline } from '@codemirror/commands';
import {
  HighlightStyle, indentUnit, type LanguageSupport, StreamLanguage, syntaxHighlighting,
} from '@codemirror/language';
import { Compartment, EditorSelection, EditorState, type StateCommand } from '@codemirror/state';
import {
  drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { useEffect, useRef } from 'react';

/**
 * Resaltado propio: colorea la sintaxis pero NO delata los errores.
 *
 * Es deliberado que falte `t.invalid` (el estilo por defecto lo pinta en rojo):
 * una etiqueta sin cerrar o un paréntesis suelto deben pasar desapercibidos,
 * porque detectarlos es parte de lo que se evalúa. Por el mismo motivo el editor
 * no lleva `bracketMatching` (señala el paréntesis que no casa), `indentOnInput`
 * (reindenta al escribir un cierre), autocompletado ni cierre automático de
 * etiquetas: el examen mide lo que el alumno sabe escribir, no lo que el editor
 * le corrige.
 */
export const RESALTADO = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6b7280', fontStyle: 'italic' },
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: '#7a4fd0' },
  { tag: [t.tagName, t.heading], color: '#1f5fbf' },
  { tag: [t.attributeName, t.propertyName], color: '#0f766e' },
  { tag: [t.string, t.attributeValue, t.special(t.string)], color: '#1e7a3c' },
  { tag: [t.number, t.bool, t.null, t.atom], color: '#a15c00' },
  { tag: [t.typeName, t.className, t.definition(t.variableName)], color: '#0b5cab' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#1f5fbf' },
  { tag: [t.meta, t.processingInstruction, t.documentMeta], color: '#6b7280' },
  { tag: [t.link, t.url], color: '#1f5fbf', textDecoration: 'underline' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
]);

type Cargador = () => Promise<LanguageSupport | ReturnType<typeof StreamLanguage.define>>;

// Carga perezosa: cada lenguaje va en su propio fragmento del bundle.
export const LENGUAJES: Record<string, Cargador> = {
  html: async () => (await import('@codemirror/lang-html')).html({ autoCloseTags: false }),
  css: async () => (await import('@codemirror/lang-css')).css(),
  javascript: async () => (await import('@codemirror/lang-javascript')).javascript(),
  typescript: async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: true }),
  json: async () => (await import('@codemirror/lang-json')).json(),
  xml: async () => (await import('@codemirror/lang-xml')).xml({ autoCloseTags: false }),
  sql: async () => (await import('@codemirror/lang-sql')).sql(),
  java: async () => (await import('@codemirror/lang-java')).java(),
  python: async () => (await import('@codemirror/lang-python')).python(),
  php: async () => (await import('@codemirror/lang-php')).php({ plain: false }),
  yaml: async () => (await import('@codemirror/lang-yaml')).yaml(),
  markdown: async () => (await import('@codemirror/lang-markdown')).markdown(),
  shell: async () => StreamLanguage.define((await import('@codemirror/legacy-modes/mode/shell')).shell),
};

export const ANCHO_TAB = 4;

/**
 * Tab como en un cuaderno: sin selección (o dentro de una línea) inserta espacios hasta el
 * siguiente tope y no toca el resto de la línea, así se puede alinear un comentario al final
 * de una instrucción. Solo si hay varias líneas seleccionadas sangra el bloque.
 * (`indentWithTab` sangraba siempre la línea entera.)
 */
export const tabulador: StateCommand = (objetivo) => {
  const { state, dispatch } = objetivo;
  const variasLineas = state.selection.ranges.some(
    (r) => !r.empty && state.doc.lineAt(r.from).number !== state.doc.lineAt(r.to).number,
  );
  if (variasLineas) return indentMore(objetivo);
  dispatch(
    state.update(
      state.changeByRange((r) => {
        const columna = r.from - state.doc.lineAt(r.from).from;
        const texto = ' '.repeat(ANCHO_TAB - (columna % ANCHO_TAB));
        return { changes: { from: r.from, to: r.to, insert: texto }, range: EditorSelection.cursor(r.from + texto.length) };
      }),
      { scrollIntoView: true, userEvent: 'input' },
    ),
  );
  return true;
};

interface Props {
  valor: string;
  lenguaje: string;
  alCambiar: (valor: string) => void;
}

/** Editor sin ayudas: resaltado de sintaxis, números de línea, ajuste de línea y Tab, nada más. */
export function EditorCodigo({ valor, lenguaje, alCambiar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const vista = useRef<EditorView | null>(null);
  const cambio = useRef(alCambiar);
  cambio.current = alCambiar;

  useEffect(() => {
    const idioma = new Compartment();
    const view = new EditorView({
      parent: contenedor.current!,
      state: EditorState.create({
        doc: valor,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          indentUnit.of(' '.repeat(ANCHO_TAB)),
          EditorState.tabSize.of(ANCHO_TAB),
          EditorView.lineWrapping,
          syntaxHighlighting(RESALTADO, { fallback: true }),
          // Enter con `insertNewline` (no `insertNewlineAndIndent`): el editor no sangra por su cuenta,
          // lo que sale en la pantalla es lo que escribió el alumno.
          keymap.of([
            { key: 'Enter', run: insertNewline, shift: insertNewline },
            { key: 'Tab', run: tabulador },
            { key: 'Shift-Tab', run: indentLess },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
          EditorView.updateListener.of((u) => u.docChanged && cambio.current(u.state.doc.toString())),
          idioma.of([]),
        ],
      }),
    });
    vista.current = view;
    view.focus();
    let vivo = true;
    LENGUAJES[lenguaje]?.().then((ext) => vivo && view.dispatch({ effects: idioma.reconfigure(ext) }));
    return () => {
      vivo = false;
      view.destroy();
    };
    // El editor se crea una vez por pregunta (key en el padre); `valor` es solo el inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenguaje]);

  return <div className="editor-codigo" ref={contenedor} />;
}
