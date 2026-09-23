// Formato del examen descifrado (lo produce scripts/preparar_examen.py).

export type Tipo = 'unica' | 'multiple' | 'texto' | 'codigo';

export interface Opcion {
  letra: string;
  texto: string;
}

export interface Pregunta {
  id: string;
  item?: string | null;
  nivel?: string | null;
  ce?: string[];
  /** Lo que aporta a la nota del RA, sobre 10. Lo calcula preparar_examen.py. */
  puntos?: number | null;
  tipo: Tipo;
  lenguaje?: string | null;
  enunciado: string;
  opciones: Opcion[];
}

export interface Parte {
  id: string;
  titulo: string;
  preguntas: Pregunta[];
}

/** Datos con los que se nombran el fichero y las carpetas de Drive. Van sin cifrar. */
export interface Meta {
  ra: string;
  grupo: string;
  siglas: string;
  cursoEscolar: string;
  convocatoria: string;
}

export interface Examen extends Meta {
  id: string;
  titulo: string;
  ciclo: string;
  curso: string;
  modulo: string;
  codigoModulo: string;
  raTexto: string;
  duracion: number;
  partes: Parte[];
  desbloqueo: { sal: string; iter: number; hash: string };
  generado: string;
}

export interface Paquete {
  version: number;
  id: string;
  meta?: Meta;
  sal: string;
  iter: number;
  entradas: { loc: string; iv: string; clave: string }[];
  iv: string;
  datos: string;
}

/** Respuesta: letra(s) canónicas en los tests; texto/código en el resto. */
export interface Respuesta {
  valor: string | string[];
  explicacion?: string;
}

export interface Estado {
  id: string;
  loc: string;
  codigo: string;
  /** Hora de inicio, la que fija el receptor cuando hay red. */
  inicio: number | null;
  /** Milisegundos que hay que sumarle al reloj del equipo para tener la hora del receptor. */
  desfase: number;
  respuestas: Record<string, Respuesta>;
  marcadas: string[];
  actual: number;
  entregado: { fecha: number; md: string; automatica: boolean } | null;
}

export interface Config {
  urlPublica?: string;
  receptor?: string;
}
