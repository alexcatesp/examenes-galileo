// Saca del enunciado los primeros bloques de código para mostrarlos en sus propios paneles.

export interface BloqueCodigo {
  lenguaje: string;
  codigo: string;
}

const BLOQUE = /^```([\w+-]*)[ \t]*\n([\s\S]*?)\n```[ \t]*$/gm;

/** Quita del texto los `cuantos` primeros bloques de código y los devuelve aparte, en orden. */
export function sacarBloques(texto: string, cuantos: number): { texto: string; bloques: BloqueCodigo[] } {
  const bloques: BloqueCodigo[] = [];
  const resto = texto.replace(BLOQUE, (completo, lenguaje: string, codigo: string) => {
    if (bloques.length >= cuantos) return completo;
    bloques.push({ lenguaje: lenguaje || 'texto', codigo });
    return '';
  });
  return { texto: resto.replace(/\n{3,}/g, '\n\n').trim(), bloques };
}
