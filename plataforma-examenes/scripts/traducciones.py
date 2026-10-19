"""Traducciones del examen (inglés, francés, turco) para alumnado que aún no domina el español.

Las traducciones son una ayuda, no otro examen: el texto en español sigue siendo el de
referencia y el alumno puede verlo en cualquier momento. Viven en
`.privado/<ID>/traducciones/<idioma>.json` (nunca se publican en claro: `cifrar` las mete
dentro del paquete cifrado) y llevan una huella sha256 que queda en el .md del alumno, de
modo que, si hay una reclamación, se sabe exactamente qué texto tradujo ese alumno.

Formato de `<idioma>.json`:
  {"idioma": "en", "titulo": "...", "raTexto": "...",
   "partes": {"A": "..."},
   "preguntas": {"A1": {"enunciado": "...", "opciones": {"a": "...", "b": "..."}}}}
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

IDIOMAS = {"en": "inglés", "fr": "francés", "tr": "turco"}
RE_BLOQUE = re.compile(r"```[^\n]*\n(.*?)```", re.S)
RE_INLINE = re.compile(r"(?<!`)`([^`\n]+)`(?!`)")


class ErrorTraduccion(Exception):
    pass


def huella(trad: dict) -> str:
    """sha256 del texto traducido (sin el propio campo `sha256`)."""
    limpio = {k: v for k, v in trad.items() if k != "sha256"}
    canonico = json.dumps(limpio, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonico.encode("utf-8")).hexdigest()


def plantilla(examen: dict, idioma: str) -> dict:
    """Esqueleto con el texto en español, listo para traducir. Los bloques de código no se tocan."""
    if idioma not in IDIOMAS:
        raise ErrorTraduccion(f"idioma «{idioma}» no previsto ({', '.join(IDIOMAS)})")
    preguntas: dict[str, dict] = {}
    for parte in examen["partes"]:
        for q in parte["preguntas"]:
            item: dict = {"enunciado": q["enunciado"]}
            if q.get("opciones"):
                item["opciones"] = {o["letra"]: o["texto"] for o in q["opciones"]}
            preguntas[q["id"]] = item
    return {
        "idioma": idioma,
        "titulo": examen.get("titulo", ""),
        "raTexto": examen.get("raTexto", ""),
        "partes": {p["id"]: p["titulo"] for p in examen["partes"]},
        "preguntas": preguntas,
    }


def _bloques(texto: str) -> list[str]:
    return [b.strip() for b in RE_BLOQUE.findall(texto)]


def validar(examen: dict, trad: dict) -> tuple[list[str], list[str]]:
    """(errores, avisos). Los errores impiden cifrar; los avisos piden una segunda mirada."""
    errores: list[str] = []
    avisos: list[str] = []
    idioma = trad.get("idioma")
    if idioma not in IDIOMAS:
        return [f"idioma «{idioma}» no previsto ({', '.join(IDIOMAS)})"], avisos
    originales = {q["id"]: q for p in examen["partes"] for q in p["preguntas"]}
    traducidas = trad.get("preguntas", {})
    for qid in originales:
        if qid not in traducidas:
            errores.append(f"{idioma} {qid}: falta la traducción")
    for qid in traducidas:
        if qid not in originales:
            errores.append(f"{idioma} {qid}: la pregunta no existe en el examen")
    for qid, q in originales.items():
        t = traducidas.get(qid)
        if not t:
            continue
        enun = str(t.get("enunciado", "")).strip()
        if not enun:
            errores.append(f"{idioma} {qid}: enunciado vacío")
            continue
        if enun == q["enunciado"].strip() and len(enun) > 40:
            avisos.append(f"{idioma} {qid}: el enunciado está igual que el español (¿sin traducir?)")
        if _bloques(enun) != _bloques(q["enunciado"]):
            avisos.append(f"{idioma} {qid}: los bloques de código no coinciden con el original (revisa que solo cambien comentarios)")
        if sorted(RE_INLINE.findall(enun)) != sorted(RE_INLINE.findall(q["enunciado"])):
            avisos.append(f"{idioma} {qid}: el código en línea (`...`) no coincide con el original")
        letras = {o["letra"] for o in q.get("opciones", [])}
        if letras:
            ops = t.get("opciones", {})
            if set(ops) != letras:
                errores.append(f"{idioma} {qid}: las opciones deben ser exactamente {sorted(letras)}")
            elif any(not str(v).strip() for v in ops.values()):
                errores.append(f"{idioma} {qid}: hay opciones vacías")
        elif t.get("opciones"):
            errores.append(f"{idioma} {qid}: tiene opciones pero la pregunta no es de test")
    partes = {p["id"] for p in examen["partes"]}
    if set(trad.get("partes", {})) - partes:
        errores.append(f"{idioma}: partes que no existen: {sorted(set(trad['partes']) - partes)}")
    return errores, avisos


def cargar(examen: dict, carpeta: Path) -> tuple[dict[str, dict], list[str]]:
    """Lee y valida `carpeta/traducciones/*.json`. Devuelve ({idioma: traducción con sha256}, avisos)."""
    destino = carpeta / "traducciones"
    resultado: dict[str, dict] = {}
    todos_errores: list[str] = []
    todos_avisos: list[str] = []
    if not destino.exists():
        return resultado, todos_avisos
    for ruta in sorted(destino.glob("*.json")):
        trad = json.loads(ruta.read_text(encoding="utf-8"))
        if trad.get("idioma") != ruta.stem:
            todos_errores.append(f"{ruta.name}: el campo «idioma» ({trad.get('idioma')}) no coincide con el nombre del fichero")
            continue
        errores, avisos = validar(examen, trad)
        todos_errores += errores
        todos_avisos += avisos
        publico = {k: v for k, v in trad.items() if k != "idioma"}
        publico["sha256"] = huella(publico)
        resultado[ruta.stem] = publico
    if todos_errores:
        raise ErrorTraduccion("Las traducciones no son válidas:\n  " + "\n  ".join(todos_errores))
    return resultado, todos_avisos


def textos(trads: dict[str, dict]):
    """Todo el texto traducido, para pasarle el detector de fugas de soluciones."""
    for t in trads.values():
        yield t.get("titulo", "")
        yield t.get("raTexto", "")
        for q in t.get("preguntas", {}).values():
            yield q.get("enunciado", "")
            yield from (q.get("opciones") or {}).values()
