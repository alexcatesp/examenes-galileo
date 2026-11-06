// Formato del examen descifrado (lo produce scripts/preparar_examen.py).

export type Tipo = 'unica' | 'multiple' | 'texto' | 'codigo';

export interface Opcion {
  letra: string;
  texto: string;
}

/**
 * Cómo se presenta el editor de una pregunta de código o de desarrollo. Sin él se usa el editor sencillo.
 *  · `ide`        un único editor con aspecto de IDE (pestaña con el fichero, números de línea, barra de estado).
 *                 Con `ayudas` sugiere miembros con ayuda en español y subraya los errores.
 *  · `doble`      código original (solo lectura) a la izquierda, editor de la respuesta a la derecha y, debajo,
 *                 un cuadro de texto para las respuestas escritas.
 *  · `referencia` código original (solo lectura) a la izquierda —y, si `consola`, la salida del programa
 *                 debajo— y un cuadro de texto para las respuestas a la derecha.
 * El primer bloque de código del enunciado es el «código original»; el segundo, la consola.
 */
export interface PerfilEditor {
  perfil: 'ide' | 'doble' | 'referencia';
  /** Nombre del fichero en la pestaña («Correo.java»). */
  fichero?: string;
  /** Sugerencias de miembros y errores subrayados. Solo con perfil `ide`. */
  ayudas?: boolean;
  /** Muestra el segundo bloque de código del enunciado como consola. */
  consola?: boolean;
  /** Sangría automática y cierre de llaves, paréntesis y comillas, como en un IDE. */
  autoEscritura?: boolean;
}

export interface Pregunta {
  id: string;
  item?: string | null;
  nivel?: string | null;
  ce?: string[];
  /** Apartado del enunciado (a, b, c…) → letra del CE al que corresponde. */
  apartados?: Record<string, string>;
  /** Lo que aporta a la nota del RA, sobre 10. Lo calcula preparar_examen.py. */
  puntos?: number | null;
  tipo: Tipo;
  lenguaje?: string | null;
  /** Código puro (marca explícita en el examen modelo): solo entonces el editor dice «Tu código». */
  soloCodigo?: boolean;
  /** Presentación del editor; sin ella, el editor sencillo de siempre. */
  editor?: PerfilEditor;
  enunciado: string;
  opciones: Opcion[];
}

/** Versión traducida del texto de un examen (la prepara `preparar_examen.py traducir`). */
export interface Traduccion {
  /** Huella del texto traducido: queda en el .md del alumno por si hay reclamación. */
  sha256: string;
  titulo?: string;
  raTexto?: string;
  partes?: Record<string, string>;
  preguntas: Record<string, { enunciado: string; opciones?: Record<string, string> }>;
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
  /** Horario teórico (ms Unix). Si hay `fin`, la cuenta atrás llega a esa hora y no a inicio + duración. */
  inicio?: number;
  fin?: number;
  partes: Parte[];
  /** Traducciones por código de idioma (en, fr, tr). El español es el texto de referencia. */
  traducciones?: Record<string, Traduccion>;
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
