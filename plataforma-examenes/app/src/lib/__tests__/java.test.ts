import { describe, expect, it } from 'vitest';
import { analizar } from '../java/analisis';
import { enComentarioOTexto, sugerenciasPunto, variablesDeclaradas } from '../java/completado';

const mensajes = (codigo: string) => analizar(codigo).map((d) => d.mensaje);
const sinProblemas = (codigo: string) => expect(analizar(codigo).map((d) => `${d.gravedad}: ${d.mensaje}`)).toEqual([]);

const FICHA_SOCIO = `import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

public class FichaSocio {
    public static void main(String[] args) {
        LocalDate fechaNacimiento = LocalDate.of(2008, 3, 24);
        LocalDate fechaAlta = LocalDate.of(2026, 9, 14);
        Period edadEnAlta = Period.between(fechaNacimiento, fechaAlta);
        LocalDate fechaCaducidad = fechaAlta.plusYears(2);
        DateTimeFormatter formatoEspanol = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        long diasDeValidez = ChronoUnit.DAYS.between(fechaAlta, fechaCaducidad);

        System.out.println("Edad al darse de alta: " + edadEnAlta.getYears() + " años");
        System.out.println("Carnet válido hasta: " + fechaCaducidad.format(formatoEspanol));
        System.out.println("Días de validez: " + diasDeValidez);
    }
}
`;

const CORREO = `import java.util.Scanner;

public class Correo {
    public static void main(String[] args) {
        Scanner teclado = new Scanner(System.in);
        String direccionLeida = teclado.nextLine();
        String direccion = direccionLeida.trim().toLowerCase();
        int posicionArroba = direccion.indexOf('@');
        String usuario = direccion.substring(0, posicionArroba);
        String dominio = direccion.substring(posicionArroba + 1);
        System.out.println("Usuario: " + usuario);
        System.out.println("Dominio: " + dominio);
        System.out.println("Caracteres del usuario: " + usuario.length());
        teclado.close();
    }
}
`;

describe('programas correctos del examen: ningún aviso', () => {
  it('C3 · FichaSocio', () => sinProblemas(FICHA_SOCIO));
  it('C1 · Correo', () => sinProblemas(CORREO));
  it('C4 · Expediente', () => sinProblemas(`import java.util.Scanner;

public class Expediente {
    public static void main(String[] args) {
        String datosAlumno = "Lucía 17 2";
        Scanner lector = new Scanner(datosAlumno);
        String nombre = lector.next();
        int edad = lector.nextInt();
        int curso = lector.nextInt();
        System.out.println(nombre + " tiene " + edad + " años y cursa " + curso + "º");
    }
}
`));
  it('B3 · Presupuesto corregido', () => sinProblemas(`import java.util.Scanner;

public class Presupuesto {
    public static void main(String[] args) {
        Scanner teclado = new Scanner(System.in);
        String cliente = teclado.nextLine();
        StringBuilder resumen = new StringBuilder();
        int letrasCliente = cliente.length();
        String clienteEnMayusculas = cliente.toUpperCase();
        String iniciales = cliente.substring(0, 3);
        resumen.append(clienteEnMayusculas);
        System.out.println(resumen);
    }
}
`));
  it('B4 · Bienvenida', () => sinProblemas(`public class Bienvenida {
    public static void main(String[] args) {
        StringBuilder saludo = new StringBuilder("Hola");
        System.out.println(saludo.length());
    }
}
`));
  it('B2 · Garantia con imports', () => sinProblemas(`import java.time.LocalDate;
import java.time.Period;

public class Garantia {
    public static void main(String[] args) {
        LocalDate fechaCompra = LocalDate.of(2026, 11, 13);
        LocalDate finGarantia = fechaCompra.plusMonths(24);
        LocalDate fechaRevision = LocalDate.of(2027, 2, 20);
        Period transcurrido = Period.between(fechaCompra, fechaRevision);

        System.out.println(finGarantia);
        System.out.println(transcurrido.getMonths());
        System.out.println(transcurrido.getDays());
        System.out.println(fechaCompra.isBefore(fechaRevision));
        System.out.println(fechaCompra);
    }
}
`));
  it('otros usos habituales', () => sinProblemas(`import java.util.ArrayList;

public class Varios {
    public static void main(String[] args) {
        final double IVA = 0.21;
        int mayor = Math.max(3, 4);
        double raiz = Math.sqrt(16);
        long redondeado = Math.round(2.5);
        int entero = Integer.parseInt("42");
        char inicial = 'a';
        byte pequeno = 10;
        ArrayList<String> nombres = new ArrayList<>();
        nombres.add("Ana");
        String primero = nombres.get(0);
        StringBuilder sb = new StringBuilder(50);
        sb.append("x").append(1).append(2.5);
        String texto = String.valueOf(3) + "a".repeat(2);
        System.out.printf("%d %s%n", mayor, texto);
        double circunferencia = 2 * Math.PI * raiz;
        int[] numeros = new int[3];
        numeros[0] = 7;
        int cantidad = numeros.length;
        if (mayor > 3) {
            mayor++;
        } else {
            mayor--;
        }
    }
}
`));
});

describe('errores que sí se detectan', () => {
  it('B3 original: los 5 errores del enunciado, y ninguno de más', () => {
    const m = mensajes(`public class Presupuesto {
    public static void main(String[] args) {
        Scanner teclado = new Scanner(System.in);
        String cliente = teclado.nextLine();
        StringBuilder resumen = StringBuilder();
        int letrasCliente = cliente.length;
        String clienteEnMayusculas = String.toUpperCase(cliente);
        String iniciales = cliente.substring("0", 3);
        resumen.append(clienteEnMayusculas);
        System.out.println(resumen);
    }
}
`);
    expect(m.filter((x) => x.includes('«Scanner» no se reconoce'))).toHaveLength(2);
    expect(m.some((x) => x.includes('Falta «new»'))).toBe(true);
    expect(m.some((x) => x.includes('«length» es un método de String'))).toBe(true);
    expect(m.some((x) => x.includes('«toUpperCase» es un método de instancia'))).toBe(true);
    expect(m.some((x) => x.includes('argumento 1 de «substring» es de tipo String y se esperaba int'))).toBe(true);
    expect(m).toHaveLength(6);
  });

  it('clase sin import', () => {
    expect(mensajes('public class A { void f() { LocalDate hoy = LocalDate.now(); } }').filter((x) => x.includes('LocalDate'))).toHaveLength(2);
    // java.lang no necesita import; un import con comodín vale
    sinProblemas('public class A { void f() { String s = "a"; Math.abs(1); } }');
    sinProblemas('import java.time.*;\npublic class A { void f() { LocalDate hoy = LocalDate.now(); } }');
  });

  it('un import dentro de un comentario o de un texto no cuenta', () => {
    expect(mensajes('// import java.time.LocalDate;\npublic class A { void f() { LocalDate hoy = LocalDate.now(); } }').length).toBeGreaterThan(0);
    expect(mensajes('public class A { void f() { String s = "LocalDate"; /* LocalDate */ } }')).toEqual([]);
  });

  it('método que no existe, con otras sugerencias de clase', () => {
    expect(mensajes('import java.time.LocalDate;\nclass A { void f() { LocalDate h = LocalDate.now(); h.plusYear(1); } }'))
      .toContain('La clase LocalDate no tiene ningún método llamado «plusYear».');
    expect(mensajes('import java.time.Period;\nclass A { void f() { Period p = Period.of(1, 2, 3); int x = p.getYear(); } }'))
      .toContain('La clase Period no tiene ningún método llamado «getYear».');
  });

  it('número y tipo de argumentos', () => {
    const arg = mensajes('import java.time.LocalDate;\nclass A { void f() { LocalDate h = LocalDate.of(2026, 9); } }');
    expect(arg[0]).toContain('«of» de LocalDate espera 3 argumentos y se le pasan 2');
    const tipo = mensajes('class A { void f() { String s = "a"; int n = s.indexOf(5); } }');
    expect(tipo.join(' ')).toContain('Ningún «indexOf»');
    expect(mensajes('class A { void f() { double r = Math.sqrt("16"); } }')[0]).toContain('se esperaba double');
  });

  it('declaraciones con un tipo que no cuadra', () => {
    expect(mensajes('class A { void f() { int x = 2.5; } }')[0]).toContain('sin perder información');
    expect(mensajes('class A { void f() { String s = 5; } }')[0]).toContain('No se puede convertir un valor de tipo int a String');
    expect(mensajes('class A { void f() { int x = "a"; } }')[0]).toContain('de tipo String a int');
    expect(mensajes('class A { void f() { long dias = 5; double d = 3; char c = 65; } }')).toEqual([]);
    // La división entera entre int y long ampliando está permitida; reducir no.
    expect(mensajes('import java.time.temporal.ChronoUnit;\nimport java.time.LocalDate;\nclass A { void f(LocalDate a, LocalDate b) { int dias = ChronoUnit.DAYS.between(a, b); } }')[0]).toContain('long en un int');
  });

  it('estático / instancia / propiedad / método', () => {
    expect(mensajes('class A { void f() { String t = String.toUpperCase("a"); } }')[0]).toContain('método de instancia');
    expect(mensajes('class A { void f() { double p = Math.PI(); } }')[0]).toContain('propiedad de Math');
    expect(mensajes('class A { void f() { double p = Math.sqrt; } }')[0]).toContain('es un método de Math');
    expect(mensajes('class A { void f() { int n = 5; int m = n.length(); } }')[0]).toContain('dato primitivo');
  });

  it('estructura: llaves, paréntesis, comillas y punto y coma', () => {
    expect(mensajes('class A {\n void f() {\n  int x = 1;\n }\n')).toEqual(['Falta cerrar «{» con «}».']);
    expect(mensajes('class A { void f() { int x = (1 + 2; } }').some((x) => x.includes('Falta cerrar «(»'))).toBe(true);
    expect(mensajes('class A { void f() { } } }')[0]).toContain('Sobra «}»');
    expect(mensajes('class A { void f() { String s = "hola; } }').some((x) => x.includes('comillas'))).toBe(true);
    expect(mensajes('class A {\n void f() {\n  int x = 1\n  int y = 2;\n }\n}')).toEqual(['Falta «;» al final de la instrucción.']);
    // Líneas que no necesitan «;»
    sinProblemas('class A\n{\n void f()\n {\n  int total = 1 +\n     2;\n  String s = "a"\n     + "b";\n  if (total > 1)\n   total++;\n  else\n   total--;\n }\n}');
    expect(mensajes('class A { void f() { int x = 1; x++ } }')).toEqual([]); // misma línea: las llaves la cierran
    expect(mensajes('class A {\n void f() {\n  int x = 1;\n  x++\n }\n}')).toEqual(['Falta «;» al final de la instrucción.']);
  });

  it('no inventa errores ante lo que no conoce', () => {
    sinProblemas(`import java.util.Scanner;
public class Producto {
    private String nombre;
    public Producto(String nombre) { this.nombre = nombre; }
    public String getNombre() { return nombre; }
    public static void main(String[] args) {
        Producto p = new Producto("a");
        String n = p.getNombre().toUpperCase();
        var otro = p.getNombre();
        System.out.println(p.nombre.length() + n + otro.trim());
    }
}`);
  });
});

describe('sugerencias tras el punto', () => {
  const nombres = (codigo: string, marca = '§') => {
    const cursor = codigo.indexOf(marca);
    const s = sugerenciasPunto(codigo.replace(marca, ''), cursor);
    return s ? { modo: s.modo, clase: s.clase, nombres: [...new Set(s.miembros.map((m) => m.nombre))] } : null;
  };

  it('tras una clase: miembros estáticos', () => {
    const r = nombres('import java.time.LocalDate;\nclass A { void f() { LocalDate.§ } }')!;
    expect(r.modo).toBe('estatico');
    expect(r.nombres).toEqual(expect.arrayContaining(['of', 'now', 'parse']));
    expect(r.nombres).not.toContain('plusDays');
    expect(nombres('class A { void f() { Math.§ } }')!.nombres).toEqual(expect.arrayContaining(['PI', 'sqrt', 'max']));
    expect(nombres('class A { void f() { System.§ } }')!.nombres).toEqual(expect.arrayContaining(['out', 'in']));
  });

  it('tras una variable: miembros de instancia, con lo ya escrito de por medio', () => {
    const r = nombres('import java.time.LocalDate;\nclass A { void f() { LocalDate fechaAlta = LocalDate.now(); fechaAlta.pl§ } }')!;
    expect(r.modo).toBe('instancia');
    expect(r.clase).toBe('LocalDate');
    expect(r.nombres).toEqual(expect.arrayContaining(['plusDays', 'plusYears', 'isBefore', 'format']));
    expect(r.nombres).not.toContain('of');
  });

  it('encadenado: el tipo se sigue por lo que devuelve cada método', () => {
    expect(nombres('import java.time.LocalDate;\nclass A { void f() { LocalDate d = LocalDate.now(); d.plusYears(2).§ } }')!.clase).toBe('LocalDate');
    expect(nombres('import java.util.Scanner;\nclass A { void f() { Scanner t = new Scanner(System.in); t.nextLine().§ } }')!.nombres).toContain('substring');
    expect(nombres('import java.time.temporal.ChronoUnit;\nclass A { void f() { ChronoUnit.DAYS.§ } }')!.nombres).toContain('between');
    expect(nombres('class A { void f() { System.out.§ } }')!.nombres).toEqual(expect.arrayContaining(['println', 'print', 'printf']));
    expect(nombres('class A { void f() { "hola".§ } }')!.nombres).toContain('length');
    expect(nombres('class A { void f() { new StringBuilder("a").§ } }')!.nombres).toContain('append');
    expect(nombres('class A { void f() { String s = "a"; s.trim().toLowerCase().§ } }')!.clase).toBe('String');
  });

  it('sin sugerencias donde no corresponde', () => {
    expect(nombres('class A { void f() { desconocido.§ } }')).toBeNull();
    expect(nombres('import java.time.§')).toBeNull();
    expect(nombres('class A { void f() { int n = 3; n.§ } }')).toBeNull();
    expect(nombres('class A { void f() { String s = "a"; s§ } }')).toBeNull();
  });

  it('variables declaradas y comentarios', () => {
    expect(variablesDeclaradas('class A { void f() { int edad = 1; String nombre; } }')).toEqual(expect.arrayContaining(['edad', 'nombre']));
    expect(enComentarioOTexto('int x; // hola', 14)).toBe(true);
    expect(enComentarioOTexto('String s = "ho', 14)).toBe(true);
    expect(enComentarioOTexto('String s = "hola"; s', 20)).toBe(false);
  });
});
