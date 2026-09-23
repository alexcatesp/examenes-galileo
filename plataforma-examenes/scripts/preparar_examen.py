#!/usr/bin/env python3
"""Prepara un examen para la plataforma: extrae, revisa, cifra y genera los códigos.

Flujo:
  1. extraer  examen-modelo-RAx.md  → .privado/<ID>/examen.json  (versión alumno, editable)
  2. (revisar/editar examen.json: tipos de respuesta, enunciados)
  3. cifrar   <ID>                  → examenes/<ID>.json (público, cifrado)
                                     + .privado/<ID>/codigos.csv y ficha-profesor.md
  4. verificar <ID> <CODIGO>        → comprueba que un código abre el paquete

Todo lo que hay en .privado/ está en .gitignore: NUNCA se sube ni se pasa a la IA.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import date
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import calcular_notas  # noqa: E402
import cripto  # noqa: E402
from extractor import LENGUAJES, NIVELES, TIPOS, extraer, fugas  # noqa: E402

BASE = Path(__file__).resolve().parent.parent
PRIVADO = BASE / ".privado"
PUBLICADOS = BASE / "examenes"
CONFIG = BASE / "config.json"
SIGLAS = BASE / "siglas.json"
RE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{2,60}$")
# Lo que acaba en un nombre de fichero o de carpeta: sin espacios ni acentos.
RE_SEGURO = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
CONVOCATORIAS = ("ev_continua", "1a_final", "2a_final")
CAMPOS_META = ("grupo", "siglas", "cursoEscolar", "convocatoria")


class ErrorExamen(Exception):
    pass


def cargar_config() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8")) if CONFIG.exists() else {}


def cargar_siglas() -> dict:
    if not SIGLAS.exists():
        return {}
    datos = json.loads(SIGLAS.read_text(encoding="utf-8"))
    return {k: v for k, v in datos.items() if not k.startswith("_")}


def id_por_defecto(examen: dict) -> str:
    partes = [examen.get("ciclo"), examen.get("codigoModulo"), examen.get("ra")]
    return "-".join(p for p in partes if p) or "EXAMEN"


def curso_escolar(hoy: date | None = None) -> str:
    """El curso va de septiembre a agosto: 23-09-2026 → «2026-27»."""
    hoy = hoy or date.today()
    inicio = hoy.year if hoy.month >= 9 else hoy.year - 1
    return f"{inicio}-{str(inicio + 1)[2:]}"


def grupo_por_defecto(examen: dict) -> str:
    """Curso + ciclo: «1DAM», «2DAW»."""
    return f"{examen.get('curso', '')}{examen.get('ciclo', '')}".strip()


def meta_publica(examen: dict) -> dict:
    """Datos con los que se nombran fichero y carpetas. Viajan sin cifrar."""
    return {"ra": examen.get("ra", ""), **{c: examen.get(c, "") for c in CAMPOS_META}}


def nombre_entrega(meta: dict, codigo: str) -> str:
    partes = [meta["grupo"], meta["siglas"], meta["ra"]]
    if meta.get("convocatoria") and meta["convocatoria"] != "ev_continua":
        partes.append(meta["convocatoria"])
    return "_".join(partes + [codigo]) + ".md"


def carpeta_drive(meta: dict) -> str:
    return "/".join([meta["cursoEscolar"], meta["grupo"], meta["siglas"], meta["ra"], meta["convocatoria"]])


def poner_puntos(examen: dict, config_pesos: Path) -> list[str]:
    """Escribe en cada pregunta lo que aporta a la nota del RA, para que el alumno lo vea.

    Sin esto, la pregunta «¿cuánto vale esta?» no tiene respuesta que dar en clase.
    """
    avisos: list[str] = []
    config = json.loads(config_pesos.read_text(encoding="utf-8-sig"))
    try:
        pesos = calcular_notas.pesos_del_ra(config, examen["ra"])
    except SystemExit as exc:
        return [str(exc)]
    items = {
        q["id"]: {"nivel": q["nivel"], "ce": q["ce"]}
        for parte in examen["partes"] for q in parte["preguntas"]
        if q.get("nivel") in calcular_notas.BANDAS and q.get("ce")
    }
    sin_datos = [q["id"] for p in examen["partes"] for q in p["preguntas"] if q["id"] not in items]
    if sin_datos:
        avisos.append(f"sin nivel o sin CE, se quedan sin puntos: {', '.join(sin_datos)}")
    puntos = calcular_notas.puntos_por_item(items, pesos)
    for parte in examen["partes"]:
        for q in parte["preguntas"]:
            q["puntos"] = puntos.get(q["id"])
    total = round(sum(puntos.values()), 2)
    if abs(total - 10) > 0.05:
        avisos.append(
            f"los puntos suman {total:g} en vez de 10: el examen no cubre todos los CE del "
            f"{examen['ra']} en los tres niveles, así que el máximo alcanzable es {total:g}"
        )
    return avisos


def validar(examen: dict) -> list[str]:
    """Errores que impiden cifrar (estructura). Las fugas se comprueban aparte."""
    errores: list[str] = []
    if not RE_ID.match(str(examen.get("id", ""))):
        errores.append("id: solo letras, números, - y _ (3-61 caracteres)")
    duracion = examen.get("duracion")
    if not isinstance(duracion, int) or not 5 <= duracion <= 600:
        errores.append("duracion: minutos enteros entre 5 y 600 (usa --duracion)")
    for campo in ("ra", *CAMPOS_META):
        valor = str(examen.get(campo, ""))
        if not RE_SEGURO.match(valor):
            errores.append(f"{campo}: «{valor}» no vale para un nombre de fichero (solo letras, números, - y _)")
    if examen.get("convocatoria") not in CONVOCATORIAS:
        errores.append(f"convocatoria: debe ser una de {', '.join(CONVOCATORIAS)}")
    if not examen.get("partes"):
        errores.append("el examen no tiene partes")
    vistos: set[str] = set()
    for parte in examen.get("partes", []):
        if not parte.get("preguntas"):
            errores.append(f"parte {parte.get('id')}: sin preguntas")
        for q in parte.get("preguntas", []):
            qid = q.get("id", "?")
            if qid in vistos:
                errores.append(f"{qid}: id repetido")
            vistos.add(qid)
            if q.get("tipo") not in TIPOS:
                errores.append(f"{qid}: tipo «{q.get('tipo')}» no válido ({', '.join(TIPOS)})")
            if not str(q.get("enunciado", "")).strip():
                errores.append(f"{qid}: enunciado vacío")
            if q.get("nivel") and q["nivel"] not in NIVELES:
                errores.append(f"{qid}: nivel «{q['nivel']}» no válido")
            if q.get("tipo") == "codigo" and q.get("lenguaje") not in LENGUAJES:
                errores.append(f"{qid}: lenguaje «{q.get('lenguaje')}» no válido ({', '.join(LENGUAJES)})")
            if q.get("tipo") in ("unica", "multiple"):
                letras = [o.get("letra") for o in q.get("opciones", [])]
                if len(letras) < 2 or len(set(letras)) != len(letras):
                    errores.append(f"{qid}: un test necesita ≥2 opciones con letras distintas")
            elif q.get("opciones"):
                errores.append(f"{qid}: tiene opciones pero su tipo es «{q.get('tipo')}»")
    return errores


def tabla_revision(examen: dict) -> str:
    filas = ["ID    Nivel       CE          Tipo                Puntos  Origen    Enunciado"]
    for parte in examen["partes"]:
        puntos_parte = sum(q.get("puntos") or 0 for q in parte["preguntas"])
        cabecera = f"── {parte['titulo']}"
        if puntos_parte:
            cabecera += f"   [{puntos_parte:.2f} pts]"
        filas.append(cabecera)
        for q in parte["preguntas"]:
            tipo = q["tipo"] + (f"({q['lenguaje']})" if q.get("lenguaje") else "")
            if q.get("opciones"):
                tipo += f" {len(q['opciones'])} opc"
            resumen = re.sub(r"\s+", " ", q["enunciado"])[:42]
            puntos = f"{q['puntos']:.2f}" if q.get("puntos") else "-"
            filas.append(
                f"{q['id']:<5} {str(q.get('nivel') or '-'):<11} {','.join(q.get('ce') or ['-']):<11} "
                f"{tipo:<19} {puntos:<7} {q.get('_origenTipo', 'json'):<9} {resumen}"
            )
    return "\n".join(filas)


def cmd_extraer(args: argparse.Namespace) -> int:
    modelo = Path(args.modelo)
    examen, avisos = extraer(modelo.read_text(encoding="utf-8"), modelo)
    examen = {"id": args.id or id_por_defecto(examen), **examen}
    if args.duracion:
        examen["duracion"] = args.duracion
    examen["titulo"] = args.titulo or f"Examen {examen['ra']}".strip()
    examen["grupo"] = args.grupo or grupo_por_defecto(examen)
    examen["siglas"] = args.siglas or cargar_siglas().get(examen.get("codigoModulo", ""), "")
    examen["cursoEscolar"] = args.curso_escolar or curso_escolar()
    examen["convocatoria"] = args.convocatoria
    if not examen["siglas"]:
        avisos.append(
            f"no hay siglas para el módulo {examen.get('codigoModulo') or '?'}: "
            f"añádelas a siglas.json o pasa --siglas"
        )
    pesos = args.pesos or (modelo.parent / "calificaciones.config.json")
    if pesos.exists():
        avisos += poner_puntos(examen, pesos)
    else:
        avisos.append(f"sin {pesos.name} al lado del examen: las preguntas no llevarán puntos (usa --pesos)")
    destino = PRIVADO / examen["id"] / "examen.json"
    if destino.exists() and not args.sobrescribir:
        raise ErrorExamen(f"{destino} ya existe (usa --sobrescribir para rehacerlo)")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(examen, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(tabla_revision(examen))
    print(f"\nPreguntas: {sum(len(p['preguntas']) for p in examen['partes'])} · "
          f"duración: {examen.get('duracion') or '¿?'} min · id: {examen['id']}")
    if examen["siglas"]:
        meta = meta_publica(examen)
        print(f"Entregas: {carpeta_drive(meta)}/{nombre_entrega(meta, '<CÓDIGO>')}")
    for aviso in avisos:
        print(f"⚠ {aviso}")
    for error in validar(examen):
        print(f"✗ {error}")
    print(f"\nRevisa y edita {destino.relative_to(BASE)} (tipo: unica|multiple|texto|codigo, "
          f"lenguaje: {'|'.join(LENGUAJES)}).")
    print(f"Después: python scripts/preparar_examen.py cifrar {examen['id']} --codigos N")
    return 0


def _examen_limpio(examen: dict) -> dict:
    """Copia sin claves internas (_origenTipo...) lista para cifrar."""
    limpio = {k: v for k, v in examen.items() if not k.startswith("_")}
    limpio["partes"] = [
        {**{k: v for k, v in p.items() if not k.startswith("_")},
         "preguntas": [{k: v for k, v in q.items() if not k.startswith("_")} for q in p["preguntas"]]}
        for p in examen["partes"]
    ]
    return limpio


def cmd_cifrar(args: argparse.Namespace) -> int:
    origen = Path(args.examen) if args.examen.endswith(".json") else PRIVADO / args.examen / "examen.json"
    examen = json.loads(origen.read_text(encoding="utf-8"))
    if args.duracion:
        examen["duracion"] = args.duracion
    errores = validar(examen)
    if errores:
        raise ErrorExamen("El examen no es válido:\n  " + "\n  ".join(errores))
    encontradas = fugas(examen)
    if encontradas:
        raise ErrorExamen(
            "Posible solución dentro del examen. Corrígelo en examen.json antes de cifrar:\n  "
            + "\n  ".join(encontradas)
        )
    ident = examen["id"]
    paquete_ruta = PUBLICADOS / f"{ident}.json"
    carpeta = PRIVADO / ident
    if paquete_ruta.exists() and not args.regenerar:
        raise ErrorExamen(
            f"{paquete_ruta.name} ya existe. Regenerarlo invalida TODOS los códigos repartidos; "
            "si es lo que quieres, usa --regenerar."
        )
    if args.codigos < 1 or args.codigos > 500:
        raise ErrorExamen("--codigos debe estar entre 1 y 500")

    config = cargar_config()
    contrasena = args.contrasena or cripto.generar_contrasena()
    codigos = cripto.generar_codigos(args.codigos)
    final = _examen_limpio(examen)
    final["desbloqueo"] = cripto.hash_desbloqueo(contrasena)
    final["generado"] = date.today().isoformat()
    meta = meta_publica(examen)
    paquete = cripto.cifrar_paquete(final, codigos, iter_codigo=args.iter, meta=meta)

    # Verificación de ida y vuelta antes de escribir nada.
    if cripto.descifrar_paquete(paquete, codigos[0])["id"] != ident:
        raise ErrorExamen("La verificación del paquete ha fallado")

    PUBLICADOS.mkdir(parents=True, exist_ok=True)
    carpeta.mkdir(parents=True, exist_ok=True)
    paquete_ruta.write_text(json.dumps(paquete, separators=(",", ":")) + "\n", encoding="utf-8")
    with (carpeta / "codigos.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["codigo", "alumno"])
        for c in codigos:
            w.writerow([c, ""])
    url = config.get("urlPublica", "https://<usuario>.github.io/<repo>/").rstrip("/") + f"/?e={ident}"
    receptor = config.get("receptor") or "(sin configurar: solo habrá descarga local)"
    (carpeta / "codigos.html").write_text(hoja_codigos(final, meta, codigos, url), encoding="utf-8")
    ficha = f"""# Ficha del profesor — {ident}

> Documento privado. No lo subas al repo ni lo compartas con la IA.

| | |
|---|---|
| Examen | {final.get('titulo', ident)} |
| Grupo y módulo | {meta['grupo']} · {meta['siglas']} · {meta['ra']} · {meta['convocatoria']} |
| URL para el alumnado | {url} |
| Contraseña de desbloqueo / reanudación | **`{contrasena}`** |
| Duración | {final['duracion']} min |
| Códigos generados | {len(codigos)} (en `codigos.csv` y `codigos.html`) |
| Receptor de entregas | {receptor} |
| Generado | {final['generado']} |

## El día del examen
1. Imprime `codigos.html` (ábrelo y Ctrl+P), recorta las papeletas y reparte una a cada alumno.
2. El alumno escribe su nombre **por detrás** de su papeleta y te la devuelve al entregar.
3. Si una pantalla se bloquea (salida de foco o de pantalla completa), acércate y teclea la contraseña.
4. En casa, pasa los nombres de las papeletas a `codigos.csv`.

## Dónde llegan las entregas
`{carpeta_drive(meta)}/{nombre_entrega(meta, '<CÓDIGO>')}`

Los ficheros solo llevan el código, nunca el nombre: se pueden corregir con IA sin exponer
a nadie. El `codigos.csv` **no** se le pasa a la IA.
"""
    (carpeta / "ficha-profesor.md").write_text(ficha, encoding="utf-8")

    print(f"✓ Paquete cifrado: {paquete_ruta.relative_to(BASE)} ({paquete_ruta.stat().st_size // 1024} KB)")
    print(f"✓ Códigos ({len(codigos)}): {(carpeta / 'codigos.csv').relative_to(BASE)}")
    print(f"✓ Hoja para imprimir y recortar: {(carpeta / 'codigos.html').relative_to(BASE)}")
    print(f"✓ Ficha del profesor: {(carpeta / 'ficha-profesor.md').relative_to(BASE)}")
    print(f"  Contraseña de desbloqueo: {contrasena}")
    print(f"  Entregas en: {carpeta_drive(meta)}/{nombre_entrega(meta, '<CÓDIGO>')}")
    if not config.get("receptor"):
        print("⚠ config.json no tiene «receptor»: las entregas solo se descargarán en local.")
    print("Publica haciendo commit + push de examenes/ (la Action lo despliega).")
    return 0


def hoja_codigos(examen: dict, meta: dict, codigos: list[str], url: str) -> str:
    """Hoja A4 para imprimir y recortar: una papeleta por alumno, 10 por página.

    El reverso queda en blanco a propósito: ahí escribe el alumno su nombre y te
    devuelve el papel. Ese papel es el único vínculo entre código y persona.
    """
    cabecera = " · ".join(x for x in (meta["grupo"], meta["siglas"], meta["ra"]) if x)
    papeletas = "\n".join(
        f"""      <div class="papeleta">
        <div class="curso">{escape(cabecera)}</div>
        <div class="url">{escape(url)}</div>
        <div class="codigo">{escape(c)}</div>
        <div class="pie">Escribe tu nombre por detrás</div>
      </div>"""
        for c in codigos
    )
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Códigos — {escape(examen.get('id', ''))}</title>
<style>
  @page {{ size: A4; margin: 10mm; }}
  body {{ font-family: system-ui, 'Segoe UI', Roboto, sans-serif; margin: 0; color: #1b2330; }}
  .aviso {{ background: #fff3dc; border: 1px solid #a15c00; color: #a15c00; padding: 10px 14px;
           border-radius: 8px; margin-bottom: 12px; font-size: 13px; }}
  .hoja {{ display: grid; grid-template-columns: 1fr 1fr; gap: 0; }}
  .papeleta {{ border: 1px dashed #9aa4b2; padding: 12px 14px; height: 52mm; box-sizing: border-box;
              display: flex; flex-direction: column; justify-content: center; text-align: center;
              break-inside: avoid; }}
  .curso {{ font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #5b6676; }}
  .url {{ font-size: 11px; color: #1f5fbf; margin: 6px 0 10px; word-break: break-all; }}
  .codigo {{ font-family: ui-monospace, Consolas, monospace; font-size: 25px; font-weight: 700;
            letter-spacing: .06em; }}
  .pie {{ font-size: 11px; color: #5b6676; margin-top: 10px; }}
  @media print {{ .aviso {{ display: none; }} }}
</style>
</head>
<body>
  <div class="aviso">
    <strong>Documento privado.</strong> Imprime con Ctrl+P (a una cara), recorta por la línea de
    puntos y reparte una papeleta a cada alumno. Que escriba su nombre por detrás y te la devuelva.
  </div>
  <div class="hoja">
{papeletas}
  </div>
</body>
</html>
"""


def cmd_verificar(args: argparse.Namespace) -> int:
    ruta = PUBLICADOS / f"{args.id}.json"
    paquete = json.loads(ruta.read_text(encoding="utf-8"))
    if not cripto.codigo_valido(args.codigo):
        raise ErrorExamen("El código tiene un error de tecleo (dígito de control)")
    examen = cripto.descifrar_paquete(paquete, args.codigo)
    n = sum(len(p["preguntas"]) for p in examen["partes"])
    print(f"✓ {cripto.formatear(args.codigo)} abre {examen['id']}: {n} preguntas, {examen['duracion']} min")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="orden", required=True)

    e = sub.add_parser("extraer", help="examen-modelo → .privado/<ID>/examen.json")
    e.add_argument("modelo")
    e.add_argument("--id", help="identificador (por defecto CICLO-MODULO-RA)")
    e.add_argument("--duracion", type=int, help="minutos de examen")
    e.add_argument("--titulo")
    e.add_argument("--grupo", help="por defecto, curso + ciclo (1DAM)")
    e.add_argument("--siglas", help="por defecto, las de siglas.json (0373 → LMSG)")
    e.add_argument("--curso-escolar", dest="curso_escolar", help="por defecto, el de hoy (2026-27)")
    e.add_argument("--convocatoria", choices=CONVOCATORIAS, default=CONVOCATORIAS[0])
    e.add_argument("--pesos", type=Path, help="calificaciones.config.json (por defecto, el del examen modelo)")
    e.add_argument("--sobrescribir", action="store_true")
    e.set_defaults(func=cmd_extraer)

    c = sub.add_parser("cifrar", help="examen.json → paquete cifrado + códigos + ficha")
    c.add_argument("examen", help="ID (usa .privado/<ID>/examen.json) o ruta a un .json")
    c.add_argument("--codigos", type=int, required=True, help="número de códigos de acceso")
    c.add_argument("--duracion", type=int)
    c.add_argument("--contrasena", help="por defecto se genera una aleatoria")
    c.add_argument("--regenerar", action="store_true", help="sobrescribe el paquete (invalida códigos)")
    c.add_argument("--iter", type=int, default=cripto.ITER_CODIGO, help=argparse.SUPPRESS)
    c.set_defaults(func=cmd_cifrar)

    v = sub.add_parser("verificar", help="comprueba que un código abre el paquete")
    v.add_argument("id")
    v.add_argument("codigo")
    v.set_defaults(func=cmd_verificar)

    args = ap.parse_args(argv)
    try:
        return args.func(args)
    except (ErrorExamen, FileNotFoundError, KeyError) as exc:
        print(f"✗ {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
