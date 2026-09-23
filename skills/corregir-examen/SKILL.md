---
name: corregir-examen
description: >
  Corrige los exámenes entregados por la plataforma de exámenes de forma estricta y justa,
  aplicando la rúbrica del módulo (Básico 0,5 / Intermedio 0,2 / Avanzado 0,3) y el examen
  modelo con sus soluciones. Produce un informe por alumno con la nota de cada CE y del RA,
  justificada con lo que el alumno escribió, y un resumen en CSV. Trabaja siempre con el
  código anónimo, nunca con el nombre. Se activa con peticiones como "corrige los exámenes
  de 1DAM LMSG RA1", "descarga y corrige las entregas de la UT01", "corrige este examen" o
  similares.
---

# Skill: corregir exámenes

Convierte las entregas anónimas en notas justificadas. **No pone notas a ojo**: cada
puntuación nace de una frase concreta del alumno contrastada con la solución del examen
modelo.

## Reglas inviolables

1. **Anonimato.** Se trabaja con el código (`K7FM-2QXR-9TPA`), nunca con nombres. Si el
   profesor ofrece el `codigos.csv`, se rechaza: no hace falta para corregir y su función es
   justo la contraria. Si un alumno escribió su nombre dentro de una respuesta, no se
   reproduce en el informe.
2. **La rúbrica manda.** Las fórmulas y los pesos salen de `rubrica.md` y de
   `calificaciones.config.json` del módulo, no de la intuición.
3. **Nada de inventar.** Si una respuesta está vacía, es un 0; no se le supone intención.
   Si algo es ambiguo, se marca para revisión humana en vez de decidir por el profesor.
4. **Misma vara para todos.** Antes de escribir informes se fija el criterio de cada ítem y
   se aplica igual a los 20. Si a mitad de corrección cambias de criterio, se rehacen los ya
   corregidos.

## Entradas

| Qué | Dónde |
|---|---|
| Entregas | Drive: `Examenes-Galileo/<curso>/<grupo>/<siglas>/<RA>/<convocatoria>/` |
| Examen modelo **con soluciones** | `modulos/<CICLO>/<MOD>/examenes/examen-modelo-RA<n>.md` |
| Rúbrica del módulo | `modulos/<CICLO>/<MOD>/examenes/rubrica.md` |
| Pesos de CE y RA | `modulos/<CICLO>/<MOD>/examenes/calificaciones.config.json` |

Si los materiales del módulo no están en la rama actual, tráelos con
`git show origin/generacion-materiales:<ruta>`.

Para bajar las entregas, usa el conector de Google Drive (`search_files` con
`title contains '<grupo>_<siglas>_<RA>'`, luego leer cada fichero). **Los originales se
quedan en Drive**: son la copia de seguridad y la evidencia de evaluación.

## Cómo se calcula la nota

Del `rubrica.md` (confírmalo ahí, que manda él):

1. **Cada ejercicio, de 0 a 10.**
2. **Banda (CE × nivel)** = media de los ejercicios de ese CE y ese nivel.
3. **Nota del CE** = `0,5·Básico + 0,2·Intermedio + 0,3·Avanzado`. Un nivel no examinado
   cuenta 0. Quedarse en el mínimo del criterio es un 5, no un sobresaliente.
4. **Nota del RA** = media de sus CE ponderada por el peso de cada CE (solo los evaluados).
5. Un **ítem integrador** cubre varios CE. Se puntúa con **subrúbrica cuando el examen modelo
   lo marca** («apto para subrúbrica»): una nota por apartado, porque así se sabe qué criterio
   concreto hay que recuperar. En el resto, holística: una sola nota que va igual a todos sus
   CE, que es lo que mide si el alumno sabe juntar las piezas.

   En `notas.json`, holística es `"C3": 7` y subrúbrica `"C2": {"g": 8, "h": 4, "i": 0}`.

Cada `.md` entregado trae en cada pregunta su ID, su CE y su nivel, así que el reparto es
directo. No hay que adivinarlo.

## Proceso

### Paso 1 — Preparar
Lee el examen modelo, la rúbrica y los pesos. Construye la tabla de ítems: para cada uno, CE,
nivel, qué pide y **qué es un 10** según la solución. Enséñasela al profesor si el examen es
nuevo.

### Paso 2 — Fijar el criterio
Antes de corregir a nadie, escribe para cada ítem qué separa un 10 de un 7, de un 5 y de un 0.
Para los test es binario (acierto 10, fallo 0, en blanco 0, sin penalización salvo que el
examen diga otra cosa).

### Paso 3 — Corregir
Por cada entrega, y **de ítem en ítem, no de alumno en alumno** cuando sean muchos (corregir
la misma pregunta seguida en los 20 exámenes mantiene la vara igual):

- Cita la parte de la respuesta que justifica la nota.
- Puntúa 0–10 y di en una línea qué falta para el siguiente escalón.
- Marca `⚠ revisar` si la respuesta es ambigua, si parece copiada literalmente de un
  compañero o si contiene datos personales.

### Paso 4 — Calcular y escribir
Aplica las fórmulas, redondea a un decimal y escribe el informe.

### Paso 5 — Avisar de lo que no cuadra
Al terminar, resume: entregas corregidas, cuántas están en blanco, cuáles llevan `⚠ revisar`,
qué CE ha ido peor en el grupo y si hay respuestas sospechosamente iguales entre códigos.

## Salidas

En `plataforma-examenes/.privado/correcciones/<ID-EXAMEN>/` (privado, fuera de git):

1. **`<CODIGO>.md`** — un informe por alumno:

```markdown
# <CODIGO> — <grupo> · <módulo> · <RA>

**Nota del RA: 7,4**

| CE | Básico | Intermedio | Avanzado | Nota CE | Peso |
|----|--------|------------|----------|---------|------|
| a  | 10     | 7          | 5        | 8,4     | 12 % |

## Ejercicio A1 (CE a · Básico) — 10
> «…lo que respondió…»
Correcto: identifica el elemento raíz.

## Ejercicio B2 (CE g, h · Intermedio) — 6
> «…lo que respondió…»
Detectas el error pero no explicas qué haría el parser. Para un 8–10 faltaba decir que
un parser de XML rechazaría el documento.
```

2. **`resumen.csv`** — `codigo,nota_ra,ce_a,ce_b,…,revisar` para volcar a
   `calificaciones.xlsx` o para cruzar con `codigos.csv` cuando pongas las notas.

3. Si el profesor lo pide, el mensaje para cada alumno con la skill
   `mensaje-teams-correccion`.

## Después

Las notas se trasladan a los alumnos cruzando el `resumen.csv` con `codigos.csv` (o con las
papeletas). **Ese cruce lo hace el profesor, no la IA.**
