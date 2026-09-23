# Plataforma de exámenes — Especificación

> Plantilla reutilizable para cualquier ciclo, módulo y RA. Surge de la entrevista de requisitos
> (22-09-2026) y sustituye a la app de LMSG del curso 2025/26
> (`iesgalileo-2025-26/examen/1ªFinal/1DWN/LMSG/app`).

## 1. Objetivos

1. Examinar a los alumnos en el navegador, impidiendo salir de la pestaña (para no usar IA).
2. Producir un fichero `.md` por alumno con las preguntas y sus respuestas, listo para corregir con
   la skill `corregir-examen`.
3. **Anonimato total**: ni el nombre del alumno ni ningún dato suyo aparece en la app, en el `.md`
   ni en su nombre de fichero. El único identificador es un **código de acceso**.
4. Que el examen **no pueda leerse** antes de repartir los códigos, aunque la web sea pública.
5. Que funcione con cualquier `examen-modelo-RAx.md` generado por la skill `examenes-por-ra`.

## 2. Decisiones de la entrevista

| Tema | Decisión |
|---|---|
| Despliegue | Web estática en **GitHub Pages**, alojada en un **repo público aparte** (p. ej. `examenes-galileo`). `iesgalileo-2026-27` sigue siendo privado. |
| Publicación | Una GitHub Action de este repo compila la app y publica en el repo público **solo** la app y los exámenes cifrados. |
| Stack | Vite + React + TypeScript. CodeMirror 6 para el editor de código y WebCrypto nativo para el cifrado. Vitest para los tests. |
| Contenido | Un **script conversor** (`preparar_examen.py`) lee `examen-modelo-RAx.md`, **elimina las soluciones** y cifra el examen. |
| Acceso | **N códigos** aleatorios por examen, generados por el script. Cada código permite abrir el examen y es a la vez el identificador anónimo del alumno. |
| Mapeo código→alumno | Lo apunta el profesor a mano, en una plantilla CSV que genera el script (fuera de git). |
| Formato del código | `XXXX-XXXX-XXXX`. Alfabeto Crockford base32 (sin `I L O U`; al teclear, `O` se lee como `0` e `I`/`L` como `1`). El último carácter es un dígito de control. |
| Entrega | **Doble**: envío automático a **Google Drive** (vía Google Apps Script) **y** descarga del `.md` para subirlo a Teams. |
| Recogida | Una carpeta de Drive por examen con `<CODIGO>.md`. Se descarga en zip y se pasa a `corregir-examen`. |
| Antitrampa | Bloqueo al perder el foco (`blur` + `visibilitychange`), pantalla completa obligatoria y bloqueo de copiar/pegar/cortar/menú contextual/arrastrar. |
| Desbloqueo | **Contraseña distinta por examen**, generada por el script. En la web solo se guarda su hash. |
| Incidencias | **No se registran** (solo se bloquea la pantalla). |
| Tipos de pregunta | Test de opción única, test de opción múltiple, texto libre y editor de código con resaltado. |
| Tiempo | Cuenta atrás configurable. A 0 se **entrega automáticamente** (envío a Drive y descarga del `.md`). El reloj cambia de color al acercarse el final, sin avisos emergentes. |
| Barajado | Se barajan **las preguntas** dentro de cada parte y **las opciones** del test, con una semilla derivada del código. El `.md` sale en **orden y letras canónicos**. |
| Navegación | **Una pregunta por pantalla**, con índice lateral (respondida o pendiente) y salto libre. |
| Recuperación | Autoguardado en `localStorage` y en Drive cada minuto. Para reanudar hay que introducir **código + contraseña del profesor**. El tiempo sigue corriendo mientras tanto. |
| Reentrada | Tras entregar, el código queda **cerrado**: muestra «Examen ya entregado» y permite volver a descargar el `.md`. Solo se reabre con la contraseña del profesor. |
| Ventana horaria | No hay. Basta con los códigos. |
| Nombre dentro de respuestas | Solo un aviso visible en la app («No escribas tu nombre en ninguna respuesta»). |
| Equipos | PCs del aula con Chrome o Edge (sin requisitos de soporte para Firefox, Safari ni móviles). |

## 3. Arquitectura

```
iesgalileo-2026-27 (privado)                         examenes-galileo (público, Pages)
─────────────────────────────                        ─────────────────────────────────
modulos/<CICLO>/<mod>/examenes/examen-modelo-RAx.md  index.html + assets (app)
plataforma-examenes/                                 examenes/<id>.json   ← solo cifrado
  app/            (Vite+React+TS)          ──Action──▶
  scripts/preparar_examen.py
  apps-script/Code.gs  (receptor Drive)
  examenes/<id>.json   (paquetes cifrados)
  .privado/        (gitignored: códigos, CSV, ficha)
```

URL del alumno: `https://<usuario>.github.io/examenes-galileo/?e=DAM-0373-RA1`

### 3.1 Flujo

1. **Preparar** (profesor):
   `python preparar_examen.py --modelo modulos/DAM/0373-lenguajes-de-marcas/examenes/examen-modelo-RA1.md --codigos 30 --duracion 75`
   En dos pasos:
   - `extraer` interpreta el examen, quita los bloques de corrección y escribe `.privado/<id>/examen.json`.
     Muestra una tabla con el tipo de respuesta deducido para cada pregunta, para que el profesor lo revise o edite.
   - `cifrar <id> --codigos N` valida el examen, bloquea el cifrado si hay fugas y genera
     `examenes/DAM-0373-RA1.json` (paquete cifrado, que se commitea). Además, en `.privado/DAM-0373-RA1/`:
     - `codigos.csv`: plantilla `codigo,alumno` con la columna del alumno vacía.
     - `ficha-profesor.md`: URL, contraseña de desbloqueo, duración y número de códigos.
2. **Publicar**: push, y la Action despliega en el repo público.
3. **Examen**: el profesor reparte un código a cada alumno y apunta en `codigos.csv` a quién se lo da.
4. **Entrega**: automática o manual. El `.md` llega a Drive y el alumno sube su copia a Teams.
5. **Corrección**: se descarga la carpeta de Drive y se pasa a `corregir-examen`. El CSV **nunca** se pasa a la IA.

## 4. Seguridad y cifrado

**Modelo de amenaza**: alumnos con conocimientos de DevTools. No se contempla un atacante con
recursos. Objetivo: que sin un código válido no se pueda leer el examen y que no se pueda desbloquear
sin la contraseña.

- **Cifrado de sobre (envelope)**:
  - `K` es una clave aleatoria AES-256-GCM que cifra el JSON del examen (sin soluciones).
  - Para cada código `c`: `KEK_c = PBKDF2-SHA256(normalizar(c), salt, 310 000 iteraciones)`.
    `K` se guarda envuelta con `KEK_c` (AES-GCM).
  - Para no probar todas las entradas, se añade un localizador por código:
    `loc_c = HMAC-SHA256(salt, c)[0:8]`, en hex.
  - El paquete público contiene `{version, id, salt, iter, entradas:[{loc, kWrapped, iv}], ivExamen, examenCifrado}`.
    **No contiene los códigos.**
- **Entropía**: 11 caracteres útiles de base32 ≈ 55 bits, y cada intento cuesta el PBKDF2. Así que la fuerza bruta offline no es viable.
- **Contraseña de desbloqueo**: se guarda como `PBKDF2(pwd, salt2)` **dentro** del examen cifrado (solo
  la ve quien tiene un código). Es aleatoria, de unos 10 caracteres, distinta en cada examen y se lee en la ficha del profesor.
- **Normalización del código**: mayúsculas, sin guiones ni espacios, `O→0`, `I/L→1` (sin ambigüedad
  de tecleo). Se valida el dígito de control antes de derivar la clave, para responder al instante si hay una errata.
- **Receptor (Apps Script)**:
  - Acepta un POST `text/plain` (sin preflight CORS) con `{accion:"autosave"|"final", examen, codigo, inicio, respuestas, md}`.
  - Solo admite códigos válidos. Para comprobarlo, descarga el paquete publicado (`URL_PUBLICA/examenes/<id>.json`, en caché 6 h), calcula
    `loc` con la sal y comprueba que figura en el paquete. No hace falta subir ningún registro a Drive.
  - Con `accion:"final"`, escribe `<CODIGO>.md`. Si ya existía (examen reabierto), conserva el anterior como `<CODIGO>__<fecha>.md`.
  - Con `autosave`, escribe `.autosave/<CODIGO>.json`.
  - Un GET `?accion=estado&examen=..&codigo=..` devuelve el estado (`nuevo | en-curso | entregado`, con `inicio`), lo que permite aplicar el cierre tras la entrega aunque se cambie de navegador.
- **Qué no se puede evitar**: fotografiar la pantalla con el móvil, tener un segundo dispositivo o que un alumno pase su código a otro.
  El bloqueo es un disuasorio: el control real es la vigilancia en el aula.

## 5. La app (alumno)

1. **Portada**: se introduce el código. Si el dígito de control falla, se avisa al momento. Si el código es válido, se descifra el examen.
2. **Instrucciones**: módulo, RA, duración y normas (pantalla completa, no salir, no firmar respuestas).
   Con el botón «Empezar» se entra en pantalla completa y arranca la cuenta atrás.
3. **Examen**:
   - Una pregunta por pantalla, con índice lateral por partes (A/B/C) y estado respondida o pendiente.
   - Controles: anterior, siguiente y marcar para revisar.
   - Reloj en la cabecera: neutro normalmente, ámbar a falta de 10 minutos y rojo a falta de 5.
   - Tipos de respuesta:
     - `unica`: radio.
     - `multiple`: casillas.
     - `texto`: textarea autoexpandible.
     - `codigo(lang)`: CodeMirror con números de línea, resaltado y Tab que indenta, sin autocompletado.
       Debajo, un área opcional para la explicación o para responder a los apartados.
       Lenguajes: html, css, javascript, typescript, json, xml, sql, java, python, php, yaml, markdown, shell y texto.
4. **Bloqueo**: se activa con `blur`, con `visibilitychange` (oculta) o al salir de la pantalla completa.
   Aparece una pantalla opaca que pide la contraseña. Al desbloquear, se vuelve a pantalla completa. El reloj no se detiene.
5. **Entrega** (botón con confirmación, o al llegar a 0):
   - Genera el `.md`, lo envía a Drive (con reintentos y un indicador de estado) y lo descarga como `<ID>_<CODIGO>.md`.
     La URL del receptor está en `config.json`, que es público y va junto a la app, así que cambiarla no obliga a volver a cifrar los exámenes.
   - Muestra la confirmación y el recordatorio de subirlo a Teams.
6. **Persistencia**: el estado se guarda en `localStorage` con la clave del examen y el `loc`, es decir, las respuestas, el orden, el inicio y si está entregado. Si al cargar hay un examen
   en curso, se pide la contraseña del profesor para continuar.

## 6. Formato del `.md` de respuestas

~~~markdown
---
examen: DAM-0373-RA1
modulo: "0373 Lenguajes de marcas y sistemas de gestión de información"
ciclo: DAM
curso: 1
ra: RA1
codigo: K7FM-2QXR-9TPA
fecha: 2026-10-05
inicio: 2026-10-05T09:02:11+02:00
entrega: 2026-10-05T10:15:40+02:00
entrega_automatica: false
---

# Examen DAM-0373-RA1 — Código K7FM-2QXR-9TPA

## Parte A — Básico

### A1 · RA1-a-B-01 · Básico · CE a · test (única)
<enunciado>
- a) …
- b) …
**Respuesta:** b

## Parte B — Intermedio

### B1 · RA1-INT-I-01 · Intermedio · CE a, d, e · código (xml)
<enunciado>
**Respuesta:**
```xml
…
```
~~~

- Siempre en orden y con letras canónicos, sea cual sea el barajado.
- Si una pregunta no tiene respuesta, se escribe `**Respuesta:** _(sin responder)_`.
- **Sin** nombre, IP, user-agent ni incidencias.

## 7. Conversor `preparar_examen.py`

- **Entrada**: `examen-modelo-RAx.md`, con la estructura de la skill `examenes-por-ra` (Partes A/B/C, ítems `**A1. (CE a)**`,
  opciones `- a)`, bloques de corrección y la matriz de especificaciones con los IDs de ítem y los CE).
- **Tipo de respuesta**:
  1. Si existe la marca explícita `<!-- respuesta: unica | multiple | texto | codigo(lang) -->`, se usa esa.
  2. Si no, lo deduce: las preguntas con opciones son `unica`, o `multiple` si el enunciado dice «marca todas / varias»; si la solución o el enunciado contiene un bloque ```lang, es `codigo(lang)`; en otro caso, `texto`.
  3. Muestra la tabla de tipos para que el profesor la confirme (`--si` para aceptarla sin preguntar).
- **Salvaguarda**: tras interpretar el examen, comprueba que en el JSON en claro no queda ningún marcador de solución (`Corrección`,
  `Solución`, `Respuesta correcta`, `✅` …). Si aparece alguno, **aborta**.
- Opciones: `extraer --id --duracion --titulo --sobrescribir` · `cifrar --codigos N --duracion --contrasena --regenerar` · `verificar ID CODIGO`.
- Formatos reconocidos (probado con los 211 exámenes modelo del repo):
  - Ítems: `**A1. (CE a)**`, `**P1.** (CE …)`, `**1. [a·IL1]**`, `## Ejercicio N […]`, `### A1 — CE a […]`.
  - Soluciones: `## Corrección`, `## Solucionario`, `# PLANTILLA DE CORRECCIÓN`, `<details>`, `**Solución:**`, `→ **Corrección:**` y `> *Solución:*`.
- Si un formato no se reconoce, la skill `preparar-examen-plataforma` escribe `examen.json` a mano con el mismo esquema.
- **Cambio en la skill `examenes-por-ra`**: que emita la marca `<!-- respuesta: … -->` en cada ítem.

## 8. Entregables de implementación (hechos)

1. `plataforma-examenes/app/`: la app, con tests de cifrado, normalización del código, barajado canónico y generación del `.md`.
2. `plataforma-examenes/scripts/preparar_examen.py`: con tests contra los exámenes modelo existentes.
3. `plataforma-examenes/apps-script/Code.gs` y la guía de despliegue paso a paso.
4. `.github/workflows/publicar-examenes.yml`: compila y publica en el repo público (con un deploy key o PAT como secreto).
5. `plataforma-examenes/README.md`: guía del profesor (preparar, publicar, día del examen y recogida).
6. `.gitignore`: `plataforma-examenes/.privado/`.
7. Parche de la skill `examenes-por-ra` (marca de tipo de respuesta) y nueva skill `preparar-examen-plataforma`.
8. Examen `DEMO` publicado para probar la plataforma (códigos y contraseña en el README).

## 9. Datos de despliegue (confirmados)

- Repo público: `alexcatesp/examenes-galileo`, con Pages publicado desde la rama `main`, carpeta raíz.
  URL: `https://alexcatesp.github.io/examenes-galileo/?e=<id>`.
- Rama de desarrollo en `iesgalileo-2026-27`: `examenes-galileo`.
- Apps Script y carpeta de Drive: cuenta de Google del profesor (`alejandrocatala@gmail.com`).
- La Action hace push al repo público con el secreto `EXAMENES_DEPLOY_TOKEN`, un PAT *fine-grained* con permiso
  `Contents: Read and write` limitado a `examenes-galileo`.
