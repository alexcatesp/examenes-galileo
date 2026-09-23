#!/usr/bin/env python3
"""Última barrera antes de publicar: comprueba que en `dist/` no va nada en claro.

Lo que se sube a GitHub Pages lo puede leer cualquiera, así que aquí se verifica
que los paquetes solo llevan las claves esperadas (el examen va cifrado en
`datos`) y que no se ha colado ningún fichero privado en el sitio.

    python scripts/validar_publicacion.py app/dist
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

CLAVES = {"version", "id", "sal", "iter", "entradas", "iv", "datos"}
CLAVES_META = {"ra", "grupo", "siglas", "cursoEscolar", "convocatoria"}
# Nombres que solo existen en .privado/ y que jamás deben acabar publicados.
PROHIBIDOS = ("codigos.csv", "codigos.html", "ficha-profesor.md", "examen.json", "notas.json")
# Carpetas que no pueden aparecer en el sitio publicado bajo ningún concepto.
# `fixtures` son exámenes modelo reales CON SUS SOLUCIONES, guardados para probar el
# extractor: publicarlos sería regalarle a los alumnos el examen y su corrección.
CARPETAS_PROHIBIDAS = (".privado", "correcciones", "entregas", "fixtures")


def validar_paquete(ruta: Path) -> list[str]:
    fallos: list[str] = []
    try:
        d = json.loads(ruta.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        return [f"{ruta.name}: no es JSON válido ({exc})"]

    if not isinstance(d, dict):
        return [f"{ruta.name}: el paquete debería ser un objeto"]
    if faltan := CLAVES - set(d):
        fallos.append(f"{ruta.name}: le faltan claves {sorted(faltan)}")
    if sobran := set(d) - CLAVES - {"meta"}:
        fallos.append(f"{ruta.name}: claves inesperadas {sorted(sobran)} (¿examen en claro?)")
    if sobran_meta := set(d.get("meta", {})) - CLAVES_META:
        fallos.append(f"{ruta.name}: «meta» lleva datos de más {sorted(sobran_meta)}")
    if not d.get("entradas"):
        fallos.append(f"{ruta.name}: sin códigos, nadie podría abrirlo")
    # Si el examen se hubiera guardado sin cifrar, se leería en el propio JSON.
    crudo = ruta.read_text(encoding="utf-8")
    for pista in ("enunciado", "opciones", "desbloqueo", "partes"):
        if f'"{pista}"' in crudo:
            fallos.append(f"{ruta.name}: aparece «{pista}» sin cifrar")
    return fallos


def validar(dist: Path) -> list[str]:
    fallos: list[str] = []
    for prohibido in PROHIBIDOS:
        for encontrado in dist.rglob(prohibido):
            fallos.append(f"fichero privado en el sitio publicado: {encontrado.relative_to(dist)}")
    for carpeta in CARPETAS_PROHIBIDAS:
        for encontrado in dist.rglob(carpeta):
            if encontrado.is_dir():
                fallos.append(f"carpeta privada en el sitio publicado: {encontrado.relative_to(dist)}")
    # El config.json publicado es el del autor: su receptor no puede viajar en el código
    # que otros clonan, o las entregas de sus alumnos acabarían en el Drive de otro.
    fuente = dist / "plataforma-examenes" / "config.json"
    if fuente.exists():
        fallos.append("plataforma-examenes/config.json: publica config.example.json, no el tuyo")
    paquetes = sorted((dist / "examenes").glob("*.json")) if (dist / "examenes").exists() else []
    for paquete in paquetes:
        fallos += validar_paquete(paquete)
    if not fallos:
        print(f"✓ {len(paquetes)} paquete(s) listos para publicar, nada en claro")
    return fallos


def main(argv: list[str]) -> int:
    dist = Path(argv[1] if len(argv) > 1 else "app/dist")
    if not dist.exists():
        print(f"✗ no existe {dist}", file=sys.stderr)
        return 1
    fallos = validar(dist)
    for f in fallos:
        print(f"✗ {f}", file=sys.stderr)
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
