#!/usr/bin/env python3
"""Regenera app/src/lib/__tests__/paquete-python.json.

Esa fixture es un paquete cifrado **por Python** que los tests de la app abren
**en el navegador**: es lo que garantiza que los tres lados (scripts/cripto.py,
app/src/lib/cripto.ts y apps-script/Code.gs) siguen hablando el mismo idioma.

Ejecútalo cada vez que toques el formato de los códigos, el localizador, la
derivación de claves o el bloque `meta`:

    python scripts/generar_fixture.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import cripto  # noqa: E402

DESTINO = Path(__file__).resolve().parent.parent / "app/src/lib/__tests__/paquete-python.json"
CONTRASENA = "profe123"
META = {"ra": "RA1", "grupo": "1DAM", "siglas": "LMSG", "cursoEscolar": "2026-27", "convocatoria": "ev_continua"}

EXAMEN = {
    "id": "COMPAT-RA1",
    "titulo": "Examen RA1",
    "ciclo": "DAM",
    "curso": "1",
    "modulo": "Lenguajes de marcas (0373)",
    "codigoModulo": "0373",
    "raTexto": "Reconoce las características de lenguajes de marcas.",
    "duracion": 30,
    **META,
    "partes": [
        {
            "id": "A",
            "titulo": "Parte A — Básico",
            "preguntas": [
                {"id": "A1", "item": None, "nivel": "Básico", "ce": ["a"], "tipo": "unica", "lenguaje": None,
                 "enunciado": "¿Qué es **XML**?",
                 "opciones": [{"letra": "a", "texto": "Un lenguaje"}, {"letra": "b", "texto": "Una BD"},
                              {"letra": "c", "texto": "Un SO"}]},
                {"id": "A2", "item": None, "nivel": "Básico", "ce": ["b"], "tipo": "multiple", "lenguaje": None,
                 "enunciado": "Marca todas las correctas",
                 "opciones": [{"letra": "a", "texto": "x"}, {"letra": "b", "texto": "y"}]},
            ],
        },
        {
            "id": "B",
            "titulo": "Parte B — Intermedio",
            "preguntas": [
                {"id": "B1", "item": "RA1-INT-I-01", "nivel": "Intermedio", "ce": ["c", "d"], "tipo": "codigo",
                 "lenguaje": "xml", "enunciado": "Escribe un XML", "opciones": []},
                {"id": "B2", "item": None, "nivel": "Intermedio", "ce": ["e"], "tipo": "texto", "lenguaje": None,
                 "enunciado": "Explica ñandú", "opciones": []},
            ],
        },
    ],
}


def main() -> int:
    examen = {**EXAMEN, "desbloqueo": cripto.hash_desbloqueo(CONTRASENA), "generado": "2026-09-23"}
    codigos = cripto.generar_codigos(3)
    paquete = cripto.cifrar_paquete(examen, codigos, iter_codigo=1000, meta=META)
    assert cripto.descifrar_paquete(paquete, codigos[0]) == examen, "el paquete no se abre con su propio código"
    DESTINO.write_text(
        json.dumps({"paquete": paquete, "codigos": codigos, "contrasena": CONTRASENA, "examen": examen},
                   ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    print(f"✓ {DESTINO.name}: {len(codigos)} códigos, meta {paquete['meta']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
