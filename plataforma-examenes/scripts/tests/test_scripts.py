import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import calcular_notas  # noqa: E402
import cripto  # noqa: E402
import preparar_examen  # noqa: E402
import validar_publicacion  # noqa: E402
from extractor import extraer, fugas  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"

# Las fixtures son exámenes modelo reales, con sus soluciones, así que no se publican
# con el código. Quien clone el repositorio verá estos tests como «saltados» y podrá
# poner sus propios exámenes ahí para comprobar que el extractor los entiende.
necesita_fixtures = pytest.mark.skipif(
    not FIXTURES.exists(),
    reason="sin exámenes modelo en tests/fixtures (no se publican: llevan las soluciones)",
)

# Fragmentos que solo aparecen en el material del profesor de cada fixture.
SOLUCIONES = {
    "formato-correccion-final.md": ["A1 → **c**", "10 = los tres apartados", "Holística"],
    "formato-solucion-por-item.md": ["La CPU ejecuta las instrucciones", "La RAM pierde su contenido"],
    "formato-ejercicio-titulo.md": ["La MAC ya la trae la tarjeta", "El cliente descubre (DISCOVER)"],
    "formato-encabezado-h3.md": ["JavaFX 22 se distribuye como módulo"],
    "formato-details.md": ["subrúbrica por CE", "Plantilla de corrección"],
    "formato-plantilla-h1.md": ["10 si acierta, 0 si falla", "PLANTILLA DE CORRECCIÓN"],
}


def _texto(examen: dict) -> str:
    return json.dumps(examen, ensure_ascii=False)


# ── Códigos ──────────────────────────────────────────────────────────────


def test_codigo_generado_es_valido_y_con_formato():
    for _ in range(200):
        c = cripto.generar_codigo()
        assert len(c) == 14 and c[4] == c[9] == "-"
        assert cripto.codigo_valido(c)


def test_codigo_normaliza_equivalencias_y_minusculas():
    c = cripto.generar_codigo()
    tecleado = c.lower().replace("-", " ").replace("0", "o").replace("1", "l")
    assert cripto.codigo_valido(tecleado)
    assert cripto.normalizar(tecleado) == c.replace("-", "")


def test_digito_de_control_detecta_errata_de_un_caracter():
    c = cripto.normalizar(cripto.generar_codigo())
    detectadas = 0
    for i in range(len(c) - 1):
        for letra in cripto.ALFABETO:
            if letra != c[i]:
                detectadas += not cripto.codigo_valido(c[:i] + letra + c[i + 1 :])
    total = (len(c) - 1) * (len(cripto.ALFABETO) - 1)
    assert detectadas / total > 0.99


# ── Cifrado ──────────────────────────────────────────────────────────────


def test_paquete_se_abre_con_cada_codigo_y_no_con_otros():
    examen = {"id": "T-1", "partes": [], "secreto": "¿Qué es XML?"}
    codigos = cripto.generar_codigos(5)
    paquete = cripto.cifrar_paquete(examen, codigos, iter_codigo=1000)
    for c in codigos:
        assert cripto.descifrar_paquete(paquete, c) == examen
    with pytest.raises(KeyError):
        cripto.descifrar_paquete(paquete, cripto.generar_codigo())


def test_paquete_no_revela_codigos_ni_contenido():
    examen = {"id": "T-2", "partes": [], "secreto": "PREGUNTA-SECRETA"}
    codigos = cripto.generar_codigos(3)
    crudo = json.dumps(cripto.cifrar_paquete(examen, codigos, iter_codigo=1000))
    assert "PREGUNTA-SECRETA" not in crudo
    for c in codigos:
        assert c not in crudo and cripto.normalizar(c) not in crudo


def test_localizador_es_independiente_del_formato_tecleado():
    sal = b"0123456789abcdef"
    c = cripto.generar_codigo()
    assert cripto.localizador(sal, c) == cripto.localizador(sal, c.lower().replace("-", ""))


# ── Extractor ────────────────────────────────────────────────────────────


@necesita_fixtures
@pytest.mark.parametrize("fixture", sorted(SOLUCIONES))
def test_extractor_no_filtra_soluciones(fixture):
    examen, avisos = extraer((FIXTURES / fixture).read_text(encoding="utf-8"))
    texto = _texto(examen)
    for fragmento in SOLUCIONES[fixture]:
        assert fragmento not in texto, fragmento
    assert fugas(examen) == []
    assert not [a for a in avisos if "FUGA" in a]


@necesita_fixtures
@pytest.mark.parametrize("fixture", sorted(SOLUCIONES))
def test_extractor_encuentra_partes_y_tests(fixture):
    examen, _ = extraer((FIXTURES / fixture).read_text(encoding="utf-8"))
    assert len(examen["partes"]) >= 3
    primera = examen["partes"][0]["preguntas"]
    assert len(primera) >= 5
    assert all(q["tipo"] == "unica" and len(q["opciones"]) >= 3 for q in primera)
    for parte in examen["partes"]:
        for q in parte["preguntas"]:
            assert q["enunciado"].strip()
            assert "(CE " not in q["enunciado"][:12]


@necesita_fixtures
def test_extractor_formato_canonico():
    examen, avisos = extraer((FIXTURES / "formato-correccion-final.md").read_text(encoding="utf-8"))
    assert examen["ra"] == "RA1"
    assert examen["ciclo"] == "DAM" and examen["codigoModulo"] == "0373"
    ids = [q["id"] for p in examen["partes"] for q in p["preguntas"]]
    assert ids[:2] == ["A1", "A2"] and "C3" in ids
    a1 = examen["partes"][0]["preguntas"][0]
    assert a1["ce"] == ["a"] and a1["nivel"] == "Básico"
    assert a1["enunciado"] == "¿Qué afirmación describe mejor un lenguaje de marcas?"
    assert [o["letra"] for o in a1["opciones"]] == ["a", "b", "c", "d"]
    b1 = examen["partes"][1]["preguntas"][0]
    assert b1["item"] == "RA1-INT-I-01" and b1["ce"] == ["a", "c", "f"]
    c2 = next(q for p in examen["partes"] for q in p["preguntas"] if q["id"] == "C2")
    assert c2["tipo"] == "codigo" and c2["lenguaje"] == "xml"


@necesita_fixtures
def test_extractor_opciones_en_una_linea():
    examen, _ = extraer((FIXTURES / "formato-ejercicio-titulo.md").read_text(encoding="utf-8"))
    q = examen["partes"][0]["preguntas"][0]
    assert q["tipo"] == "unica" and len(q["opciones"]) == 4
    assert q["opciones"][0]["texto"].startswith("Dirección IP")


def test_marca_explicita_de_tipo_manda():
    md = """# Examen modelo — RA2: Algo

## Parte A — Básico (test)

**A1. (CE a)** ¿Pregunta?
- a) uno
- b) dos

## Parte B — Intermedio

**B1. (CE b)** Explica algo sin pistas de lenguaje.
<!-- respuesta: codigo(yml) -->

**B2. (CE c)** Escribe el documento XML pedido.
<!-- respuesta: texto -->

## Corrección

A1 → **b**
"""
    examen, avisos = extraer(md)
    b1, b2 = examen["partes"][1]["preguntas"]
    assert (b1["tipo"], b1["lenguaje"]) == ("codigo", "yaml")
    assert (b2["tipo"], b2["lenguaje"]) == ("texto", None)
    assert "respuesta:" not in _texto(examen)


def test_fugas_detecta_marcas_de_solucion():
    examen = {"partes": [{"titulo": "A", "preguntas": [
        {"id": "A1", "enunciado": "¿X?\n**Solución:** b", "opciones": []}]}]}
    assert fugas(examen)


# ── CLI de extremo a extremo ─────────────────────────────────────────────


@necesita_fixtures
def test_cli_extraer_cifrar_verificar(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(preparar_examen, "PRIVADO", tmp_path / ".privado")
    monkeypatch.setattr(preparar_examen, "PUBLICADOS", tmp_path / "examenes")
    monkeypatch.setattr(preparar_examen, "BASE", tmp_path)
    modelo = FIXTURES / "formato-correccion-final.md"
    assert preparar_examen.main(["extraer", str(modelo), "--id", "PRUEBA-RA1", "--duracion", "60"]) == 0
    assert preparar_examen.main(["cifrar", "PRUEBA-RA1", "--codigos", "4", "--iter", "1000"]) == 0
    filas = (tmp_path / ".privado/PRUEBA-RA1/codigos.csv").read_text().splitlines()
    assert filas[0] == "codigo,alumno" and len(filas) == 5
    codigo = filas[1].split(",")[0]
    assert preparar_examen.main(["verificar", "PRUEBA-RA1", codigo]) == 0
    paquete = json.loads((tmp_path / "examenes/PRUEBA-RA1.json").read_text())
    examen = cripto.descifrar_paquete(paquete, codigo)
    assert examen["duracion"] == 60 and "desbloqueo" in examen
    assert "_origenTipo" not in _texto(examen)
    ficha = (tmp_path / ".privado/PRUEBA-RA1/ficha-profesor.md").read_text()
    assert "?e=PRUEBA-RA1" in ficha
    # No se regenera por accidente (invalidaría los códigos repartidos).
    assert preparar_examen.main(["cifrar", "PRUEBA-RA1", "--codigos", "4", "--iter", "1000"]) == 1


META = {"ra": "RA1", "grupo": "1DAM", "siglas": "LMSG", "cursoEscolar": "2026-27", "convocatoria": "ev_continua"}


def test_cli_cifrar_bloquea_fugas(tmp_path, monkeypatch):
    monkeypatch.setattr(preparar_examen, "PUBLICADOS", tmp_path / "examenes")
    monkeypatch.setattr(preparar_examen, "PRIVADO", tmp_path / ".privado")
    examen = {"id": "FUGA-1", "duracion": 30, **META, "partes": [{"id": "A", "titulo": "A", "preguntas": [
        {"id": "A1", "tipo": "texto", "enunciado": "Explica X.\n→ **Corrección:** es Y", "opciones": []}]}]}
    ruta = tmp_path / "e.json"
    ruta.write_text(json.dumps(examen))
    # Sin la fuga el examen sería válido: así el test comprueba la fuga, no la validación.
    assert preparar_examen.validar(examen) == []
    assert preparar_examen.main(["cifrar", str(ruta), "--codigos", "2", "--iter", "1000"]) == 1
    assert not (tmp_path / "examenes/FUGA-1.json").exists()


# ── Nombres de fichero y carpetas de entrega ─────────────────────────────


def test_curso_escolar_va_de_septiembre_a_agosto():
    from datetime import date as d
    assert preparar_examen.curso_escolar(d(2026, 9, 1)) == "2026-27"
    assert preparar_examen.curso_escolar(d(2026, 12, 31)) == "2026-27"
    assert preparar_examen.curso_escolar(d(2027, 8, 31)) == "2026-27"
    assert preparar_examen.curso_escolar(d(2027, 9, 1)) == "2027-28"


def test_nombre_y_carpeta_de_entrega():
    assert preparar_examen.nombre_entrega(META, "K7FM-2QXR-9TPA") == "1DAM_LMSG_RA1_K7FM-2QXR-9TPA.md"
    assert preparar_examen.carpeta_drive(META) == "2026-27/1DAM/LMSG/RA1/ev_continua"
    # La convocatoria solo entra en el nombre cuando no es la ordinaria del curso.
    final = {**META, "convocatoria": "2a_final"}
    assert preparar_examen.nombre_entrega(final, "AAAA-BBBB-CCCC") == "1DAM_LMSG_RA1_2a_final_AAAA-BBBB-CCCC.md"
    assert preparar_examen.carpeta_drive(final) == "2026-27/1DAM/LMSG/RA1/2a_final"


@pytest.mark.parametrize(
    "campo,valor",
    [("grupo", "1 DAM"), ("siglas", "LM/SG"), ("ra", "RA 1"), ("cursoEscolar", "2026/27"), ("convocatoria", "otra")],
)
def test_validar_rechaza_metadatos_peligrosos(campo, valor):
    """Nada que vaya a un nombre de fichero o a una ruta de Drive puede llevar sorpresas."""
    examen = {"id": "X-1", "duracion": 30, **META, campo: valor,
              "partes": [{"id": "A", "titulo": "A", "preguntas": [
                  {"id": "A1", "tipo": "texto", "enunciado": "¿?", "opciones": []}]}]}
    assert any(campo in e for e in preparar_examen.validar(examen))


def test_el_paquete_publica_la_meta_sin_cifrar():
    """El receptor necesita estos datos para nombrar el fichero sin fiarse del navegador."""
    examen = {"id": "META-1", "partes": []}
    paquete = cripto.cifrar_paquete(examen, cripto.generar_codigos(2), iter_codigo=1000, meta=META)
    assert paquete["meta"] == META
    assert "datos" in paquete and "sal" in paquete


# ── Cálculo de notas (rubrica.md §2) ─────────────────────────────────────

ITEMS = {
    "A1": {"nivel": "Básico", "ce": ["a"]},
    "B1": {"nivel": "Intermedio", "ce": ["a", "b"]},
    "C1": {"nivel": "Avanzado", "ce": ["a"]},
}


def test_nota_de_ce_aplica_la_formula_de_la_rubrica():
    ces = calcular_notas.notas_de_ce(ITEMS, {"A1": 10, "B1": 10, "C1": 10})
    assert ces["a"]["nota"] == 10  # 0,5·10 + 0,2·10 + 0,3·10
    ces = calcular_notas.notas_de_ce(ITEMS, {"A1": 10, "B1": 0, "C1": 0})
    assert ces["a"]["nota"] == 5.0  # quedarse en el mínimo del criterio es un 5


def test_una_banda_no_examinada_cuenta_cero():
    """Brillar en lo avanzado no puede compensar saltarse lo básico."""
    solo_avanzado = {"C1": {"nivel": "Avanzado", "ce": ["a"]}}
    ces = calcular_notas.notas_de_ce(solo_avanzado, {"C1": 10})
    assert ces["a"]["nota"] == 3.0


def test_la_banda_promedia_sus_ejercicios():
    items = {"A1": {"nivel": "Básico", "ce": ["a"]}, "A2": {"nivel": "Básico", "ce": ["a"]}}
    ces = calcular_notas.notas_de_ce(items, {"A1": 10, "A2": 0})
    assert ces["a"]["bandas"]["Básico"] == 5.0


def test_un_item_integrador_puntua_en_todos_sus_ce():
    """Puntuación holística: una sola nota que va igual a cada CE que evalúa."""
    ces = calcular_notas.notas_de_ce(ITEMS, {"B1": 10})
    assert ces["b"]["bandas"]["Intermedio"] == 10.0
    assert ces["a"]["bandas"]["Intermedio"] == 10.0


def test_la_subrubrica_da_una_nota_por_apartado():
    """Para los integradores que el examen marca: distingue qué domina y qué no."""
    ces = calcular_notas.notas_de_ce(ITEMS, {"B1": {"a": 8, "b": 0}})
    assert ces["a"]["bandas"]["Intermedio"] == 8.0
    assert ces["b"]["bandas"]["Intermedio"] == 0.0


def test_en_la_subrubrica_un_apartado_que_falta_cuenta_cero():
    ces = calcular_notas.notas_de_ce(ITEMS, {"B1": {"a": 10}})
    assert ces["b"]["bandas"]["Intermedio"] == 0.0


def test_sin_responder_es_cero_no_se_ignora():
    ces = calcular_notas.notas_de_ce(ITEMS, {})
    assert ces["a"]["nota"] == 0.0


def test_nota_del_ra_pondera_por_el_peso_de_cada_ce():
    ces = {"a": {"nota": 10.0}, "b": {"nota": 0.0}}
    assert calcular_notas.nota_del_ra(ces, {"a": 90, "b": 10}) == 9.0
    assert calcular_notas.nota_del_ra(ces, {"a": 50, "b": 50}) == 5.0


def test_los_puntos_del_examen_suman_diez():
    """Si el examen cubre todos los CE en los tres niveles, el reparto es exacto."""
    pesos = {"a": 14, "b": 10, "c": 10, "d": 10, "e": 10, "f": 13, "g": 13, "h": 10, "i": 10}
    items = {f"A{i}": {"nivel": "Básico", "ce": [ce]} for i, ce in enumerate(pesos, 1)}
    items |= {"B1": {"nivel": "Intermedio", "ce": ["a", "c", "f"]}, "B2": {"nivel": "Intermedio", "ce": ["g", "h"]},
              "B3": {"nivel": "Intermedio", "ce": ["d", "e"]}, "B4": {"nivel": "Intermedio", "ce": ["b"]},
              "B5": {"nivel": "Intermedio", "ce": ["i"]},
              "C1": {"nivel": "Avanzado", "ce": ["a", "c", "d", "e", "f"]},
              "C2": {"nivel": "Avanzado", "ce": ["g", "h", "i"]}, "C3": {"nivel": "Avanzado", "ce": ["b"]}}
    puntos = calcular_notas.puntos_por_item(items, pesos)
    assert round(sum(puntos.values()), 2) == 10.0
    assert puntos["A1"] == 0.70  # CE a, que pesa 14 %, en la banda Básica (0,5)
    assert puntos["A2"] == 0.50  # CE b, que pesa 10 %
    assert puntos["C1"] == 1.71  # cinco CE en la banda Avanzada: la más cara
    # Cada parte vale lo que dice la rúbrica.
    assert round(sum(v for k, v in puntos.items() if k.startswith("A")), 2) == 5.0
    assert round(sum(v for k, v in puntos.items() if k.startswith("B")), 2) == 2.0
    assert round(sum(v for k, v in puntos.items() if k.startswith("C")), 2) == 3.0


def test_dos_preguntas_del_mismo_ce_y_nivel_se_reparten_los_puntos():
    pesos = {"a": 100}
    una = calcular_notas.puntos_por_item({"A1": {"nivel": "Básico", "ce": ["a"]}}, pesos)
    dos = calcular_notas.puntos_por_item(
        {"A1": {"nivel": "Básico", "ce": ["a"]}, "A2": {"nivel": "Básico", "ce": ["a"]}}, pesos)
    assert una["A1"] == 5.0
    assert dos["A1"] == dos["A2"] == 2.5


def test_los_puntos_avisan_si_el_examen_no_cubre_todo(tmp_path, monkeypatch):
    """Un examen parcial no puede llegar al 10, y el profesor tiene que saberlo."""
    config = tmp_path / "calificaciones.config.json"
    config.write_text(json.dumps({"ra": [{"id": "RA1", "ces": [{"id": "a", "peso": 50}, {"id": "b", "peso": 50}]}]}),
                      encoding="utf-8")
    examen = {"ra": "RA1", "partes": [{"preguntas": [
        {"id": "A1", "nivel": "Básico", "ce": ["a"]}, {"id": "A2", "nivel": "Básico", "ce": ["b"]}]}]}
    avisos = preparar_examen.poner_puntos(examen, config)
    assert any("suman 5" in a for a in avisos)
    assert examen["partes"][0]["preguntas"][0]["puntos"] == 2.5


def test_leer_items_saca_ce_y_nivel_de_la_entrega(tmp_path):
    entrega = tmp_path / "1DAM_LMSG_RA1_AAAA-BBBB-CCCC.md"
    entrega.write_text(
        "### A1 · Básico · CE a · test (única)\n\n¿?\n\n"
        "### C2 · RA1-AVZ-A-02 · Avanzado · CE g, h, i · código (xml)\n\n¿?\n",
        encoding="utf-8",
    )
    items = calcular_notas.leer_items(entrega)
    assert items["A1"] == {"nivel": "Básico", "ce": ["a"]}
    assert items["C2"] == {"nivel": "Avanzado", "ce": ["g", "h", "i"]}


def _dist(tmp_path, paquete: dict | None = None):
    dist = tmp_path / "dist"
    (dist / "examenes").mkdir(parents=True)
    if paquete is None:
        paquete = cripto.cifrar_paquete({"id": "X-1", "partes": []}, cripto.generar_codigos(2),
                                        iter_codigo=1000, meta=META)
    (dist / "examenes" / "X-1.json").write_text(json.dumps(paquete), encoding="utf-8")
    return dist


def test_validar_publicacion_acepta_un_paquete_correcto(tmp_path):
    assert validar_publicacion.validar(_dist(tmp_path)) == []


def test_validar_publicacion_caza_un_examen_sin_cifrar(tmp_path):
    """Si alguien publicara el examen en claro, esto es lo último que lo impide."""
    paquete = cripto.cifrar_paquete({"id": "X-1", "partes": []}, cripto.generar_codigos(2),
                                    iter_codigo=1000, meta=META)
    paquete["partes"] = [{"preguntas": [{"enunciado": "¿La respuesta es 42?"}]}]
    fallos = validar_publicacion.validar(_dist(tmp_path, paquete))
    assert any("partes" in f or "enunciado" in f for f in fallos)


def test_validar_publicacion_caza_los_codigos_en_el_sitio(tmp_path):
    dist = _dist(tmp_path)
    (dist / "codigos.csv").write_text("codigo,alumno\n", encoding="utf-8")
    assert any("codigos.csv" in f for f in validar_publicacion.validar(dist))


def test_validar_publicacion_caza_las_fixtures(tmp_path):
    """Son exámenes modelo reales con sus soluciones: no pueden acabar publicados."""
    dist = _dist(tmp_path)
    (dist / "plataforma-examenes/scripts/tests/fixtures").mkdir(parents=True)
    assert any("fixtures" in f for f in validar_publicacion.validar(dist))


def test_validar_publicacion_caza_el_config_del_autor(tmp_path):
    """Con el receptor de otro, las entregas de tus alumnos irían a su Drive."""
    dist = _dist(tmp_path)
    (dist / "plataforma-examenes").mkdir(parents=True, exist_ok=True)
    (dist / "plataforma-examenes/config.json").write_text('{"receptor": "https://otro/exec"}', encoding="utf-8")
    assert any("config.json" in f for f in validar_publicacion.validar(dist))


def test_validar_publicacion_caza_lo_privado(tmp_path):
    dist = _dist(tmp_path)
    (dist / "plataforma-examenes/.privado/DEMO").mkdir(parents=True)
    assert any(".privado" in f for f in validar_publicacion.validar(dist))


def test_validar_publicacion_caza_meta_con_datos_de_mas(tmp_path):
    paquete = cripto.cifrar_paquete({"id": "X-1", "partes": []}, cripto.generar_codigos(2),
                                    iter_codigo=1000, meta={**META, "contrasena": "1234"})
    assert any("meta" in f for f in validar_publicacion.validar(_dist(tmp_path, paquete)))


def test_hoja_de_codigos_lleva_una_papeleta_por_codigo():
    codigos = cripto.generar_codigos(7)
    html = preparar_examen.hoja_codigos({"id": "X"}, META, codigos, "https://ejemplo/?e=X")
    assert html.count('class="papeleta"') == 7
    for c in codigos:
        assert c in html
    assert "1DAM · LMSG · RA1" in html
