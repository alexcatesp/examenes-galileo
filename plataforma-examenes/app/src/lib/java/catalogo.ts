// Catálogo de la API de Java que usa el editor con ayudas (perfil «ide» + ayudas): sirve para sugerir
// miembros al escribir un punto y para detectar errores fiables (clase sin import, método inexistente,
// número o tipo de argumentos). Solo recoge lo que se ve en la UT02; no es el JDK entero.
//
// Cada miembro se escribe en una línea:
//   «m nombre(tipo parámetro, …) -> Retorno : ayuda»   método de instancia
//   «s nombre(tipo parámetro, …) -> Retorno : ayuda»   método estático
//   «c NOMBRE -> Tipo : ayuda»                         constante o atributo estático
//   «n (tipo parámetro, …) : ayuda»                    constructor
// Los nombres de los parámetros están en español a propósito: son parte de la ayuda.

export type Clave = 'm' | 's' | 'c' | 'n';

export interface Parametro {
  tipo: string;
  nombre: string;
}

export interface Miembro {
  clase: string;
  clave: Clave;
  nombre: string;
  parametros: Parametro[];
  /** `null` si es una constante (no admite paréntesis). */
  retorno: string;
  ayuda: string;
  /** Firma lista para mostrar: «substring(int inicio, int fin)». */
  firma: string;
}

export interface Clase {
  nombre: string;
  paquete: string;
  ayuda: string;
  miembros: Miembro[];
  /** Tipos a los que se puede asignar un objeto de esta clase, además de ella misma y `Object`. */
  superTipos: string[];
}

interface Definicion {
  paquete: string;
  ayuda: string;
  superTipos?: string[];
  miembros: string[];
}

const OBJETO: string[] = [
  'm equals(Object otro) -> boolean : Indica si este objeto es igual a otro. En los objetos, «==» compara referencias; equals compara el contenido.',
  'm hashCode() -> int : Número entero que resume el contenido del objeto.',
  'm toString() -> String : Texto que representa al objeto.',
  'm getClass() -> Class : Clase con la que se creó el objeto.',
];

const DEFINICIONES: Record<string, Definicion> = {
  Object: { paquete: 'java.lang', ayuda: 'Clase de la que heredan todas las demás.', miembros: OBJETO },

  String: {
    paquete: 'java.lang',
    ayuda: 'Texto. Es inmutable: ningún método modifica el String; devuelven uno nuevo.',
    superTipos: ['CharSequence', 'Comparable'],
    miembros: [
      'n () : Crea un texto vacío.',
      'n (String texto) : Crea un texto copiando otro. Con un literal basta con comillas: String s = "hola";',
      'm length() -> int : Número de caracteres del texto.',
      'm charAt(int posicion) -> char : Carácter que ocupa esa posición (la primera es la 0).',
      'm substring(int inicio) -> String : Trozo del texto desde la posición inicio hasta el final.',
      'm substring(int inicio, int fin) -> String : Trozo desde inicio (incluida) hasta fin (excluida).',
      'm indexOf(String texto) -> int : Posición de la primera aparición del texto, o -1 si no está.',
      'm indexOf(char caracter) -> int : Posición de la primera aparición del carácter, o -1 si no está.',
      'm indexOf(String texto, int desde) -> int : Como indexOf, pero buscando a partir de la posición desde.',
      'm lastIndexOf(String texto) -> int : Posición de la última aparición del texto, o -1 si no está.',
      'm contains(CharSequence texto) -> boolean : true si el texto contiene esa secuencia.',
      'm startsWith(String prefijo) -> boolean : true si el texto empieza por el prefijo.',
      'm endsWith(String sufijo) -> boolean : true si el texto termina en el sufijo.',
      'm equalsIgnoreCase(String otro) -> boolean : Compara el contenido sin distinguir mayúsculas de minúsculas.',
      'm compareTo(String otro) -> int : Compara por orden alfabético: negativo, 0 o positivo.',
      'm toUpperCase() -> String : Copia del texto en mayúsculas. El original no cambia.',
      'm toLowerCase() -> String : Copia del texto en minúsculas. El original no cambia.',
      'm trim() -> String : Copia sin los espacios de los extremos. El original no cambia.',
      'm strip() -> String : Copia sin los espacios en blanco de los extremos (versión actual de trim).',
      'm isEmpty() -> boolean : true si el texto no tiene ningún carácter.',
      'm isBlank() -> boolean : true si el texto está vacío o solo tiene espacios.',
      'm replace(CharSequence antiguo, CharSequence nuevo) -> String : Copia cambiando todas las apariciones de antiguo por nuevo.',
      'm concat(String otro) -> String : Copia con otro texto añadido al final.',
      'm repeat(int veces) -> String : Texto repetido tantas veces como se indique.',
      'm split(String separador) -> String[] : Parte el texto por el separador y devuelve las partes.',
      'm toCharArray() -> char[] : Los caracteres del texto en un array.',
      's valueOf(Object valor) -> String : Convierte cualquier valor a texto.',
      's format(String formato, Object... valores) -> String : Texto formateado, como printf pero devolviendo el resultado.',
      's join(CharSequence separador, CharSequence... partes) -> String : Une las partes con el separador.',
    ],
  },

  StringBuilder: {
    paquete: 'java.lang',
    ayuda: 'Texto modificable. Para concatenar muchas veces (por ejemplo en un bucle) es más eficiente que String.',
    superTipos: ['CharSequence'],
    miembros: [
      'n () : Crea un StringBuilder vacío.',
      'n (int capacidad) : Crea un StringBuilder vacío con espacio reservado para esa capacidad (el número NO es el contenido).',
      'n (String texto) : Crea un StringBuilder con ese texto como contenido inicial.',
      'm append(Object valor) -> StringBuilder : Añade el valor al final. Modifica este mismo objeto y lo devuelve.',
      'm insert(int posicion, Object valor) -> StringBuilder : Inserta el valor en esa posición.',
      'm delete(int inicio, int fin) -> StringBuilder : Borra los caracteres desde inicio (incluido) hasta fin (excluido).',
      'm reverse() -> StringBuilder : Invierte el contenido.',
      'm length() -> int : Número de caracteres que tiene ahora.',
      'm capacity() -> int : Espacio reservado, no el contenido.',
      'm charAt(int posicion) -> char : Carácter de esa posición.',
      'm indexOf(String texto) -> int : Posición de la primera aparición, o -1.',
      'm setLength(int longitud) -> void : Acorta o alarga el contenido.',
      'm toString() -> String : Devuelve el contenido como String.',
    ],
  },

  Scanner: {
    paquete: 'java.util',
    ayuda: 'Lee datos de una fuente (el teclado, un texto…) separándolos en elementos.',
    miembros: [
      'n (InputStream fuente) : Lee de un flujo de entrada. new Scanner(System.in) lee del teclado.',
      'n (String texto) : Lee del propio texto, sin teclado.',
      'm nextLine() -> String : Lee la línea completa hasta el salto de línea.',
      'm next() -> String : Lee el siguiente elemento (hasta un espacio).',
      'm nextInt() -> int : Lee el siguiente elemento como número entero.',
      'm nextDouble() -> double : Lee el siguiente elemento como número decimal.',
      'm nextBoolean() -> boolean : Lee el siguiente elemento como true o false.',
      'm hasNext() -> boolean : true si quedan elementos por leer.',
      'm hasNextInt() -> boolean : true si el siguiente elemento es un entero.',
      'm hasNextLine() -> boolean : true si queda alguna línea por leer.',
      'm close() -> void : Cierra el Scanner y libera la fuente.',
    ],
  },

  Math: {
    paquete: 'java.lang',
    ayuda: 'Funciones matemáticas. Todos sus miembros son estáticos: se usan con Math.nombre, sin crear objeto.',
    miembros: [
      'c PI -> double : Número pi (3,14159…).',
      'c E -> double : Número e (2,71828…).',
      's abs(int valor) -> int : Valor absoluto de un entero.',
      's abs(double valor) -> double : Valor absoluto.',
      's max(int a, int b) -> int : El mayor de los dos enteros.',
      's max(long a, long b) -> long : El mayor de los dos números largos.',
      's max(double a, double b) -> double : El mayor de los dos.',
      's min(int a, int b) -> int : El menor de los dos enteros.',
      's min(long a, long b) -> long : El menor de los dos números largos.',
      's min(double a, double b) -> double : El menor de los dos.',
      's pow(double base, double exponente) -> double : Potencia.',
      's sqrt(double valor) -> double : Raíz cuadrada.',
      's round(double valor) -> long : Redondea al entero más cercano.',
      's floor(double valor) -> double : Redondea hacia abajo.',
      's ceil(double valor) -> double : Redondea hacia arriba.',
      's random() -> double : Número aleatorio entre 0 (incluido) y 1 (excluido).',
    ],
  },

  Integer: {
    paquete: 'java.lang',
    ayuda: 'Clase envoltorio del tipo int. Permite tratar un entero como objeto.',
    superTipos: ['Number', 'Comparable'],
    miembros: [
      'c MAX_VALUE -> int : El mayor int posible (2147483647).',
      'c MIN_VALUE -> int : El menor int posible (-2147483648).',
      's parseInt(String texto) -> int : Convierte un texto a int. Falla con NumberFormatException si no es un entero.',
      's valueOf(String texto) -> Integer : Convierte un texto a objeto Integer.',
      's toString(int valor) -> String : Convierte el entero a texto.',
      's compare(int a, int b) -> int : Compara dos enteros.',
      'm intValue() -> int : El valor como int primitivo.',
      'm doubleValue() -> double : El valor como double.',
    ],
  },

  Double: {
    paquete: 'java.lang',
    ayuda: 'Clase envoltorio del tipo double.',
    superTipos: ['Number', 'Comparable'],
    miembros: [
      'c MAX_VALUE -> double : El mayor double posible.',
      's parseDouble(String texto) -> double : Convierte un texto a double.',
      's valueOf(String texto) -> Double : Convierte un texto a objeto Double.',
      's toString(double valor) -> String : Convierte el número a texto.',
      's compare(double a, double b) -> int : Compara dos decimales.',
      'm doubleValue() -> double : El valor como double primitivo.',
      'm intValue() -> int : El valor truncado a int.',
    ],
  },

  Long: {
    paquete: 'java.lang',
    ayuda: 'Clase envoltorio del tipo long.',
    superTipos: ['Number', 'Comparable'],
    miembros: [
      'c MAX_VALUE -> long : El mayor long posible.',
      's parseLong(String texto) -> long : Convierte un texto a long.',
      's valueOf(String texto) -> Long : Convierte un texto a objeto Long.',
      'm longValue() -> long : El valor como long primitivo.',
    ],
  },

  Boolean: {
    paquete: 'java.lang',
    ayuda: 'Clase envoltorio del tipo boolean.',
    superTipos: ['Comparable'],
    miembros: [
      's parseBoolean(String texto) -> boolean : true si el texto es «true» (sin distinguir mayúsculas).',
      'm booleanValue() -> boolean : El valor como boolean primitivo.',
    ],
  },

  Character: {
    paquete: 'java.lang',
    ayuda: 'Clase envoltorio del tipo char, con utilidades para caracteres.',
    superTipos: ['Comparable'],
    miembros: [
      's isDigit(char c) -> boolean : true si es un dígito.',
      's isLetter(char c) -> boolean : true si es una letra.',
      's isUpperCase(char c) -> boolean : true si es mayúscula.',
      's toUpperCase(char c) -> char : El carácter en mayúscula.',
    ],
  },

  System: {
    paquete: 'java.lang',
    ayuda: 'Acceso al sistema: entrada y salida estándar, reloj…',
    miembros: [
      'c out -> PrintStream : Salida estándar (la consola). System.out.println(…) escribe una línea.',
      'c in -> InputStream : Entrada estándar (el teclado). Se usa en new Scanner(System.in).',
      's currentTimeMillis() -> long : Milisegundos desde 1970. Sirve para medir tiempos.',
      's nanoTime() -> long : Marca de tiempo en nanosegundos, para medir duraciones.',
      's lineSeparator() -> String : Salto de línea del sistema.',
      's gc() -> void : SUGIERE a la JVM que ejecute el recolector de basura; no garantiza cuándo.',
    ],
  },

  PrintStream: {
    paquete: 'java.io',
    ayuda: 'Flujo de salida de texto. System.out es un PrintStream.',
    miembros: [
      'm println(Object valor) -> void : Escribe el valor y salta de línea.',
      'm print(Object valor) -> void : Escribe el valor sin saltar de línea.',
      'm printf(String formato, Object... valores) -> PrintStream : Escribe con formato (%d, %s, %.2f…).',
    ],
  },

  InputStream: { paquete: 'java.io', ayuda: 'Flujo de entrada de bytes. System.in es un InputStream.', miembros: [] },

  ArrayList: {
    paquete: 'java.util',
    ayuda: 'Lista que crece según se necesita.',
    superTipos: ['List', 'Collection', 'Iterable'],
    miembros: [
      'n () : Crea una lista vacía.',
      'n (int capacidad) : Crea una lista vacía con capacidad inicial.',
      'm add(Object elemento) -> boolean : Añade el elemento al final.',
      'm get(int posicion) -> ? : Devuelve el elemento de esa posición (la primera es la 0).',
      'm size() -> int : Número de elementos.',
      'm remove(int posicion) -> ? : Quita el elemento de esa posición.',
      'm contains(Object elemento) -> boolean : true si la lista lo contiene.',
      'm isEmpty() -> boolean : true si no tiene elementos.',
      'm clear() -> void : Vacía la lista.',
    ],
  },

  Random: {
    paquete: 'java.util',
    ayuda: 'Generador de números pseudoaleatorios.',
    miembros: [
      'n () : Crea un generador con semilla distinta cada vez.',
      'n (long semilla) : Crea un generador con una semilla fija: siempre da la misma secuencia.',
      'm nextInt() -> int : Siguiente entero aleatorio.',
      'm nextInt(int limite) -> int : Entero aleatorio entre 0 (incluido) y limite (excluido).',
      'm nextDouble() -> double : Decimal aleatorio entre 0 y 1.',
      'm nextBoolean() -> boolean : true o false al azar.',
    ],
  },

  LocalDate: {
    paquete: 'java.time',
    ayuda: 'Fecha sin hora (año, mes, día). Es inmutable: los métodos plus/minus/with devuelven una fecha nueva. No tiene constructor público: se obtiene con of, now o parse.',
    superTipos: ['ChronoLocalDate', 'Temporal', 'TemporalAccessor'],
    miembros: [
      's now() -> LocalDate : La fecha de hoy.',
      's of(int anio, int mes, int dia) -> LocalDate : Fecha concreta. El orden es año, mes, día.',
      's parse(CharSequence texto) -> LocalDate : Lee una fecha en formato ISO («2026-12-31»).',
      's parse(CharSequence texto, DateTimeFormatter formato) -> LocalDate : Lee una fecha con el formato indicado.',
      'm getYear() -> int : El año.',
      'm getMonthValue() -> int : El mes como número (1 a 12).',
      'm getMonth() -> Month : El mes como valor de la enumeración Month.',
      'm getDayOfMonth() -> int : El día del mes.',
      'm getDayOfWeek() -> DayOfWeek : El día de la semana.',
      'm lengthOfMonth() -> int : Días que tiene el mes de esta fecha.',
      'm lengthOfYear() -> int : Días que tiene el año de esta fecha.',
      'm isLeapYear() -> boolean : true si el año es bisiesto.',
      'm isBefore(ChronoLocalDate otra) -> boolean : true si esta fecha es anterior a otra.',
      'm isAfter(ChronoLocalDate otra) -> boolean : true si esta fecha es posterior a otra.',
      'm isEqual(ChronoLocalDate otra) -> boolean : true si es la misma fecha.',
      'm plusDays(long dias) -> LocalDate : Fecha nueva, tantos días después.',
      'm plusWeeks(long semanas) -> LocalDate : Fecha nueva, tantas semanas después.',
      'm plusMonths(long meses) -> LocalDate : Fecha nueva, tantos meses después.',
      'm plusYears(long anios) -> LocalDate : Fecha nueva, tantos años después.',
      'm minusDays(long dias) -> LocalDate : Fecha nueva, tantos días antes.',
      'm minusMonths(long meses) -> LocalDate : Fecha nueva, tantos meses antes.',
      'm minusYears(long anios) -> LocalDate : Fecha nueva, tantos años antes.',
      'm withDayOfMonth(int dia) -> LocalDate : Fecha nueva con ese día del mes.',
      'm withMonth(int mes) -> LocalDate : Fecha nueva con ese mes.',
      'm withYear(int anio) -> LocalDate : Fecha nueva con ese año.',
      'm until(ChronoLocalDate otra) -> Period : Periodo (años, meses y días) hasta otra fecha.',
      'm format(DateTimeFormatter formato) -> String : La fecha como texto con el formato indicado.',
    ],
  },

  Period: {
    paquete: 'java.time',
    ayuda: 'Cantidad de tiempo en años, meses y días (calendario). Es lo que se usa para calcular una edad.',
    superTipos: ['TemporalAmount'],
    miembros: [
      's between(LocalDate inicio, LocalDate fin) -> Period : Periodo entre dos fechas.',
      's of(int anios, int meses, int dias) -> Period : Periodo con esos valores.',
      's ofDays(int dias) -> Period : Periodo de tantos días.',
      's ofMonths(int meses) -> Period : Periodo de tantos meses.',
      's ofYears(int anios) -> Period : Periodo de tantos años.',
      'm getYears() -> int : La parte de años del periodo.',
      'm getMonths() -> int : La parte de meses del periodo (no el total).',
      'm getDays() -> int : La parte de días del periodo (no el total).',
      'm toTotalMonths() -> long : Total de meses (años × 12 + meses).',
      'm isNegative() -> boolean : true si algún componente es negativo.',
    ],
  },

  ChronoUnit: {
    paquete: 'java.time.temporal',
    ayuda: 'Unidades de tiempo (días, semanas, meses…). Sirve para medir cuántas unidades hay entre dos fechas.',
    superTipos: ['TemporalUnit'],
    miembros: [
      'c NANOS -> ChronoUnit : Nanosegundos.',
      'c SECONDS -> ChronoUnit : Segundos.',
      'c MINUTES -> ChronoUnit : Minutos.',
      'c HOURS -> ChronoUnit : Horas.',
      'c DAYS -> ChronoUnit : Días.',
      'c WEEKS -> ChronoUnit : Semanas.',
      'c MONTHS -> ChronoUnit : Meses.',
      'c YEARS -> ChronoUnit : Años.',
      'm between(Temporal inicio, Temporal fin) -> long : Número de unidades completas entre dos fechas. Ejemplo: ChronoUnit.DAYS.between(a, b).',
    ],
  },

  DateTimeFormatter: {
    paquete: 'java.time.format',
    ayuda: 'Define cómo se escribe o se lee una fecha («dd/MM/yyyy»).',
    miembros: [
      'c ISO_LOCAL_DATE -> DateTimeFormatter : Formato ISO «2026-12-31».',
      's ofPattern(String patron) -> DateTimeFormatter : Formateador con un patrón: dd día, MM mes, yyyy año.',
      'm format(TemporalAccessor fecha) -> String : Escribe la fecha con este formato.',
    ],
  },

  DayOfWeek: {
    paquete: 'java.time',
    ayuda: 'Día de la semana (MONDAY … SUNDAY).',
    miembros: ['m getValue() -> int : Número del día (lunes = 1 … domingo = 7).'],
  },

  Month: {
    paquete: 'java.time',
    ayuda: 'Mes del año (JANUARY … DECEMBER).',
    miembros: ['m getValue() -> int : Número del mes (enero = 1 … diciembre = 12).'],
  },
};

/** Tipos que solo aparecen como tipo de un parámetro o de un resultado, sin miembros propios. */
const SOLO_TIPOS: Record<string, { paquete: string; superTipos?: string[] }> = {
  CharSequence: { paquete: 'java.lang' },
  Comparable: { paquete: 'java.lang' },
  Number: { paquete: 'java.lang' },
  Class: { paquete: 'java.lang' },
  List: { paquete: 'java.util', superTipos: ['Collection', 'Iterable'] },
  Collection: { paquete: 'java.util', superTipos: ['Iterable'] },
  Iterable: { paquete: 'java.lang' },
  Temporal: { paquete: 'java.time.temporal', superTipos: ['TemporalAccessor'] },
  TemporalAccessor: { paquete: 'java.time.temporal' },
  TemporalUnit: { paquete: 'java.time.temporal' },
  TemporalAmount: { paquete: 'java.time.temporal' },
  ChronoLocalDate: { paquete: 'java.time.chrono', superTipos: ['Temporal', 'TemporalAccessor'] },
};

export const PRIMITIVOS = ['byte', 'short', 'int', 'long', 'float', 'double', 'boolean', 'char'] as const;
/** Cada primitivo y a cuáles se puede ampliar sin cast. */
const AMPLIACION: Record<string, string[]> = {
  byte: ['short', 'int', 'long', 'float', 'double'],
  short: ['int', 'long', 'float', 'double'],
  char: ['int', 'long', 'float', 'double'],
  int: ['long', 'float', 'double'],
  long: ['float', 'double'],
  float: ['double'],
  double: [],
  boolean: [],
};
const ENVOLTORIO: Record<string, string> = {
  int: 'Integer', double: 'Double', long: 'Long', boolean: 'Boolean', char: 'Character',
  float: 'Float', short: 'Short', byte: 'Byte',
};

const LINEA = /^([msc]) ([A-Za-z_][\w]*)(?:\(([^)]*)\))?(?: -> ([\w[\]<>.?]+(?:\.\.\.)?))? : (.+)$/;
const LINEA_CONSTRUCTOR = /^n \(([^)]*)\) : (.+)$/;

function parametros(texto: string): Parametro[] {
  if (!texto.trim()) return [];
  return texto.split(',').map((p) => {
    const trozos = p.trim().split(/\s+/);
    return { tipo: trozos.slice(0, -1).join(' '), nombre: trozos[trozos.length - 1] };
  });
}

function leer(clase: string, linea: string): Miembro {
  const c = LINEA_CONSTRUCTOR.exec(linea);
  if (c) {
    const ps = parametros(c[1]);
    return {
      clase, clave: 'n', nombre: clase, parametros: ps, retorno: clase, ayuda: c[2],
      firma: `${clase}(${ps.map((p) => `${p.tipo} ${p.nombre}`).join(', ')})`,
    };
  }
  const m = LINEA.exec(linea);
  if (!m) throw new Error(`Catálogo: línea mal formada en ${clase}: ${linea}`);
  const clave = m[1] as Clave;
  const ps = parametros(m[3] ?? '');
  const firma = clave === 'c' ? m[2] : `${m[2]}(${ps.map((p) => `${p.tipo} ${p.nombre}`).join(', ')})`;
  return { clase, clave, nombre: m[2], parametros: ps, retorno: m[4] ?? 'void', ayuda: m[5], firma };
}

function construir(): Map<string, Clase> {
  const mapa = new Map<string, Clase>();
  for (const [nombre, d] of Object.entries(DEFINICIONES)) {
    mapa.set(nombre, {
      nombre, paquete: d.paquete, ayuda: d.ayuda, superTipos: d.superTipos ?? [],
      miembros: d.miembros.map((l) => leer(nombre, l)),
    });
  }
  return mapa;
}

export const CLASES: Map<string, Clase> = construir();
const MIEMBROS_OBJETO: Miembro[] = OBJETO.map((l) => leer('Object', l));

export function paqueteDe(clase: string): string | undefined {
  return CLASES.get(clase)?.paquete ?? SOLO_TIPOS[clase]?.paquete;
}

export function esClaseConocida(nombre: string): boolean {
  return CLASES.has(nombre) || nombre in SOLO_TIPOS;
}

export function esPrimitivo(tipo: string): boolean {
  return (PRIMITIVOS as readonly string[]).includes(tipo);
}

/** Miembros de una clase, con los de `Object` heredados. */
export function miembrosDe(clase: string): Miembro[] {
  const c = CLASES.get(clase);
  if (!c) return [];
  const propios = c.miembros.filter((m) => m.clave !== 'n');
  const heredados = MIEMBROS_OBJETO.filter((o) => !propios.some((p) => p.nombre === o.nombre && p.parametros.length === o.parametros.length));
  return [...propios, ...heredados.map((h) => ({ ...h, clase }))];
}

export function constructoresDe(clase: string): Miembro[] {
  return CLASES.get(clase)?.miembros.filter((m) => m.clave === 'n') ?? [];
}

/** Todos los tipos a los que se puede asignar `tipo` (él mismo, sus supertipos y Object). */
function superTipos(tipo: string): string[] {
  const visto = new Set<string>(['Object']);
  const pila = [tipo];
  while (pila.length) {
    const t = pila.pop()!;
    if (visto.has(t) && t !== tipo) continue;
    visto.add(t);
    pila.push(...(CLASES.get(t)?.superTipos ?? SOLO_TIPOS[t]?.superTipos ?? []));
  }
  return [...visto];
}

/**
 * ¿Se puede asignar un valor de tipo `desde` a una variable o parámetro de tipo `hasta`?
 * `null` = no se sabe: nunca es motivo de error. Solo devuelve `false` cuando es seguro.
 */
export function asignable(desde: string | null, hasta: string | null): boolean | null {
  if (!desde || !hasta) return null;
  if (desde === hasta) return true;
  if (hasta.endsWith('...')) return asignable(desde, hasta.slice(0, -3)) ?? true;
  const conocido = (t: string) => esPrimitivo(t) || esClaseConocida(t) || t === 'String' || t.endsWith('[]');
  if (!conocido(desde) || !conocido(hasta)) return null;
  if (esPrimitivo(desde) && esPrimitivo(hasta)) return AMPLIACION[desde].includes(hasta);
  if (esPrimitivo(desde)) {
    // Encaje con objeto: int → Integer, y cualquier primitivo → Object/Number/Comparable.
    return ENVOLTORIO[desde] === hasta || superTipos(ENVOLTORIO[desde]).includes(hasta);
  }
  if (esPrimitivo(hasta)) {
    // Desempaquetado: Integer → int (y ampliaciones).
    const prim = Object.entries(ENVOLTORIO).find(([, env]) => env === desde)?.[0];
    return prim ? prim === hasta || AMPLIACION[prim].includes(hasta) : false;
  }
  if (desde.endsWith('[]') || hasta.endsWith('[]')) return desde === hasta ? true : hasta === 'Object';
  return superTipos(desde).includes(hasta);
}

/** Clave de un literal numérico entero que cabe en byte/short/char (permite `char c = 65;`). */
export const ESTRECHOS_DESDE_INT = ['byte', 'short', 'char'];
