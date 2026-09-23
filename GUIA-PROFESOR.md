# Plataforma de exámenes — guía del profesor

Un examen en el navegador, **anónimo**, que se bloquea si el alumno se va a buscar la respuesta
a la IA, y que te devuelve un fichero de texto por alumno listo para corregir.

Está pensada para el instituto: sin servidores que mantener, sin cuentas que crear para el
alumnado y sin coste. Puedes usarla con cualquier módulo, curso y Resultado de Aprendizaje.

> **Pruébala ahora, en dos minutos.** Ve a
> **https://alexcatesp.github.io/examenes-galileo/?e=DEMO**, entra con uno de los códigos de
> la tabla del final y haz el examen de demostración. Pulsa Esc a mitad y verás el bloqueo: la
> contraseña para desbloquear es `demo-profe`.

---

## 1. Qué problema resuelve

Hoy un examen en el ordenador tiene dos agujeros: el alumno puede abrir otra pestaña y
preguntarle a una IA, y si quieres corregir con IA acabas enviándole trabajo con el nombre de
tus alumnos. Esta plataforma cierra los dos.

| | |
|---|---|
| **Anonimato real** | El examen se identifica con un **código** (`K7FM-2QXR-9TPA`), nunca con el nombre. Ni la app ni el fichero de respuestas saben quién es nadie. La correspondencia código → alumno la tienes tú, en papel. |
| **No se sale de la pestaña** | El examen va a pantalla completa. Si el alumno la abandona, cambia de ventana o cambia de pestaña, **se bloquea** y solo se reanuda con tu contraseña. |
| **No se copia ni se pega** | Copiar, cortar, pegar, el menú contextual y los atajos de herramientas de desarrollo están desactivados. |
| **El examen no se filtra** | Se publica **cifrado**. Sin un código válido no hay forma de leerlo, aunque la página sea pública y se mire el código fuente. |
| **No se pierde nada** | Las respuestas se guardan solas cada minuto. Si el equipo muere, el alumno sigue en otro puesto donde lo dejó. |
| **Doble copia** | La entrega llega a tu Google Drive **y** el alumno sube el fichero a Teams. |

### Lo que NO hace

Conviene decirlo claro:

- No impide fotografiar la pantalla con el móvil ni usar un segundo dispositivo. **La
  vigilancia en el aula sigue haciendo falta**; esto quita las tentaciones fáciles, no todas.
- No impide que un alumno le pase su código a alguien de fuera. Por eso los códigos se
  reparten en mano al empezar.
- Si un alumno escribe su nombre dentro de una respuesta, ese nombre viaja con el fichero. La
  app se lo advierte tres veces, pero no lo censura.
- Está probada en **Chrome y Edge de escritorio**. En móvil o tablet no se ha probado, y el
  editor de código no es usable en una pantalla pequeña.

---

## 2. Cómo lo vive el alumno

1. Abre la URL que le das y **teclea su código**. Si se equivoca al copiarlo, la app se lo
   dice en el momento: el código lleva un dígito de control.
2. Lee las normas y pulsa **Empezar**. La pantalla se pone en completa y arranca la cuenta
   atrás, que fija el servidor (cambiar la hora del PC no sirve de nada).
3. Responde. **Una pregunta por pantalla**, con un índice lateral para saltar donde quiera y
   ver qué lleva contestado. Puede marcar preguntas para revisar.
4. Si se sale, la pantalla se bloquea y tiene que llamarte. **El reloj no se para.**
5. Al entregar (o al acabarse el tiempo), se descarga su fichero y la pantalla le dice que lo
   suba a Teams. Ese código ya no vuelve a abrir el examen.

### Tipos de pregunta

- **Test de una respuesta** y **test de varias respuestas**.
- **Texto libre**, para supuestos y justificaciones.
- **Editor de código** con números de línea y colores de sintaxis (HTML, CSS, JavaScript,
  TypeScript, JSON, XML, SQL, Java, Python, PHP, YAML, Markdown, shell). Debajo tiene un
  cuadro aparte para la explicación o los apartados.

> El editor **no ayuda a escribir bien**, y es deliberado: no autocompleta, no cierra
> etiquetas solo, no marca en rojo los errores ni señala los paréntesis que no casan. Si un
> alumno deja una etiqueta sin cerrar, tiene que darse cuenta él.

Las preguntas y las opciones **se barajan** para cada alumno, así que mirar la pantalla del de
al lado no sirve. El fichero de respuestas sale siempre en el orden original, para que
corrijas todos igual.

---

## 3. Qué recibes tú

Un `.md` por alumno en tu Drive, ordenado así:

```
Examenes-Galileo/2026-27/1DAM/LMSG/RA1/ev_continua/1DAM_LMSG_RA1_K7FM-2QXR-9TPA.md
                 └ curso  └ grupo └ módulo └ RA └ convocatoria
```

Dentro, cada pregunta con su criterio de evaluación y su nivel, y la respuesta del alumno:

```markdown
---
examen: "DAM-0373-RA1"
codigo: "K7FM-2QXR-9TPA"
inicio: 2026-10-05T09:02:11+02:00
entrega: 2026-10-05T10:15:40+02:00
duracion_min: 73
---

### B2 · RA1-INT-I-02 · Intermedio · CE g, h · desarrollo

Dado `<lista><item>Uno<item>Dos</item></lista>`: **(g)** señala el error sintáctico…

**Respuesta:**

```text
El primer item no se cierra…
```
```

Como cada pregunta lleva su CE y su nivel, la corrección (a mano o con IA) puede calcular
directamente la nota de cada criterio.

---

## 4. El formato del examen que se carga

Esta es la parte importante si quieres usarla con tus propios exámenes.

La app **no se escribe a mano**: se genera a partir de un examen en Markdown, del que un
script extrae la versión del alumno **quitando las soluciones**. Si tus exámenes ya están en
Markdown, probablemente funcionen tal cual: el conversor reconoce los formatos habituales y se
ha probado con 211 exámenes distintos.

### Estructura mínima

````markdown
# Examen modelo — RA1: Reconoce las características de lenguajes de marcas…

**Módulo:** Lenguajes de marcas (0373) · **Ciclo:** DAM · **Curso:** 1º
**Duración:** 2×50 min (~70 min de resolución)

## Parte A — Básico (test, 1 por CE)

**A1. (CE a)** ¿Qué afirmación describe mejor un lenguaje de marcas?
- a) Un lenguaje que ejecuta instrucciones con variables y bucles.
- b) Un sistema que anota un texto separando contenido y marcas que lo describen.
- c) Una base de datos relacional.
- d) Un formato binario propietario.

## Parte B — Intermedio

**B1. (CE a, c, f)** Dados tres fragmentos… compara dos de ellos en un par de criterios.
<!-- respuesta: texto -->

## Parte C — Avanzado

**C2. (CE g, h, i)** Diseña en XML un vocabulario para una `receta`…
<!-- respuesta: codigo(xml) -->

## Corrección (plantilla del profesor)

A1 → **b** · A2 → …

**B1.** Lo que se espera… **10 = los tres apartados coherentes.**
````

Las reglas son cuatro:

1. **Las partes** empiezan por `## Parte A — Básico…`, `## Parte B — Intermedio…`,
   `## Parte C — Avanzado…`. El nivel sale de ahí.
2. **Cada pregunta** empieza en su propia línea con `**A1. (CE a)**`, y los CE entre
   paréntesis. Las opciones del test van en líneas `- a) …`, `- b) …`.
3. **El tipo de respuesta** se marca con un comentario debajo del enunciado:
   `<!-- respuesta: texto -->` o `<!-- respuesta: codigo(xml) -->`. Si no lo pones, el script
   lo deduce y te enseña una tabla para que lo confirmes antes de publicar nada.
4. **Las soluciones van solo al final**, en una sección `## Corrección`. Nunca intercaladas.

> **Seguro contra despistes:** antes de cifrar, el script busca rastros de solución
> (`Solución:`, `→ **b**`, `10 = …`) en lo que iría al alumno y **se niega a publicar** si
> encuentra alguno. Y al publicar, una segunda comprobación verifica que en el sitio web no
> viaja nada en claro.

---

## 5. Montarla tú, desde cero

Unos 20 minutos la primera vez. Después, preparar cada examen son dos comandos.

**Lo que hace falta:** una cuenta de GitHub, una cuenta de Google y Python instalado. No hace
falta saber programar, pero sí perderle el miedo a la terminal.

### 5.1 Tu copia del proyecto

El código de la plataforma (los scripts y la aplicación) vive en un repositorio privado, junto
con el material de los módulos. **Pídemelo y te doy acceso**, o te paso la carpeta
`plataforma-examenes` suelta, que es autocontenida.

Una vez la tengas, entra en ella e instala lo que necesita el script:

```bash
pip install -r scripts/requirements.txt
```

### 5.2 El sitio web (GitHub Pages)

1. Crea un repositorio **público** y vacío, por ejemplo `examenes-<tuapellido>`.
2. En *Settings → Pages*, elige *Deploy from a branch*, rama `main`, carpeta `/ (root)`.
3. En `config.json`, pon tu URL: `https://<tuusuario>.github.io/<turepo>/`.

En ese repositorio público solo acaban la aplicación compilada y los exámenes **cifrados**.
Los enunciados en claro, los códigos y las contraseñas no salen nunca de tu ordenador.

### 5.3 El buzón de entregas (Google Apps Script)

Es lo que recibe los exámenes y los guarda en tu Drive. Está detallado en
[`apps-script/DESPLIEGUE.md`](apps-script/DESPLIEGUE.md); en resumen:

1. En https://script.google.com, **Nuevo proyecto**, y pega el contenido de
   [`apps-script/Code.gs`](apps-script/Code.gs).
2. En *Configuración del proyecto*, añade la propiedad `URL_PUBLICA` con la URL del paso
   anterior, y pon la zona horaria de Madrid.
3. Ejecuta la función `comprobarConfiguracion` para conceder permisos (Google avisará de que
   «no ha verificado esta aplicación»: es tu propio script, continúa).
4. **Implementar → Nueva implementación → Aplicación web**, ejecutando **como tú** y con
   acceso para **cualquier usuario** (los alumnos no inician sesión en Google).
5. Copia la URL que acaba en `/exec` y ponla en `config.json`, en `receptor`.

> Si más adelante cambias el `Code.gs`, hay que **implementar una versión nueva**; guardar no
> basta. Es el error más habitual.

### 5.4 Preparar un examen

```bash
# 1. Sacar la versión del alumno, sin soluciones
python scripts/preparar_examen.py extraer ruta/al/examen-modelo-RA1.md --id DAM-0373-RA1 --duracion 100

# 2. Revisar la tabla que imprime y, si hace falta, editar .privado/DAM-0373-RA1/examen.json

# 3. Cifrar y generar los códigos (alumnos + 3 o 4 de reserva)
python scripts/preparar_examen.py cifrar DAM-0373-RA1 --codigos 20

# 4. Comprobar que un código abre el examen
python scripts/preparar_examen.py verificar DAM-0373-RA1 K7FM-2QXR-9TPA
```

Te deja tres cosas en `.privado/DAM-0373-RA1/` (carpeta que nunca se sube a ningún sitio):

- **`codigos.html`** — la hoja para imprimir y recortar, una papeleta por alumno.
- **`codigos.csv`** — la tabla código → alumno, con la columna del alumno vacía.
- **`ficha-profesor.md`** — la URL, la contraseña de desbloqueo y la duración.

Sube el examen cifrado (`git push`) y en un par de minutos está publicado.

> Si vuelves a cifrar un examen ya repartido, **los códigos anteriores dejan de valer**. Por
> eso el script te obliga a pedirlo con `--regenerar`.

---

## 6. El día del examen

Una lista para no olvidarse de nada:

**Antes**
- [ ] Imprime `codigos.html` a una cara y recorta las papeletas.
- [ ] Apúntate la contraseña de desbloqueo (está en la ficha del profesor).
- [ ] Haz tú una entrega de prueba con un código y bórrala de Drive.
- [ ] Ten la URL a mano para proyectarla.

**Durante**
- [ ] Reparte una papeleta a cada alumno.
- [ ] Diles que escriban su nombre **por detrás** y te la devuelvan al entregar.
- [ ] Cuando una pantalla se bloquee, acércate y teclea la contraseña. El reloj no se para.
- [ ] Recuérdales al final que **suban el fichero a Teams**.

**Después**
- [ ] Recoge las papeletas y pasa los nombres a `codigos.csv`, en casa y sin prisa.
- [ ] Comprueba en Drive que tienes tantos ficheros como alumnos.

El papel con el nombre por detrás es el truco que hace que esto funcione: es el **único**
vínculo entre el código y la persona, lo escribe el alumno delante de ti y lo guardas tú.

---

## 7. Corregir

Las entregas solo llevan el código, así que se pueden pasar a una IA sin exponer a nadie. En
este repositorio hay dos ayudas preparadas para Claude Code:

- **`corregir-examen`** puntúa cada ejercicio contra la rúbrica del módulo y el examen modelo,
  y saca un informe por código con la nota de cada criterio, más un `resumen.csv`.
- **`mensaje-teams-correccion`** convierte cada informe en el mensaje que pegas como respuesta
  a la entrega de Teams, en segunda persona y anclado a lo que el alumno escribió.

Si corriges a mano, el fichero ya te da cada respuesta con su CE y su nivel al lado.

**El `codigos.csv` no entra nunca en la corrección.** Se usa al final, cuando ya hay notas,
para saber de quién es cada código. Ese cruce lo haces tú.

---

## 8. Preguntas frecuentes

**¿Y si un alumno llega tarde?** Le das un código y empieza. Su tiempo cuenta desde que pulsa
*Empezar*, no desde que empezó la clase.

**¿Y si se le cuelga el ordenador?** Se sienta en otro puesto, entra con su código, tú tecleas
la contraseña y continúa donde lo dejó. Como mucho pierde el último minuto.

**¿Y si se va la red del centro?** El examen sigue funcionando: las respuestas se guardan en
el navegador y al entregar se descarga el fichero igual. Lo único que se pierde es la copia
automática a tu Drive, que es justo para lo que está la subida a Teams.

**¿Y si alguien entrega sin querer?** Con tu contraseña puedes reabrir el examen, siempre que
quede tiempo.

**¿Pueden ver el examen antes?** No. Está cifrado y solo se abre con un código, y los códigos
los repartes tú al empezar.

**¿Cuánto cuesta?** Nada. GitHub Pages y Google Apps Script son gratuitos para este uso.

**¿Puedo usar la instalación de otro compañero?** Técnicamente sí, pero entonces las entregas
de tus alumnos caen en el Drive de él. Es mejor que cada uno monte la suya: son 20 minutos.

---

## 9. El examen de demostración

- **URL:** https://alexcatesp.github.io/examenes-galileo/?e=DEMO
- **Contraseña del profesor:** `demo-profe`
- Dura 15 minutos y tiene 5 preguntas: test de una respuesta, test de varias, texto libre y
  dos de código (XML y SQL), para que veas todos los tipos.

Cada código se cierra al entregar, así que usa uno distinto en cada prueba:

| | | |
|---|---|---|
| `2765-9A99-JKGG` | `2XS3-CXZR-WECC` | `40WN-03HJ-6HKJ` |
| `5RBY-564Q-DHZP` | `6G86-8YMJ-Y1Q7` | `801M-Y40A-B4MP` |
| `91Q8-J16K-DB09` | `9GXX-K3EW-TX0S` | `9KFZ-T14Q-155V` |
| `A90H-DDD1-ZTYX` | `A9MV-K66T-V3WB` | `BD04-XGEC-F4WA` |
| `DWVR-XXEH-PRM0` | `ES25-017C-H7C7` | `GMBR-F83H-2KDA` |
| `GNES-X2JD-JVC4` | `J900-18D2-4ERG` | `MAZV-47KJ-7DKN` |
| `NAYQ-E4A3-2735` | `NNA8-B28P-NQGV` | `Q2JW-R3SR-KQFR` |
| `VG23-9VTK-QEH5` | `XEFR-Y2YA-JZTD` | `Y01E-FHY1-TJ2N` |

Prueba a salir de la pantalla completa con Esc: verás el bloqueo y podrás desbloquearlo con
`demo-profe`. Y fíjate en que, al entregar, la pantalla insiste en Teams y no menciona nada
más: es a propósito, para que el alumno no se crea que ya ha terminado.

---

*Cualquier duda, o si quieres que te ayude a montarla, dímelo. — Alejandro*
