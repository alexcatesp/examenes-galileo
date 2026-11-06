import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { syntaxHighlighting } from '@codemirror/language';
import { useEffect, useRef } from 'react';
import { useIdioma } from '../lib/i18n';
import type { BloqueCodigo } from '../lib/bloques';
import { EditorIDE } from './EditorIDE';
import { LENGUAJES, RESALTADO } from './EditorCodigo';
import type { PerfilEditor, Respuesta } from '../lib/tipos';
import { sangrarConTab } from './sangria';

/** Código de solo lectura con números de línea y el mismo resaltado que el editor. */
function CodigoOriginal({ bloque, fichero }: { bloque: BloqueCodigo; fichero?: string }) {
  const { t } = useIdioma();
  const contenedor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const idioma = new Compartment();
    const vista = new EditorView({
      parent: contenedor.current!,
      state: EditorState.create({
        doc: bloque.codigo,
        extensions: [
          lineNumbers(),
          EditorView.lineWrapping,
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          syntaxHighlighting(RESALTADO, { fallback: true }),
          idioma.of([]),
        ],
      }),
    });
    let vivo = true;
    LENGUAJES[bloque.lenguaje]?.().then((ext) => vivo && vista.dispatch({ effects: idioma.reconfigure(ext) }));
    return () => { vivo = false; vista.destroy(); };
  }, [bloque]);
  return (
    <div className="ide ide-original">
      <div className="ide-pestanas">
        <span className="ide-pestana"><span className="ide-icono" aria-hidden="true">J</span>{fichero ?? t('ideOriginal')}</span>
        <span className="ide-ayudas">{t('ideOriginal')} · {t('ideSoloLectura')}</span>
      </div>
      <div className="ide-editor editor-codigo solo-lectura" ref={contenedor} />
    </div>
  );
}

function Consola({ bloque }: { bloque: BloqueCodigo }) {
  const { t } = useIdioma();
  return (
    <div className="ide-consola">
      <div className="ide-consola-titulo">{t('ideConsola')}</div>
      <pre>{bloque.codigo}</pre>
    </div>
  );
}

interface Props {
  perfil: PerfilEditor;
  bloques: BloqueCodigo[];
  id: string;
  lenguaje: string;
  respuesta: Respuesta | undefined;
  alResponder: (r: Respuesta) => void;
}

/** Perfiles de dos zonas: `doble` (original | tu código, y respuestas debajo) y `referencia` (original [y consola] | respuestas). */
export function PanelesCodigo({ perfil, bloques, id, respuesta, alResponder }: Props) {
  const { t } = useIdioma();
  const [original, consola] = bloques;
  const valor = typeof respuesta?.valor === 'string' ? respuesta.valor : '';
  const explicacion = respuesta?.explicacion ?? '';

  if (perfil.perfil === 'doble') {
    return (
      <div className="paneles paneles-doble">
        <div className="panel-izq">{original && <CodigoOriginal bloque={original} fichero={perfil.fichero} />}</div>
        <div className="panel-der">
          <EditorIDE
            key={id}
            valor={valor}
            fichero={perfil.fichero ?? 'Programa.java'}
            autoEscritura={perfil.autoEscritura}
            alCambiar={(v) => alResponder({ valor: v, explicacion: respuesta?.explicacion })}
          />
        </div>
        <div className="panel-pie">
          <label className="etiqueta" htmlFor={`exp-${id}`}>{t('ideTusRespuestas')}</label>
          <textarea
            id={`exp-${id}`}
            className="texto-libre corto"
            wrap="soft"
            spellCheck={false}
            value={explicacion}
            onChange={(e) => alResponder({ valor, explicacion: e.target.value })}
            onKeyDown={(e) => sangrarConTab(e, (v) => alResponder({ valor, explicacion: v }))}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="paneles paneles-referencia">
      <div className="panel-izq">
        {original && <CodigoOriginal bloque={original} fichero={perfil.fichero} />}
        {perfil.consola && consola && <Consola bloque={consola} />}
      </div>
      <div className="panel-der">
        <label className="etiqueta" htmlFor={`txt-${id}`}>{t('ideTusRespuestas')}</label>
        <textarea
          id={`txt-${id}`}
          className="texto-libre"
          wrap="soft"
          spellCheck={false}
          value={valor}
          onChange={(e) => alResponder({ valor: e.target.value })}
          onKeyDown={(e) => sangrarConTab(e, (v) => alResponder({ valor: v }))}
        />
      </div>
    </div>
  );
}
