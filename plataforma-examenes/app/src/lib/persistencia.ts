import type { Estado } from './tipos';

// El estado solo vive en este navegador. Un almacenamiento bloqueado no debe
// impedir hacer el examen: los errores se ignoran.
const clave = (id: string, loc: string) => `examen:${id}:${loc}`;

export function cargar(id: string, loc: string): Estado | null {
  try {
    const crudo = localStorage.getItem(clave(id, loc));
    return crudo ? (JSON.parse(crudo) as Estado) : null;
  } catch {
    return null;
  }
}

export function guardar(estado: Estado): void {
  try {
    localStorage.setItem(clave(estado.id, estado.loc), JSON.stringify(estado));
  } catch {
    /* sin almacenamiento local: seguimos con el autoguardado remoto */
  }
}
