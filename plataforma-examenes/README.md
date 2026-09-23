# Plataforma de exámenes — notas técnicas

> **¿Buscas cómo usarla?** Está en la [**guía del profesor**](GUIA-PROFESOR.md), que es la que
> se publica para compartir con otros docentes. Este fichero es el detalle técnico.

Examen online anónimo para cualquier módulo y RA:

- Las preguntas salen de un `examen-modelo-RAx.md` y el examen **no lleva soluciones**.
- Cada alumno entra con un **código de acceso** y ese código es lo único que lo identifica.
- El examen se **bloquea** si el alumno sale de la pantalla completa o cambia de ventana. Para desbloquearlo hace falta la contraseña del profesor.
- Al entregar se genera un `.md` (código + preguntas + respuestas) que va a Google Drive y también se descarga para subirlo a Teams.

URL del alumnado: `https://alexcatesp.github.io/examenes-galileo/?e=<ID>`

La especificación completa está en [`ESPECIFICACION.md`](ESPECIFICACION.md).

## Estructura

| Ruta | Qué es | ¿Se publica? |
|---|---|---|
| `app/` | La app web (Vite + React + TypeScript) | Sí, compilada |
| `scripts/preparar_examen.py` | Extrae, cifra y genera los códigos | No |
| `examenes/<ID>.json` | Paquetes **cifrados** | Sí |
| `config.json` | URL pública y URL del receptor de entregas | Sí |
| `apps-script/` | Receptor de entregas en Google Drive + [guía de despliegue](apps-script/DESPLIEGUE.md) | No (se pega en Apps Script) |
| `.privado/` | Examen en claro, códigos, contraseña. **Está en `.gitignore`** | **Nunca** |

## Preparar un examen

Requisitos una sola vez: `pip install -r scripts/requirements.txt`.

Los comandos se ejecutan desde `plataforma-examenes/`. También puedes pedírselo a Claude («prepara el examen del RA1 de lenguajes de marcas para la plataforma»), que usa la skill `preparar-examen-plataforma`.

1. **Extraer** la versión del alumno:
   ```bash
   python scripts/preparar_examen.py extraer \
     ../modulos/DAM/0373-lenguajes-de-marcas/examenes/examen-modelo-RA1.md \
     --id DAM-0373-RA1 --duracion 75
   ```
   Imprime una tabla con cada pregunta (nivel, CE y tipo de respuesta) y los avisos que haya.
   Se añaden solos el grupo (`1DAM`, de curso + ciclo), las siglas del módulo (de `siglas.json`),
   el curso escolar y la convocatoria. Se pueden forzar con `--grupo`, `--siglas`,
   `--curso-escolar` y `--convocatoria`.
2. **Revisar** `.privado/DAM-0373-RA1/examen.json`. Puedes cambiar un enunciado o el `tipo` de una pregunta:
   `unica`, `multiple`, `texto` o `codigo`. Si es `codigo`, indica también el `lenguaje`: html, css, javascript, typescript, json, xml, sql, java, python, php, yaml, markdown, shell o texto.
3. **Cifrar y generar los códigos** (pon los alumnos que tengas más unos cuantos de reserva):
   ```bash
   python scripts/preparar_examen.py cifrar DAM-0373-RA1 --codigos 30
   ```
   - Se niega a cifrar si detecta restos de soluciones (`Solución:`, `**10** =`, `→ **b**`…).
   - Genera `examenes/DAM-0373-RA1.json`, `.privado/DAM-0373-RA1/codigos.csv` y `.privado/DAM-0373-RA1/ficha-profesor.md`. La ficha incluye la URL y la **contraseña de desbloqueo**.
4. **Comprobar** que un código abre el examen:
   `python scripts/preparar_examen.py verificar DAM-0373-RA1 K7FM-2QXR-9TPA`
5. **Publicar**: haz commit y push de `examenes/DAM-0373-RA1.json`. La GitHub Action *Publicar plataforma de exámenes* lo despliega en un par de minutos.

> Si vuelves a cifrar un examen ya publicado, se generan códigos nuevos y **dejan de valer los que hayas repartido**. Por eso el script pide `--regenerar`.
> Para retirar un examen, borra su `examenes/<ID>.json` y haz push.

## El día del examen

1. Proyecta o dicta la URL. Abre `codigos.html`, imprímelo a una cara (Ctrl+P), recorta las papeletas y reparte una a cada alumno. Cada papeleta lleva el grupo, la URL y el código.
   El alumno escribe su nombre **por detrás** y te devuelve el papel al terminar: ese papel es el único vínculo entre código y persona, y lo tienes tú. En casa pasas los nombres a `codigos.csv`.
2. El alumno teclea el código. Los guiones y las mayúsculas dan igual, y la app detecta al momento si se ha equivocado al teclearlo.
   Lee las normas y pulsa **Empezar**: el examen pasa a pantalla completa y arranca la cuenta atrás.
3. **Bloqueos**: si sale de la pantalla completa, cambia de ventana o de pestaña, aparece la pantalla de bloqueo. Acércate y teclea la contraseña; el reloj no se para mientras tanto.
4. **Se cuelga el PC o se cierra el navegador**: el alumno vuelve a entrar con su código, **incluso en otro puesto**, y tú tecleas la contraseña para reanudar. Recupera sus respuestas del autoguardado de Drive (como mucho pierde el último minuto). El reloj no se para.
5. **Entrega**: con el botón *Entregar examen*, o automáticamente cuando se acaba el tiempo.
   - Al alumno solo se le dice que **suba el fichero a Teams**; la copia a Drive no se menciona. Así no cree que ya ha terminado y se salte Teams, y tenemos el examen por duplicado.
   - Una vez entregado, el código queda cerrado, también en otro equipo. Solo tú puedes reabrirlo (*Reabrir (profesor)*), y solo si queda tiempo.

### El reloj

La hora de inicio la fija el receptor, no el equipo del alumno, y se resincroniza con cada
autoguardado. Cambiar la hora del PC no regala tiempo. Si el receptor no responde, el examen
sigue con el reloj local: más vale un cronómetro imperfecto que un alumno sin examen.

## Dónde llegan las entregas

```
Examenes-Galileo/2026-27/1DAM/LMSG/RA1/ev_continua/1DAM_LMSG_RA1_K7FM-2QXR-9TPA.md
                 └ curso  └ grupo └ módulo └ RA └ convocatoria
```

La convocatoria es `ev_continua`, `1a_final` o `2a_final`, y se elige al preparar el examen
(`--convocatoria`). En las finales también entra en el nombre del fichero.

Esos datos viajan en el bloque `meta` del paquete, **sin cifrar**: así el receptor decide la
ruta por sí mismo y no se fía de lo que le mande el navegador. No revelan nada que no esté ya
en la URL del examen.

## Corregir

- Las entregas solo llevan el código, nunca el nombre.
- Descarga la carpeta y pásala a la skill `corregir-examen` junto con el examen modelo y la
  rúbrica del módulo. **No le pases `codigos.csv`.**
- Con las notas ya puestas, usa `codigos.csv` (o las papeletas) para saber de quién es cada código.
- Si se reabrió una entrega, la versión anterior se conserva como `…__<fecha>.md`.
- Los originales se quedan en Drive: son tu copia de seguridad y la evidencia de evaluación.

## Probar la plataforma: examen DEMO

`examenes/DEMO.json` es un examen de prueba de 15 minutos.

- URL: `https://alexcatesp.github.io/examenes-galileo/?e=DEMO`
- Contraseña del profesor: `demo-profe`
- Códigos de prueba: `5TY3-REQ7-SZ63`, `D5XF-MGCS-TMX8`, `DBD3-GKCB-MS89`, `YCB1-D6PW-H8T4`, `ZX4G-XQRN-9Y1X`

Para probarlo:
1. Entra con un **código** (no con la contraseña) y pulsa *Empezar*.
2. Pulsa Esc o cambia de ventana: aparece la pantalla de bloqueo y ahí es donde se escribe `demo-profe`.

La contraseña no distingue mayúsculas de minúsculas. Cada código se cierra al entregar. Para seguir probando, usa otro código o borra los datos del sitio en el navegador (y la entrega en Drive).

## Desarrollo

```bash
cd app && npm install
npm run dev        # http://localhost:5173/?e=DEMO  (sirve ../examenes y ../config.json)
npm test           # tests de cifrado (compatibles con Python), barajado y .md
npm run build      # dist/ con la app, config.json y examenes/
cd ../scripts && python -m pytest -q tests
```

Si cambias el formato de los códigos, el localizador, el cifrado o el bloque `meta`, tienes que
cambiar a la vez `scripts/cripto.py`, `app/src/lib/cripto.ts` y `apps-script/Code.gs`, regenerar
la fixture compartida con `python scripts/generar_fixture.py` y **volver a desplegar el Apps
Script** (Implementar → Gestionar implementaciones → ✏ → Versión: Nueva versión).

## Límites conocidos

- El editor de código **no ayuda a escribir bien**, y es a propósito: resalta la sintaxis, pero no autocompleta, no cierra etiquetas, no marca los paréntesis que no casan, no reindenta solo y no pinta de rojo los errores. Si un alumno deja una etiqueta sin cerrar, tiene que darse cuenta él.
- Nada impide fotografiar la pantalla con el móvil ni usar un segundo dispositivo. El bloqueo disuade, pero la vigilancia en el aula sigue siendo necesaria.
- Un alumno puede pasar su código a otro que no esté en el aula. Reparte los códigos en mano al empezar.
- Si un alumno escribe su nombre dentro de una respuesta, ese nombre llega a la IA. La app avisa de que no lo haga en las instrucciones y en la cabecera del examen.
- Solo está probada con Chrome y Edge de escritorio.
