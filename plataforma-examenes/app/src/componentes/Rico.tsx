import { Fragment } from 'react';

/** Texto de interfaz con **negrita** y `código`, sin HTML: lo escriben los diccionarios. */
export function Rico({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((t, i) =>
        t.startsWith('**') ? <strong key={i}>{t.slice(2, -2)}</strong>
        : t.startsWith('`') ? <code key={i}>{t.slice(1, -1)}</code>
        : <Fragment key={i}>{t}</Fragment>,
      )}
    </>
  );
}
