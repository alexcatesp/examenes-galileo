---
name: mensaje-teams-correccion
description: >
  Redacta, a partir de los informes de corrección, el mensaje que el profesor pega como
  respuesta a la entrega del alumno en Teams. Va en segunda persona del singular, explica la
  nota por criterio con lo que el alumno escribió y dice qué hacer para subirla. Se activa
  con peticiones como "genera los mensajes de Teams", "redacta la respuesta para el alumno",
  "prepara el feedback de 1DAM LMSG RA1" o similares.
---

# Skill: mensaje de Teams con la corrección

Convierte un informe de corrección (técnico, para el profesor) en un mensaje que se le pueda
soltar tal cual a un alumno de 17 años sin que se hunda ni se confíe.

## Reglas inviolables

1. **Segunda persona del singular**, siempre: «has identificado», «te ha faltado». Nunca «el
   alumno» ni «se observa».
2. **Listo para pegar.** Nada de encabezados tipo «Informe de corrección», ni notas para el
   profesor, ni marcadores por rellenar. El profesor copia y pega.
3. **Sin nombres.** Si el mensaje va a la entrega de Teams, el alumno ya sabe quién es. No se
   incluye el nombre (ni siquiera si aparece en el `codigos.csv`) ni el código.
4. **Nada de comparaciones** con la clase ni con otros compañeros. La media del grupo no es
   asunto suyo.
5. **Cada afirmación, anclada a su examen.** «Te ha faltado explicar qué haría el parser»,
   no «has estado flojo en XML». Si no puedes citar la evidencia, no lo digas.

## Tono

Directo y respetuoso, como quien corrige delante del alumno: reconoce lo que está bien sin
paternalismo, dice lo que falta sin adornos y termina con algo accionable. Ni «¡enhorabuena,
crack!» ni «deberías replantearte el módulo».

Adapta el arranque a la nota, pero **sin mentir**:

| Nota | Cómo se abre |
|---|---|
| 9–10 | Reconoce el nivel avanzado y propón por dónde seguir. |
| 7–8,9 | Reconoce que aplicas y analizas bien; señala qué falta para el avanzado. |
| 5–6,9 | Has superado el criterio. Concreta qué separa el aprobado del notable. |
| 3–4,9 | Sin rodeos: no llega. Di exactamente los dos o tres puntos a recuperar. |
| 0–2,9 | Claro y sin dramatizar. Céntrate en lo básico y en la recuperación. |

## Estructura

```markdown
Tu nota de este examen (RA1 — Lenguajes de marcas) es **7,4**.

**Lo que has hecho bien.** Identificas sin problema la estructura de un documento XML y
distingues bien «bien formado» de «válido»: en el ejercicio B2 detectaste el error de
anidamiento a la primera.

**Lo que te ha faltado.** En ese mismo ejercicio no explicaste qué haría un parser con el
documento original, que era la otra mitad de la pregunta. Y en el C2, los espacios de nombres
están declarados pero no los usas para resolver la colisión de `<cantidad>`.

**Para la próxima.** Cuando una pregunta tenga apartados (a), (b), (c), respóndelos por
separado y numerados: en dos ejercicios has contestado solo a una parte y has perdido puntos
que sabías.

Si no ves algo o no estás de acuerdo con la corrección, dímelo en clase y lo revisamos.
```

Longitud: entre 120 y 250 palabras. Más largo no se lee.

## Proceso

1. Lee los informes de `plataforma-examenes/.privado/correcciones/<ID-EXAMEN>/`.
2. Por cada uno, escribe el mensaje. Si el profesor pide también la nota final del módulo,
   pondera los RA con los pesos de `calificaciones.config.json` y dilo en una línea aparte.
3. Guárdalos en `.privado/correcciones/<ID-EXAMEN>/mensajes/<CODIGO>.md`.
4. Entrega al profesor la lista de códigos con su mensaje, para que los vaya pegando cruzando
   con `codigos.csv`. **Ese cruce lo hace él, no la IA.**

## Qué no hacer

- Prometer una nota que no está en el informe.
- Inventar un plan de recuperación que el profesor no ha anunciado.
- Sugerir que el alumno ha copiado. Eso se habla en persona, nunca por escrito en Teams.
