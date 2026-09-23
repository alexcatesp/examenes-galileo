# Desplegar el receptor de entregas (Google Apps Script)

Se hace **una sola vez**, con tu cuenta de Google (alejandrocatala@gmail.com). Tarda unos 5 minutos.

1. Entra en https://script.google.com y pulsa **Nuevo proyecto**. Llámalo `Receptor exámenes Galileo`.
2. Borra el contenido de `Código.gs` y pega **todo** el contenido de [`Code.gs`](Code.gs).
3. Configura el script en **Configuración del proyecto** (icono ⚙):
   - **Zona horaria**: `(GMT+01:00) Madrid`.
   - **Propiedades del script** → *Añadir propiedad*:
     - `URL_PUBLICA` = `https://alexcatesp.github.io/examenes-galileo/`
     - `CARPETA_RAIZ` = `Examenes-Galileo` (opcional; es el nombre por defecto)
4. **Conceder permisos**: vuelve al editor, elige la función `comprobarConfiguracion` y pulsa **Ejecutar**.
   Google pedirá permisos para Drive y para conexiones externas: acéptalos.
   Aparecerá *«Google no ha verificado esta aplicación»*: pulsa *Configuración avanzada → Ir a…*. Es tu propio script.
   En el registro verás que la URL responde `200` y el enlace de la carpeta `Examenes-Galileo` en tu Drive.
5. **Implementar → Nueva implementación**:
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario** (los alumnos no inician sesión en Google).
   - Pulsa *Implementar* y copia la **URL de la aplicación web** (acaba en `/exec`).
6. Pon esa URL en `plataforma-examenes/config.json`:
   ```json
   { "urlPublica": "https://alexcatesp.github.io/examenes-galileo/",
     "receptor": "https://script.google.com/macros/s/XXXXXXXX/exec" }
   ```
   Haz commit y push (o pídeselo a Claude). La Action vuelve a publicar la app con el receptor configurado.

## Comprobar que funciona

1. Abre `https://alexcatesp.github.io/examenes-galileo/?e=DEMO` y entra con un código del examen DEMO.
   Los códigos están en el [README](../README.md#probar-la-plataforma-examen-demo).
2. Responde algo y entrega. La pantalla debe decir **«Entregado al profesor correctamente»**.
3. En tu Drive tiene que aparecer `Examenes-Galileo/DEMO/<CODIGO>.md`.

## Si cambias `Code.gs` más adelante

Ve a **Implementar → Gestionar implementaciones**, pulsa ✏ en la implementación y elige *Versión: Nueva versión*. Así la URL no cambia.
Si en su lugar creas una implementación nueva, la URL cambia y tienes que actualizar `config.json`.

## Qué valida el receptor

- El examen tiene que estar publicado en `URL_PUBLICA` y el código tiene que pertenecer a ese examen. Lo comprueba con el mismo localizador HMAC que la app, sin conocer los códigos.
- Solo guarda `.md` de hasta 2 MB.
- Si llega una entrega para un código ya entregado (porque reabriste el examen), la anterior se conserva renombrada como `<CODIGO>__<fecha>.md`.
