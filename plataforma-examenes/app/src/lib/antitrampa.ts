import { useEffect, useRef } from 'react';

const TECLAS_BLOQUEADAS = (e: KeyboardEvent) => {
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  return (
    k === 'f12' ||
    (mod && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) || // herramientas de desarrollo
    (mod && ['p', 's', 'u', 'o', 'f', 'g', 'h'].includes(k)) // imprimir, guardar, código fuente, buscar…
  );
};

/**
 * Bloquea copiar, cortar, pegar, arrastrar, el menú contextual y atajos de
 * herramientas mientras `activo`. Se registra en fase de captura sobre window
 * para que ningún componente (tampoco CodeMirror) llegue a recibir el evento.
 */
export function useSinPortapapeles(activo: boolean): void {
  useEffect(() => {
    if (!activo) return;
    const cortar = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const entrada = (e: Event) => {
      const tipo = (e as InputEvent).inputType;
      if (tipo === 'insertFromPaste' || tipo === 'insertFromDrop' || tipo === 'insertFromPasteAsQuotation') cortar(e);
    };
    const teclas = (e: KeyboardEvent) => {
      if (TECLAS_BLOQUEADAS(e)) cortar(e);
    };
    const eventos = ['copy', 'cut', 'paste', 'contextmenu', 'dragstart', 'drop', 'dragover'];
    eventos.forEach((ev) => window.addEventListener(ev, cortar, true));
    window.addEventListener('beforeinput', entrada, true);
    window.addEventListener('keydown', teclas, true);
    return () => {
      eventos.forEach((ev) => window.removeEventListener(ev, cortar, true));
      window.removeEventListener('beforeinput', entrada, true);
      window.removeEventListener('keydown', teclas, true);
    };
  }, [activo]);
}

/**
 * Llama a `alSalir` si el alumno abandona el examen: la ventana pierde el foco,
 * la pestaña deja de verse o se sale de la pantalla completa.
 */
export function useVigilancia(activo: boolean, alSalir: (motivo: string) => void): void {
  const callback = useRef(alSalir);
  callback.current = alSalir;
  useEffect(() => {
    if (!activo) return;
    const blur = () => callback.current('foco');
    const visibilidad = () => document.visibilityState === 'hidden' && callback.current('pestaña');
    const pantalla = () => !document.fullscreenElement && callback.current('pantalla completa');
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibilidad);
    document.addEventListener('fullscreenchange', pantalla);
    // Si al activarse ya no hay foco o pantalla completa, se bloquea de inmediato.
    if (!document.hasFocus()) blur();
    else if (!document.fullscreenElement) pantalla();
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibilidad);
      document.removeEventListener('fullscreenchange', pantalla);
    };
  }, [activo]);
}

export async function entrarPantallaCompleta(): Promise<boolean> {
  if (document.fullscreenElement) return true;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    return true;
  } catch {
    return false;
  }
}

export function salirPantallaCompleta(): void {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
