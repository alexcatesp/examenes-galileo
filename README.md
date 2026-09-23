# Exámenes IES Galileo

Plataforma de exámenes en el navegador: **anónima** (cada examen se identifica con un código,
nunca con el nombre del alumno), se **bloquea** si el alumno sale de la pantalla completa o
cambia de ventana, y devuelve al profesor un fichero de texto por alumno listo para corregir.

Hecha para dar clase en un instituto: sin servidores que mantener, sin cuentas para el
alumnado y sin coste.

## 📖 [Guía del profesor](GUIA-PROFESOR.md)

Qué hace, cómo es el día del examen, qué formato debe tener el examen que se carga y cómo
montarla desde cero en tu propia cuenta.

## Pruébala

**https://alexcatesp.github.io/examenes-galileo/?e=DEMO**

Entra con uno de los códigos de la guía y haz el examen de demostración. Pulsa Esc a mitad
para ver el bloqueo: se desbloquea con `demo-profe`.

## Llévatela

El código completo está en [`plataforma-examenes/`](plataforma-examenes/): la aplicación
(Vite + React + TypeScript), los scripts de preparación y cifrado en Python, y el receptor de
entregas para Google Apps Script. Clónalo, móntalo en tu cuenta y úsalo con tus módulos:

```bash
git clone https://github.com/alexcatesp/examenes-galileo.git
cd examenes-galileo/plataforma-examenes
cp config.example.json config.json   # y rellénalo con lo tuyo
pip install -r scripts/requirements.txt
```

El montaje paso a paso está en el apartado 5 de la guía. Las dos ayudas para corregir con
Claude Code van en [`skills/`](skills/).

> **Antes de nada, edita `config.json`.** Si dejas el receptor de otro, las entregas de tus
> alumnos acabarán en el Drive de otra persona.

## Licencia

Copyright © 2026 Alejandro Catalá Espí (IES Galileo).

Este programa es software libre: puedes redistribuirlo y modificarlo bajo los términos de la
**Licencia Pública General de GNU, versión 3** publicada por la Free Software Foundation.

Se distribuye con la esperanza de que sea útil, pero **SIN NINGUNA GARANTÍA**, ni siquiera la
garantía implícita de comerciabilidad o idoneidad para un propósito particular. Consulta la
[Licencia Pública General de GNU](plataforma-examenes/LICENSE) para más detalles.

---

La carpeta raíz de este repositorio (la aplicación compilada y los exámenes **cifrados**) **se
genera automáticamente**. Cada examen se abre únicamente con un código de acceso que el
profesor reparte en el aula: los enunciados en claro, los códigos y las contraseñas no salen
del ordenador del profesor.
