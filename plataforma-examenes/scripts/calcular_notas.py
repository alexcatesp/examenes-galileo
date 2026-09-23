#!/usr/bin/env python3
"""Convierte las notas de cada ejercicio en notas de CE y de RA, según la rúbrica.

La parte de juicio (qué merece cada respuesta) la pone quien corrige; esto solo hace
la aritmética, que es donde se cometen los errores tontos y donde un alumno puede
salir perjudicado sin que nadie se dé cuenta.

    python scripts/calcular_notas.py <carpeta-entregas> <notas.json> <calificaciones.config.json> --ra RA1

`notas.json` es `{"<CODIGO>": {"A1": 10, "B2": 6, ...}}`. Los ejercicios que no
aparezcan cuentan como 0 (en blanco es 0, no «no evaluado»).

Un ejercicio integrador admite dos formas:

    "C2": 3                        # holística: ese 3 va a todos sus CE
    "C2": {"g": 8, "h": 4, "i": 0} # subrúbrica: una nota por apartado

Se usa subrúbrica en los ítems que el examen modelo marca como aptos para ella, y
holística en el resto.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

# Peso de cada banda dentro de la nota del CE (rubrica.md §2).
BANDAS = {"Básico": 0.5, "Intermedio": 0.2, "Avanzado": 0.3}
RE_ITEM = re.compile(r"^###\s+([A-Z]?\d+)\s+·\s+(.*)$", re.M)


def leer_items(entrega: Path) -> dict[str, dict]:
    """Saca de un .md entregado qué CE y qué nivel evalúa cada ejercicio."""
    items: dict[str, dict] = {}
    texto = entrega.read_text(encoding="utf-8")
    for ident, resto in RE_ITEM.findall(texto):
        nivel = next((n for n in BANDAS if n in resto), None)
        m = re.search(r"CE ([a-zñ](?:,\s*[a-zñ])*)", resto)
        if nivel and m:
            items[ident] = {"nivel": nivel, "ce": re.findall(r"[a-zñ]", m.group(1))}
    return items


def nota_del_item(valor, ce: str) -> float:
    """La nota de un ejercicio para un CE concreto.

    Un número es puntuación **holística**: la misma nota va a todos los CE que
    evalúa el ejercicio. Un diccionario `{"g": 8, "h": 4, "i": 0}` es
    **subrúbrica**: una nota por apartado, para los integradores que el examen
    modelo marca como aptos. Lo que no aparezca cuenta 0.
    """
    if isinstance(valor, dict):
        return float(valor.get(ce, 0))
    return float(valor or 0)


def notas_de_ce(items: dict[str, dict], notas: dict[str, float]) -> dict[str, dict]:
    """Para cada CE, la media de cada banda y la nota resultante."""
    bandas: dict[str, dict[str, list[float]]] = {}
    for ident, info in items.items():
        for ce in info["ce"]:
            bandas.setdefault(ce, {b: [] for b in BANDAS})[info["nivel"]].append(
                nota_del_item(notas.get(ident, 0), ce)
            )
    resultado = {}
    for ce, por_banda in sorted(bandas.items()):
        medias = {b: (sum(v) / len(v) if v else None) for b, v in por_banda.items()}
        # Una banda que no se examina cuenta 0: no se puede aprobar lo que no se ha visto.
        nota = sum(peso * (medias[b] or 0) for b, peso in BANDAS.items())
        resultado[ce] = {"bandas": medias, "nota": round(nota, 2)}
    return resultado


def nota_del_ra(ces: dict[str, dict], pesos: dict[str, float]) -> float:
    """Media de los CE evaluados, ponderada por su peso en el RA."""
    total = sum(pesos.get(ce, 0) for ce in ces)
    if not total:
        return 0.0
    return round(sum(datos["nota"] * pesos.get(ce, 0) for ce, datos in ces.items()) / total, 1)


def puntos_por_item(items: dict[str, dict], pesos: dict[str, float]) -> dict[str, float]:
    """Cuánto aporta cada ejercicio a la nota del RA, sobre 10.

    Sale de deshacer la fórmula de la rúbrica: la nota de un CE es la suma de sus
    bandas ponderadas, y cada banda es la media de sus ejercicios. Así que un
    ejercicio aporta, por cada CE que evalúa, `peso_ce × peso_banda / nº de
    ejercicios de esa banda`. Si el examen cubre todos los CE del RA en los tres
    niveles, el total suma 10: es el reparto real de la nota, no una estimación.
    """
    cuantos: dict[tuple[str, str], int] = {}
    for info in items.values():
        for ce in info["ce"]:
            cuantos[(ce, info["nivel"])] = cuantos.get((ce, info["nivel"]), 0) + 1
    total = sum(pesos.values()) or 100
    puntos = {}
    for ident, info in items.items():
        aporta = sum(
            (pesos.get(ce, 0) / total) * BANDAS[info["nivel"]] / cuantos[(ce, info["nivel"])]
            for ce in info["ce"]
        )
        puntos[ident] = round(10 * aporta, 2)
    return puntos


def pesos_del_ra(config: dict, ra: str) -> dict[str, float]:
    for bloque in config["ra"]:
        if bloque["id"] == ra:
            return {ce["id"]: ce["peso"] for ce in bloque["ces"]}
    raise SystemExit(f"✗ {ra} no está en la configuración de calificaciones")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entregas", type=Path)
    ap.add_argument("notas", type=Path)
    ap.add_argument("config", type=Path)
    ap.add_argument("--ra", required=True)
    ap.add_argument("--salida", type=Path, help="dónde escribir resumen.csv")
    args = ap.parse_args(argv[1:])

    config = json.loads(args.config.read_text(encoding="utf-8-sig"))
    pesos = pesos_del_ra(config, args.ra)
    todas = json.loads(args.notas.read_text(encoding="utf-8"))

    filas = []
    for entrega in sorted(args.entregas.glob("*.md")):
        codigo = re.search(r"([0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4})", entrega.name)
        if not codigo:
            continue
        codigo = codigo.group(1)
        items = leer_items(entrega)
        if not items:
            print(f"⚠ {entrega.name}: no se han reconocido ejercicios", file=sys.stderr)
            continue
        ces = notas_de_ce(items, todas.get(codigo, {}))
        ra = nota_del_ra(ces, pesos)
        sin_corregir = sorted(set(items) - set(todas.get(codigo, {})))
        filas.append({"codigo": codigo, "nota_ra": ra, "ces": ces, "sin_corregir": sin_corregir})
        print(f"{codigo}  {args.ra} = {ra:>4}   " + "  ".join(f"{ce}:{d['nota']:g}" for ce, d in ces.items()))
        if sin_corregir:
            print(f"   ⚠ sin nota (cuentan 0): {', '.join(sin_corregir)}")

    if args.salida:
        args.salida.parent.mkdir(parents=True, exist_ok=True)
        ces_todos = sorted({ce for f in filas for ce in f["ces"]})
        with args.salida.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["codigo", f"nota_{args.ra}"] + [f"ce_{c}" for c in ces_todos] + ["sin_corregir"])
            for fila in filas:
                w.writerow([fila["codigo"], fila["nota_ra"]]
                           + [fila["ces"].get(c, {}).get("nota", "") for c in ces_todos]
                           + [" ".join(fila["sin_corregir"])])
        print(f"\n✓ {args.salida}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
