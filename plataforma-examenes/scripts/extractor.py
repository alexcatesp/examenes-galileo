"""Extrae la versión del alumno (sin soluciones) de un examen-modelo-RAx.md.

Los exámenes modelo del repo tienen varios formatos (ítems `**A1.**`, `**P1.**`,
`**1. [a·IL1]**`, `## Ejercicio N`...) y las soluciones aparecen en secciones
finales (`## Corrección`, `## Solucionario`, `# PLANTILLA DE CORRECCIÓN`) o
dentro de cada ítem (`**Solución:**`, `→ **Corrección:**`, `> *Solución:*`).

Estrategia defensiva: todo lo que va tras una marca de solución se descarta y,
al final, se comprueba que ninguna línea del material del profesor ha llegado
a la salida (`fugas`). El resultado siempre debe revisarlo el profesor.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

NIVELES = ("Básico", "Intermedio", "Avanzado")
TIPOS = ("unica", "multiple", "texto", "codigo")
LENGUAJES = (
    "html", "css", "javascript", "typescript", "json", "xml", "sql", "java",
    "python", "php", "yaml", "markdown", "shell", "texto",
)

RE_TITULO_H = re.compile(r"^(#{1,6})\s+(.*)$")
RE_EXCLUIR = re.compile(
    r"correcci[oó]n|solucionario|\bsoluci[oó]n\b|plantilla|resumen de|c[oó]mo se (traslada|vuelca|calcula|traduce)|"
    r"matriz|puntuaci[oó]n|r[uú]brica|clave de respuestas",
    re.I,
)
RE_PARTE = re.compile(r"\bparte\s+([A-Z])\b", re.I)
RE_ITEM_NEGRITA = re.compile(r"^\*\*\s*((?:[A-Z]\.?)?\d{1,3})(?=[.\s)—–-])")
RE_ITEM_TITULO = re.compile(
    r"^#{2,4}\s+(?:(?:Ejercicio|Pregunta|Supuesto|Problema)\s+((?:[A-Z]\.?)?\d{1,3})\b|([A-Z]\.?\d{1,3})\s*(?:[—–:.-]|$))",
    re.I,
)
RE_SOLUCION = re.compile(
    r"^\s*(?:>\s*)?(?:[-+]\s+)?(?:→\s*)?[*_\s]*(?:soluci[oó]n|correcci[oó]n|criterio de correcci|respuesta esperada|"
    r"respuesta correcta|clave\b|qu[eé] es un 10)",
    re.I,
)
RE_META_LINEA = re.compile(
    r"^\s*(?:>\s*)?[*_]*\s*(?:(?:puntuaci[oó]n|celda|banda|peso)\b[^\n]{0,5}[:*_]|nota (?:de ensamblaje|para el profesor|docente|del profesor))",
    re.I,
)
RE_OPCION = re.compile(r"^\s*(?:[-*+]\s+)?\(?([a-h])\)\s+(\S.*)$")
RE_MARCA_TIPO = re.compile(r"<!--\s*respuesta\s*:\s*([a-z]+)(?:\s*\(\s*([a-z#+]+)\s*\))?\s*-->", re.I)
RE_ID_ITEM = re.compile(r"\bRA\d+-[A-Za-z0-9]+-[BIA]-\d+\b")
RE_COMENTARIO = re.compile(r"<!--.*?-->", re.S)
RE_MULTIPLE = re.compile(r"marca (todas|las que)|selecciona (todas|las que)|(una o varias|varias) (opciones|respuestas)|todas las correctas", re.I)

PALABRAS_CODIGO = re.compile(
    r"\b(escribe|implementa|codifica|programa|crea|construye|diseña|entrega|completa|corrige|reescribe|define|declara|traduce)\b"
    r"[^.?\n]{0,90}\b(documento|fichero|archivo|c[oó]digo|consulta|script|programa|hoja de estilos|funci[oó]n|clase|m[eé]todo|"
    r"esquema (?:XML|XSD|JSON)|DTD|XSD|XSLT|plantilla|sentencias?|instrucci[oó]n|comandos?|playbook|directivas?|etiquetas|marcado|"
    r"regla|selector|procedimiento|trigger|disparador|vista|endpoint|componente|fragmento|expresi[oó]n regular|bucle|bloque|interfaz|registro|enum)\b",
    re.I,
)
LENGUAJE_POR_PALABRA = [
    (re.compile(r"\bXSLT\b|\bXSD\b|\bDTD\b|\bXML\b|\bXPath\b|\bXQuery\b|\bRSS\b|\bAtom\b|\bSVG\b", re.I), "xml"),
    (re.compile(r"\bHTML5?\b|\betiquetas\b|\bmarcado sem[aá]ntico\b", re.I), "html"),
    (re.compile(r"\bCSS\b|hoja de estilos|\bselector", re.I), "css"),
    (re.compile(r"\bTypeScript\b", re.I), "typescript"),
    (re.compile(r"\bJavaScript\b|\bJS\b|\bDOM\b|\bfetch\b|\bNode", re.I), "javascript"),
    (re.compile(r"\bJSON\b", re.I), "json"),
    (re.compile(r"\bYAML\b|playbook|docker-compose|\bcompose\b", re.I), "yaml"),
    (re.compile(r"\bSQL\b|\bconsulta\b|\bSELECT\b|procedimiento almacenado|\btrigger\b|disparador|\bvista\b|PL/pgSQL|PL/SQL", re.I), "sql"),
    (re.compile(r"\bPHP\b|Laravel|Symfony", re.I), "php"),
    (re.compile(r"\bPython\b", re.I), "python"),
    (re.compile(r"\bJava\b|\bKotlin\b|Spring", re.I), "java"),
    (re.compile(r"\bbash\b|\bshell\b|PowerShell|\bcomandos?\b|\bscript\b|directivas?|\bnsupdate\b|\bsystemctl\b", re.I), "shell"),
]
ALIAS_LENGUAJE = {
    "js": "javascript", "ts": "typescript", "sh": "shell", "bash": "shell", "zsh": "shell",
    "powershell": "shell", "ps1": "shell", "console": "shell", "yml": "yaml", "md": "markdown",
    "plsql": "sql", "pgsql": "sql", "mysql": "sql", "postgresql": "sql", "kotlin": "java",
    "xsd": "xml", "xsl": "xml", "xslt": "xml", "dtd": "xml", "svg": "xml", "htm": "html",
    "text": "texto", "txt": "texto", "plain": "texto", "ini": "texto", "conf": "texto",
    "dockerfile": "texto", "nginx": "texto", "apache": "texto",
}


@dataclass
class Opcion:
    letra: str
    texto: str


@dataclass
class Pregunta:
    id: str
    parte: str
    lineas: list[str] = field(default_factory=list)
    cabecera: str = ""
    marca_tipo: tuple[str, str | None] | None = None


def _sin_acentos(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")


def _normalizar_id(bruto: str) -> str:
    return bruto.replace(".", "").upper()


def _nivel_de(texto: str) -> str | None:
    t = _sin_acentos(texto).lower()
    for nivel in NIVELES:
        if _sin_acentos(nivel).lower() in t:
            return nivel
    if re.search(r"\bmedio\b", t):
        return "Intermedio"
    return None


def _ces_de(texto: str) -> list[str]:
    ces: list[str] = []
    for m in re.finditer(r"\bCE\s+([a-zñ](?:\s*(?:,|/|y)\s*[a-zñ]\b)*)", texto):
        ces += re.findall(r"[a-zñ]", m.group(1))
    for m in re.finditer(r"\[([^\]]+)\]", texto):
        ces += re.findall(r"\b([a-zñ])\s*[·\-]\s*IL", m.group(1))
    vistos: list[str] = []
    for c in ces:
        if c not in vistos:
            vistos.append(c)
    return vistos


RE_META_PAREN = re.compile(r"\((?=[^)]*(?:\bCE\s+[a-zñ]|RA\d+-|·\s*IL|\bIL\d))[^)]*\)")
RE_META_CORCH = re.compile(r"\[[^\]]*(?:·|IL\d|INTEGRADOR|RA\d+-)[^\]]*\]")


def _quitar_meta(t: str) -> str:
    """Quita *(CE a · IL1)*, (RA1-INT-I-01 · CE a), [a·IL1], *[RA1-a-B-01]*."""
    t = RE_META_CORCH.sub("", RE_META_PAREN.sub("", t))
    # Negritas/cursivas que se han quedado vacías: «**(CE a)**» → «**» → «»
    return re.sub(r"(?:(?<=\s)|^)(\*{1,2}|_{1,2})\s*\1(?=\s|$|[.,;:])", "", t)


def _limpiar_cabecera(texto: str) -> str:
    """Quita la etiqueta del ítem y los metadatos (CE, IL, IDs de banco) del enunciado.

    `**B1 — Aula nueva.** *(RA1-INT-I-01 · CE a)* Se monta…` → `**Aula nueva.** Se monta…`
    """
    m = re.match(r"^\*\*(.*?)\*\*(.*)$", texto.strip())
    etiqueta, resto = (m.group(1), m.group(2)) if m else ("", texto)
    titulo = re.sub(r"^\s*(?:(?:Ejercicio|Pregunta|Supuesto|Problema)\s+)?[A-Z]?\.?\d{1,3}[.)]?", "", etiqueta, flags=re.I)
    titulo = _quitar_meta(titulo).lstrip(" .:—–-·")
    titulo = re.sub(r"^\s*CE\s+[a-zñ](?:\s*[,/y]\s*[a-zñ]\b)*(?:\s*\(integrador\))?", "", titulo)  # ### A1 — CE a
    titulo = titulo.strip(" .:—–-·*_")
    resto = _quitar_meta(resto)
    resto = re.sub(r"^[\s.:—–·-]*", "", resto)
    resto = re.sub(r"\s{2,}", " ", resto).strip()
    return f"**{titulo}.** {resto}".strip() if titulo else resto


def _tabla_matriz(lineas: list[str]) -> dict[str, dict]:
    """Lee la matriz de especificaciones: ejercicio → item, tipo, nivel, CE."""
    info: dict[str, dict] = {}
    for linea in lineas:
        if not linea.startswith("|"):
            continue
        celdas = [c.strip() for c in linea.strip().strip("|").split("|")]
        if len(celdas) < 3 or set(celdas[0]) <= set("-: "):
            continue
        primera = celdas[0].replace("*", "")
        datos = {
            "tipo": celdas[1].lower() if len(celdas) > 1 else "",
            "nivel": _nivel_de(" ".join(celdas[1:4])),
            "ce": re.findall(r"\b([a-zñ])\b", celdas[3]) if len(celdas) > 3 else [],
        }
        rango = re.match(r"([A-Z])\.?(\d+)\s*[–-]\s*\1?\.?(\d+)", primera)
        if rango:
            letra, ini, fin = rango.group(1), int(rango.group(2)), int(rango.group(3))
            for n in range(ini, fin + 1):
                info.setdefault(f"{letra}{n}", {}).update({k: v for k, v in datos.items() if k != "ce"})
            continue
        m = re.match(r"((?:[A-Z]\.?)?\d{1,3})\b", primera)
        if m:
            d = dict(datos)
            item = RE_ID_ITEM.search(primera)
            if item:
                d["item"] = item.group(0)
            info[_normalizar_id(m.group(1))] = d
    return info


# Lenguaje por defecto del módulo cuando el enunciado no deja claro cuál es.
LENGUAJE_MODULO = {
    "0373": "xml", "0484": "sql", "0372": "sql", "0377": "sql", "0485": "java", "0486": "java",
    "0489": "java", "0490": "java", "0612": "javascript", "0613": "php", "0615": "css",
}


def _deducir_tipo(enunciado: str, opciones: list[Opcion], modulo: str = "") -> tuple[str, str | None]:
    if opciones:
        return ("multiple" if RE_MULTIPLE.search(enunciado) else "unica"), None
    bloque = re.search(r"```\s*([A-Za-z0-9#+-]*)", enunciado)
    if bloque or PALABRAS_CODIGO.search(enunciado):
        lang = bloque.group(1).lower() if bloque and bloque.group(1) else None
        if lang:
            lang = ALIAS_LENGUAJE.get(lang, lang)
        if not lang or lang not in LENGUAJES:
            lang = next((l for rx, l in LENGUAJE_POR_PALABRA if rx.search(enunciado)), LENGUAJE_MODULO.get(modulo, "texto"))
        if PALABRAS_CODIGO.search(enunciado) or bloque:
            return "codigo", lang
    return "texto", None


def _metadatos(texto: str, ruta: Path | None) -> dict:
    meta: dict = {"ciclo": "", "modulo": "", "codigoModulo": "", "curso": "", "ra": "", "raTexto": "", "duracionSugerida": None}
    m = re.search(r"^#\s+.*?\b(RA\s*\d+)\s*[:.—–-]\s*(.+)$", texto, re.M)
    if m:
        meta["ra"] = m.group(1).replace(" ", "")
        meta["raTexto"] = m.group(2).strip()
    m = re.search(r"\*\*M[oó]dulo:?\*\*:?\s*([^·\n]+)", texto)
    if m:
        meta["modulo"] = m.group(1).strip()
    m = re.search(r"\*\*Ciclo:?\*\*:?\s*([A-Za-z]+)", texto)
    if m:
        meta["ciclo"] = m.group(1).upper()
    m = re.search(r"\*\*Curso:?\*\*:?\s*(\d)", texto)
    if m:
        meta["curso"] = m.group(1)
    m = re.search(r"~\s*(\d{2,3})\s*min", texto)
    if m:
        meta["duracionSugerida"] = int(m.group(1))
    if ruta is not None:
        partes = ruta.resolve().parts
        if "modulos" in partes:
            i = partes.index("modulos")
            if len(partes) > i + 2:
                meta["ciclo"] = meta["ciclo"] or partes[i + 1]
                cod, _, slug = partes[i + 2].partition("-")
                meta["codigoModulo"] = cod
                if not meta["modulo"]:
                    meta["modulo"] = f"{slug.replace('-', ' ').capitalize()} ({cod})"
        if not meta["ra"]:
            m = re.search(r"RA\d+", ruta.stem)
            meta["ra"] = m.group(0) if m else ""
    if not meta["codigoModulo"]:
        m = re.search(r"\((\d{4}|[A-Z]{2}\d{4}[^)]*)\)", meta["modulo"])
        meta["codigoModulo"] = m.group(1) if m else ""
    return meta


def extraer(texto: str, ruta: Path | None = None) -> tuple[dict, list[str]]:
    """Devuelve (examen, avisos). El examen no contiene soluciones."""
    avisos: list[str] = []
    meta = _metadatos(texto, ruta)
    # Las marcas de tipo viven en comentarios HTML: se capturan antes de quitar comentarios.
    texto = RE_MARCA_TIPO.sub(lambda m: f"\x00TIPO:{m.group(1).lower()}:{(m.group(2) or '').lower()}\x00", texto)
    texto = RE_COMENTARIO.sub("", texto)
    lineas = texto.splitlines()

    material_profesor: list[str] = []
    matriz_lineas: list[str] = []
    partes: list[dict] = []
    parte_actual: dict | None = None
    pregunta: Pregunta | None = None
    preguntas_por_parte: dict[int, list[Pregunta]] = {}
    nivel_excluido: int | None = None  # nivel del encabezado que abrió una zona excluida
    en_matriz = False
    en_solucion = False  # dentro de un ítem, tras una marca de solución
    en_bloque_codigo = False
    en_details = False

    def cerrar_pregunta() -> None:
        nonlocal pregunta, en_solucion
        pregunta = None
        en_solucion = False

    for linea in lineas:
        if re.match(r"^\s*<details", linea, re.I):
            en_details = True
        if en_details:
            material_profesor.append(linea)
            if re.search(r"</details>", linea, re.I):
                en_details = False
            continue
        if linea.strip().startswith("```"):
            en_bloque_codigo = not en_bloque_codigo
        h = None if en_bloque_codigo and not linea.strip().startswith("```") else RE_TITULO_H.match(linea)
        if h and not linea.strip().startswith("```"):
            nivel_h, titulo = len(h.group(1)), h.group(2)
            if nivel_excluido is not None and nivel_h > nivel_excluido:
                material_profesor.append(linea)
                continue
            nivel_excluido = None
            en_matriz = bool(re.search(r"matriz", titulo, re.I))
            item_h = RE_ITEM_TITULO.match(linea)
            if item_h and parte_actual is not None:
                cerrar_pregunta()
                pregunta = Pregunta(id=_normalizar_id(item_h.group(1) or item_h.group(2)), parte=parte_actual["id"], cabecera=titulo)
                cuerpo = re.sub(r"^(?:(?:Ejercicio|Pregunta|Supuesto|Problema)\s+)?[A-Z]?\.?\d{1,3}\b\s*", "", titulo, flags=re.I)
                cuerpo = _limpiar_cabecera(f"**{cuerpo}**") if cuerpo else ""
                pregunta.lineas.append(cuerpo)
                preguntas_por_parte[len(partes) - 1].append(pregunta)
                continue
            es_titulo = nivel_h == 1 and re.match(r"\s*examen\b", titulo, re.I)
            if RE_EXCLUIR.search(titulo) and not es_titulo and not RE_PARTE.search(titulo):
                nivel_excluido = nivel_h
                cerrar_pregunta()
                (matriz_lineas if en_matriz else material_profesor).append(linea)
                continue
            p = RE_PARTE.search(titulo)
            if p:
                cerrar_pregunta()
                parte_actual = {"id": p.group(1).upper(), "titulo": re.sub(r"\s*·.*$", "", titulo).strip(), "nivel": _nivel_de(titulo)}
                partes.append(parte_actual)
                preguntas_por_parte[len(partes) - 1] = []
                continue
            # Otro encabezado (p. ej. «### CE a — ...» o «# ENUNCIADO»): cierra el ítem en curso.
            cerrar_pregunta()
            continue

        if nivel_excluido is not None:
            (matriz_lineas if en_matriz else material_profesor).append(linea)
            continue

        if parte_actual is None:
            continue

        m_item = RE_ITEM_NEGRITA.match(linea) if not en_bloque_codigo else None
        if m_item:
            cerrar_pregunta()
            pregunta = Pregunta(id=_normalizar_id(m_item.group(1)), parte=parte_actual["id"], cabecera=linea)
            pregunta.lineas.append(_limpiar_cabecera(linea))
            preguntas_por_parte[len(partes) - 1].append(pregunta)
            continue

        if pregunta is None:
            continue  # preámbulo de la parte (normas de puntuación): no se muestra

        if "\x00TIPO:" in linea:
            _, tipo, lang = linea.split("\x00")[1].split(":")
            pregunta.marca_tipo = (tipo, lang or None)
            linea = re.sub(r"\x00[^\x00]*\x00", "", linea)
            if not linea.strip():
                continue

        if en_solucion:
            material_profesor.append(linea)
            continue
        if not en_bloque_codigo and RE_SOLUCION.match(linea):
            en_solucion = True
            material_profesor.append(linea)
            continue
        if not en_bloque_codigo and RE_META_LINEA.match(linea):
            material_profesor.append(linea)
            continue
        if not en_bloque_codigo and re.match(r"^\s*(---+|\*\*\*+)\s*$", linea):
            continue
        if not en_bloque_codigo and (RE_META_PAREN.search(linea) or RE_META_CORCH.search(linea)):
            pregunta.cabecera += " " + linea
            linea = re.sub(r"^\s+", "", _quitar_meta(linea)) if linea.strip() else linea
            if not linea.strip():
                continue
        pregunta.lineas.append(linea)

    matriz = _tabla_matriz(matriz_lineas)
    examen_partes = []
    for idx, parte in enumerate(partes):
        preguntas = []
        es_test = bool(re.search(r"\btest\b|b[aá]sico", parte["titulo"], re.I))
        for p in preguntas_por_parte.get(idx, []):
            info = matriz.get(p.id, {})
            opciones: list[Opcion] = []
            cuerpo: list[str] = []
            permitir_opciones = es_test or "test" in info.get("tipo", "")
            lineas_item: list[str] = []
            for l in p.lineas:
                # Opciones en una sola línea: «a) … b) … c) … d) …»
                if permitir_opciones and re.match(r"^\s*(?:[-*+]\s+)?a\)\s", l) and re.search(r"\sb\)\s", l):
                    trozos = re.split(r"(?:^|\s)(?=[b-h]\)\s)", l.strip())
                    lineas_item += [t.strip() for t in trozos if t.strip()]
                else:
                    lineas_item.append(l)
            for l in lineas_item:
                mo = RE_OPCION.match(l) if permitir_opciones else None
                if mo and (not opciones or ord(mo.group(1)) == ord(opciones[-1].letra) + 1) and (opciones or mo.group(1) == "a"):
                    opciones.append(Opcion(mo.group(1), mo.group(2).strip()))
                else:
                    cuerpo.append(l)
            if len(opciones) < 2:  # «a) …» sueltos no son un test
                cuerpo = p.lineas[:]
                opciones = []
            enunciado = "\n".join(cuerpo).strip()
            enunciado = re.sub(r"\n{3,}", "\n\n", enunciado)
            tipo, lang = _deducir_tipo(enunciado, opciones, meta["codigoModulo"])
            origen_tipo = "deducido"
            if p.marca_tipo:
                t, l = p.marca_tipo
                if t in TIPOS:
                    tipo, lang, origen_tipo = t, (ALIAS_LENGUAJE.get(l, l) if l else None), "marca"
                    if tipo == "codigo" and lang not in LENGUAJES:
                        lang = "texto"
                else:
                    avisos.append(f"{p.id}: marca de tipo desconocida «{t}»")
            if tipo in ("unica", "multiple") and not opciones:
                avisos.append(f"{p.id}: marcada como test pero sin opciones; se usa texto")
                tipo, lang = "texto", None
            ces = _ces_de(p.cabecera) or info.get("ce", [])
            item = RE_ID_ITEM.search(p.cabecera)
            nivel = _nivel_de(RE_ITEM_NEGRITA.sub("", p.cabecera)) if re.search(r"b[aá]sico|intermedio|avanzado", p.cabecera, re.I) else None
            pregunta_d = {
                "id": p.id,
                "item": item.group(0) if item else info.get("item"),
                "nivel": nivel or info.get("nivel") or parte["nivel"],
                "ce": ces,
                "tipo": tipo,
                "lenguaje": lang if tipo == "codigo" else None,
                "enunciado": enunciado,
                "opciones": [{"letra": o.letra, "texto": o.texto} for o in opciones],
                "_origenTipo": origen_tipo,
            }
            if not enunciado:
                avisos.append(f"{p.id}: enunciado vacío")
            preguntas.append(pregunta_d)
        if preguntas:
            examen_partes.append({"id": parte["id"], "titulo": parte["titulo"], "preguntas": preguntas})

    ids = [q["id"] for pt in examen_partes for q in pt["preguntas"]]
    duplicados = sorted({i for i in ids if ids.count(i) > 1})
    if duplicados:
        avisos.append(f"IDs de pregunta repetidos: {', '.join(duplicados)} (se renombran por parte)")
        for pt in examen_partes:
            for q in pt["preguntas"]:
                if q["id"] in duplicados and not q["id"].startswith(pt["id"]):
                    q["id"] = f"{pt['id']}{q['id']}"
    if not examen_partes:
        avisos.append("No se ha encontrado ninguna parte con preguntas: formato no reconocido")

    examen = {
        "ciclo": meta["ciclo"],
        "curso": meta["curso"],
        "modulo": meta["modulo"],
        "codigoModulo": meta["codigoModulo"],
        "ra": meta["ra"],
        "raTexto": meta["raTexto"],
        "duracion": meta["duracionSugerida"],
        "partes": examen_partes,
    }
    for fuga in fugas(examen):
        avisos.append(f"POSIBLE FUGA DE SOLUCIÓN: {fuga}")
    return examen, avisos


RE_MARCAS_FUGA = re.compile(
    r"[*_]\s*(?:soluci[oó]n|correcci[oó]n|criterio)\b[^*_\n]{0,25}?:|\*\*10\*\*\s*=|\b10\s*=\s|celda\s*:|hol[ií]stica|sub-?r[uú]brica|"
    r"respuesta correcta\s*:|→\s*\*\*[a-h]\*\*|(?:^|\s)[A-Z]?\d+\s*→\s*\*\*[a-h]\*\*",
    re.I,
)


def _textos(examen: dict):
    for parte in examen.get("partes", []):
        yield parte.get("titulo", "")
        for q in parte.get("preguntas", []):
            yield q.get("enunciado", "")
            for o in q.get("opciones", []):
                yield o.get("texto", "")


def fugas(examen: dict) -> list[str]:
    """Busca en el examen marcas típicas de solución (Solución:, **10** =, → **b**...)."""
    encontradas: list[str] = []
    todo = "\n".join(_textos(examen))
    for m in RE_MARCAS_FUGA.finditer(todo):
        contexto = todo[max(0, m.start() - 30) : m.end() + 30].replace("\n", " ")
        encontradas.append(f"marca «{m.group(0).strip()}» en «…{contexto}…»")
    return encontradas
