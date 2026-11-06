import type { KeyboardEvent as TeclaReact } from 'react';
import { ANCHO_TAB } from './EditorCodigo';

/** Tab en un textarea inserta espacios hasta el siguiente tope de 4 columnas, igual que el editor de código,
 *  en vez de saltar al siguiente campo.
 *  Con Mayús+Tab o Ctrl/Alt/Meta se conserva el comportamiento normal para poder salir con el teclado. */
export function sangrarConTab(e: TeclaReact<HTMLTextAreaElement>, alCambiar: (v: string) => void) {
  if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
  e.preventDefault();
  const t = e.currentTarget;
  const { selectionStart: a, selectionEnd: b, value } = t;
  const columna = a - (value.lastIndexOf('\n', a - 1) + 1);
  const espacios = ' '.repeat(ANCHO_TAB - (columna % ANCHO_TAB));
  alCambiar(value.slice(0, a) + espacios + value.slice(b));
  requestAnimationFrame(() => t.setSelectionRange(a + espacios.length, a + espacios.length));
}
