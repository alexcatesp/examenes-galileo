import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cripto  # noqa: E402
import preparar_examen  # noqa: E402
import traducciones  # noqa: E402

META = {"ra": "RA1", "grupo": "1DAM", "siglas": "LMSG", "cursoEscolar": "2026-27", "convocatoria": "ev_continua"}
CODIGO = "```java\nint x = 1; // contador\n```"


def _examen() -> dict:
    return {"id": "TRAD-1", "duracion": 30, "titulo": "Examen", "raTexto": "Reconoce", **META, "partes": [
        {"id": "A", "titulo": "Test", "preguntas": [
            {"id": "A1", "tipo": "unica", "enunciado": "¿Qué es XML?", "opciones": [
                {"letra": "a", "texto": "Un lenguaje"}, {"letra": "b", "texto": "Un editor"}]}]},
        {"id": "B", "titulo": "Código", "preguntas": [
            {"id": "B1", "tipo": "codigo", "lenguaje": "java", "soloCodigo": True,
             "enunciado": f"Completa el código:\n\n{CODIGO}\n\nUsa `x`.", "opciones": []}]},
    ]}


def _traduccion(examen: dict) -> dict:
    t = traducciones.plantilla(examen, "en")
    t["preguntas"]["A1"] = {"enunciado": "What is XML?", "opciones": {"a": "A language", "b": "An editor"}}
    t["preguntas"]["B1"] = {"enunciado": f"Complete the code:\n\n{CODIGO}\n\nUse `x`."}
    return t


def test_la_plantilla_trae_todas_las_preguntas_y_opciones():
    t = traducciones.plantilla(_examen(), "tr")
    assert t["idioma"] == "tr" and set(t["preguntas"]) == {"A1", "B1"}
    assert t["preguntas"]["A1"]["opciones"] == {"a": "Un lenguaje", "b": "Un editor"}
    assert "opciones" not in t["preguntas"]["B1"]


def test_idioma_no_previsto():
    with pytest.raises(traducciones.ErrorTraduccion):
        traducciones.plantilla(_examen(), "de")


def test_una_traduccion_correcta_no_da_errores():
    errores, avisos = traducciones.validar(_examen(), _traduccion(_examen()))
    assert errores == [] and avisos == []


def test_faltan_preguntas_y_opciones_son_errores():
    t = _traduccion(_examen())
    del t["preguntas"]["B1"]
    t["preguntas"]["A1"]["opciones"] = {"a": "A language"}
    t["preguntas"]["Z9"] = {"enunciado": "?"}
    errores, _ = traducciones.validar(_examen(), t)
    texto = "\n".join(errores)
    assert "B1: falta" in texto and "A1: las opciones" in texto and "Z9" in texto


def test_el_codigo_que_cambia_es_un_aviso():
    t = _traduccion(_examen())
    t["preguntas"]["B1"]["enunciado"] = "Complete:\n\n```java\nint y = 2;\n```\n\nUse `y`."
    errores, avisos = traducciones.validar(_examen(), t)
    assert errores == [] and len(avisos) == 2


def test_enunciado_sin_traducir_es_un_aviso():
    t = _traduccion(_examen())
    t["preguntas"]["A1"]["enunciado"] = "¿Qué es XML? ¿Qué es XML? ¿Qué es XML? ¿Qué es XML?"
    ex = _examen()
    ex["partes"][0]["preguntas"][0]["enunciado"] = t["preguntas"]["A1"]["enunciado"]
    _, avisos = traducciones.validar(ex, t)
    assert any("sin traducir" in a for a in avisos)


def test_la_huella_cambia_con_el_texto_y_no_con_su_propio_campo():
    t = _traduccion(_examen())
    h = traducciones.huella(t)
    assert traducciones.huella({**t, "sha256": "otra"}) == h
    t["preguntas"]["A1"]["enunciado"] = "What is XML??"
    assert traducciones.huella(t) != h


def test_cargar_exige_que_el_nombre_coincida_con_el_idioma(tmp_path):
    (tmp_path / "traducciones").mkdir()
    (tmp_path / "traducciones" / "fr.json").write_text(json.dumps(_traduccion(_examen())), encoding="utf-8")
    with pytest.raises(traducciones.ErrorTraduccion):
        traducciones.cargar(_examen(), tmp_path)


def test_cli_las_traducciones_viajan_cifradas_con_su_huella(tmp_path, monkeypatch):
    monkeypatch.setattr(preparar_examen, "PRIVADO", tmp_path / ".privado")
    monkeypatch.setattr(preparar_examen, "PUBLICADOS", tmp_path / "examenes")
    monkeypatch.setattr(preparar_examen, "BASE", tmp_path)
    examen = _examen()
    carpeta = tmp_path / ".privado" / "TRAD-1"
    carpeta.mkdir(parents=True)
    (carpeta / "examen.json").write_text(json.dumps(examen), encoding="utf-8")
    assert preparar_examen.main(["traducir", "TRAD-1", "--idioma", "en"]) == 0
    assert preparar_examen.main(["traducir", "TRAD-1", "--idioma", "en"]) == 1  # no pisa lo traducido
    (carpeta / "traducciones" / "en.json").write_text(json.dumps(_traduccion(examen)), encoding="utf-8")
    assert preparar_examen.main(["comprobar-traducciones", "TRAD-1"]) == 0
    assert preparar_examen.main(["cifrar", "TRAD-1", "--codigos", "2", "--iter", "1000"]) == 0
    codigo = (carpeta / "codigos.csv").read_text().splitlines()[1].split(",")[0]
    descifrado = cripto.descifrar_paquete(json.loads((tmp_path / "examenes/TRAD-1.json").read_text()), codigo)
    assert descifrado["traducciones"]["en"]["preguntas"]["A1"]["enunciado"] == "What is XML?"
    assert len(descifrado["traducciones"]["en"]["sha256"]) == 64
    assert "idioma" not in descifrado["traducciones"]["en"]
    publicado = (tmp_path / "examenes/TRAD-1.json").read_text()
    assert "What is XML" not in publicado  # van dentro del paquete cifrado
    assert "en (" in (carpeta / "ficha-profesor.md").read_text()
