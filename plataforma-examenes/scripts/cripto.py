"""Códigos de acceso y cifrado de los paquetes de examen.

Debe mantenerse en sincronía con app/src/lib/cripto.ts y apps-script/Code.gs:
cualquier cambio en la normalización, el localizador o la derivación de claves
rompe la compatibilidad con los paquetes ya publicados (sube VERSION_PAQUETE).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

VERSION_PAQUETE = 1

# Crockford base32: sin I, L, O, U para evitar confusiones al teclear.
ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
LONG_CODIGO = 12  # 11 aleatorios + 1 de control
ITER_CODIGO = 310_000  # PBKDF2 por código (coste de cada intento de fuerza bruta)
ITER_DESBLOQUEO = 100_000
LONG_LOC = 8  # bytes del localizador

_EQUIVALENCIAS = str.maketrans({"O": "0", "I": "1", "L": "1"})


def b64(datos: bytes) -> str:
    return base64.b64encode(datos).decode("ascii")


def unb64(texto: str) -> bytes:
    return base64.b64decode(texto)


def normalizar(codigo: str) -> str:
    """Mayúsculas, sin separadores y con O→0, I/L→1."""
    limpio = "".join(c for c in codigo.upper() if c.isalnum())
    return limpio.translate(_EQUIVALENCIAS)


def caracter_control(cuerpo: str) -> str:
    total = sum((i + 1) * ALFABETO.index(c) for i, c in enumerate(cuerpo))
    return ALFABETO[total % 31]


def codigo_valido(codigo: str) -> bool:
    n = normalizar(codigo)
    if len(n) != LONG_CODIGO or any(c not in ALFABETO for c in n):
        return False
    return caracter_control(n[:-1]) == n[-1]


def formatear(codigo: str) -> str:
    n = normalizar(codigo)
    return "-".join(n[i : i + 4] for i in range(0, len(n), 4))


def generar_codigo() -> str:
    cuerpo = "".join(secrets.choice(ALFABETO) for _ in range(LONG_CODIGO - 1))
    return formatear(cuerpo + caracter_control(cuerpo))


def generar_codigos(n: int) -> list[str]:
    codigos: set[str] = set()
    while len(codigos) < n:
        codigos.add(generar_codigo())
    return sorted(codigos)


def localizador(sal: bytes, codigo: str) -> str:
    mac = hmac.new(sal, normalizar(codigo).encode(), hashlib.sha256).digest()
    return mac[:LONG_LOC].hex()


def _pbkdf2(secreto: str, sal: bytes, iteraciones: int) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", secreto.encode(), sal, iteraciones, 32)


def generar_contrasena(longitud: int = 10) -> str:
    # Sin caracteres ambiguos para poder dictarla o teclearla sin errores.
    alfabeto = "abcdefghjkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alfabeto) for _ in range(longitud))


def hash_desbloqueo(contrasena: str) -> dict:
    """La app compara sin distinguir mayúsculas (trim + minúsculas)."""
    contrasena = contrasena.strip().lower()
    sal = secrets.token_bytes(16)
    return {
        "sal": b64(sal),
        "iter": ITER_DESBLOQUEO,
        "hash": b64(_pbkdf2(contrasena, sal, ITER_DESBLOQUEO)),
    }


def cifrar_paquete(
    examen: dict, codigos: list[str], iter_codigo: int = ITER_CODIGO, meta: dict | None = None
) -> dict:
    """Cifrado de sobre: una clave K para el examen, envuelta una vez por código.

    `meta` viaja **sin cifrar**: son los datos con los que el receptor nombra el
    fichero y elige la carpeta de Drive (grupo, siglas, RA, curso y convocatoria).
    Así no tiene que fiarse de lo que le mande el navegador. No revela nada que no
    esté ya en la URL del examen.
    """
    clave = AESGCM.generate_key(bit_length=256)
    sal = secrets.token_bytes(16)
    iv = secrets.token_bytes(12)
    claro = json.dumps(examen, ensure_ascii=False, separators=(",", ":")).encode()
    entradas = []
    for codigo in codigos:
        kek = _pbkdf2(normalizar(codigo), sal, iter_codigo)
        iv_k = secrets.token_bytes(12)
        entradas.append(
            {
                "loc": localizador(sal, codigo),
                "iv": b64(iv_k),
                "clave": b64(AESGCM(kek).encrypt(iv_k, clave, None)),
            }
        )
    entradas.sort(key=lambda e: e["loc"])  # el orden no revela el orden de los códigos
    return {
        "version": VERSION_PAQUETE,
        "id": examen["id"],
        "meta": meta or {},
        "sal": b64(sal),
        "iter": iter_codigo,
        "entradas": entradas,
        "iv": b64(iv),
        "datos": b64(AESGCM(clave).encrypt(iv, claro, None)),
    }


def descifrar_paquete(paquete: dict, codigo: str) -> dict:
    """Inverso de cifrar_paquete (para tests y verificación tras cifrar)."""
    sal = unb64(paquete["sal"])
    loc = localizador(sal, codigo)
    entrada = next((e for e in paquete["entradas"] if e["loc"] == loc), None)
    if entrada is None:
        raise KeyError("Código no válido para este examen")
    kek = _pbkdf2(normalizar(codigo), sal, paquete["iter"])
    clave = AESGCM(kek).decrypt(unb64(entrada["iv"]), unb64(entrada["clave"]), None)
    claro = AESGCM(clave).decrypt(unb64(paquete["iv"]), unb64(paquete["datos"]), None)
    return json.loads(claro)
