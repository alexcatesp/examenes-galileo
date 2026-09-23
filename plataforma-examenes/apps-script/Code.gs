/**
 * Receptor de entregas de la plataforma de exámenes (Google Apps Script).
 *
 * Guarda en Google Drive, bajo la carpeta CARPETA_RAIZ:
 *   <curso>/<grupo>/<SIGLAS>/<RA>/<convocatoria>/<grupo>_<SIGLAS>_<RA>_<CODIGO>.md
 *   …/.autosave/<CODIGO>.json                      autoguardado (cada minuto)
 *   …/<…>_<CODIGO>__<fecha>.md                     entregas anteriores si se reabrió
 *
 * Solo acepta códigos válidos: calcula el localizador del código con la sal del
 * paquete publicado y comprueba que figura en él (igual que la app y
 * scripts/cripto.py; si cambias uno, cambia los tres).
 *
 * El nombre del fichero y la ruta salen del bloque `meta` del paquete publicado,
 * NO de lo que mande el navegador: así nadie puede colocar ficheros donde quiera.
 *
 * También hace de reloj: el examen empieza cuando lo dice este servidor, no el PC
 * del alumno, para que cambiar la hora del equipo no regale tiempo.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script):
 *   URL_PUBLICA   https://alexcatesp.github.io/examenes-galileo/   (obligatoria)
 *   CARPETA_RAIZ  Examenes-Galileo                                  (opcional)
 */

var RE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,60}$/;
var RE_CODIGO = /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/;
var RE_SEGURO = /^[A-Za-z0-9_-]{1,32}$/;
var MAX_MD = 2 * 1024 * 1024;

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.accion !== 'estado') return responder({ ok: true, servicio: 'receptor-examenes' });
    var v = validar(p.examen, p.codigo);
    var carpeta = carpetaExamen(v.meta, false);
    if (carpeta && carpeta.getFilesByName(nombreEntrega(v.meta, v.codigo)).hasNext()) {
      return responder({ ok: true, estado: 'entregado', ahora: Date.now() });
    }
    var auto = carpeta ? leerAutoguardado(carpeta, v.codigo) : null;
    if (!auto) return responder({ ok: true, estado: 'nuevo', ahora: Date.now() });
    return responder({
      ok: true,
      estado: 'en-curso',
      inicio: auto.inicio || null,
      respuestas: auto.respuestas || {},
      ahora: Date.now()
    });
  } catch (err) {
    return responder({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  var cerrojo = LockService.getScriptLock();
  try {
    var datos = JSON.parse(e.postData.contents);
    var v = validar(datos.examen, datos.codigo);
    cerrojo.waitLock(20000);
    var carpeta = carpetaExamen(v.meta, true);
    var ahora = new Date();

    // El servidor fija la hora de inicio la primera vez y la repite a partir de ahi.
    if (datos.accion === 'inicio') {
      var previo = leerAutoguardado(carpeta, v.codigo);
      var inicio = (previo && previo.inicio) || ahora.getTime();
      if (!previo) {
        guardarAutoguardado(carpeta, v.codigo, { inicio: inicio, respuestas: {}, recibido: ahora.toISOString() });
      }
      return responder({ ok: true, inicio: inicio, ahora: ahora.getTime() });
    }

    if (datos.accion === 'autosave') {
      var anterior = leerAutoguardado(carpeta, v.codigo);
      guardarAutoguardado(carpeta, v.codigo, {
        inicio: (anterior && anterior.inicio) || datos.inicio || ahora.getTime(),
        recibido: ahora.toISOString(),
        respuestas: datos.respuestas || {}
      });
      return responder({ ok: true, ahora: ahora.getTime() });
    }

    if (datos.accion === 'final') {
      if (typeof datos.md !== 'string' || !datos.md || datos.md.length > MAX_MD) throw new Error('md no válido');
      var nombre = nombreEntrega(v.meta, v.codigo);
      var previos = carpeta.getFilesByName(nombre);
      while (previos.hasNext()) {
        var antiguo = previos.next();
        var sello = Utilities.formatDate(antiguo.getLastUpdated(), 'Europe/Madrid', 'yyyyMMdd-HHmmss');
        antiguo.setName(nombre.replace(/\.md$/, '') + '__' + sello + '.md');
      }
      carpeta.createFile(nombre, datos.md, MimeType.PLAIN_TEXT);
      return responder({ ok: true, ahora: ahora.getTime() });
    }
    throw new Error('acción desconocida');
  } catch (err) {
    return responder({ ok: false, error: String(err.message || err) });
  } finally {
    try { cerrojo.releaseLock(); } catch (ignorado) {}
  }
}

// ── Validación del código contra el paquete publicado ───────────────────

function validar(examen, codigo) {
  if (!RE_ID.test(String(examen || ''))) throw new Error('examen no válido');
  codigo = String(codigo || '').toUpperCase();
  if (!RE_CODIGO.test(codigo)) throw new Error('código no válido');
  var paquete = datosPaquete(examen, false);
  if (paquete.locs.indexOf(localizador(paquete.sal, codigo)) < 0) {
    // Si el examen se ha vuelto a cifrar, la caché guarda la sal vieja y los
    // códigos nuevos parecerían falsos durante horas. Antes de rechazarlo,
    // se relee el paquete publicado una vez.
    paquete = datosPaquete(examen, true);
    if (paquete.locs.indexOf(localizador(paquete.sal, codigo)) < 0) {
      throw new Error('código no válido para este examen');
    }
  }
  return { codigo: codigo, meta: normalizarMeta(paquete.meta, examen) };
}

/** Todo lo que acaba en una ruta o un nombre de fichero se comprueba aquí. */
function normalizarMeta(meta, examen) {
  meta = meta || {};
  var campos = ['cursoEscolar', 'grupo', 'siglas', 'ra', 'convocatoria'];
  var limpia = {};
  for (var i = 0; i < campos.length; i++) {
    var valor = String(meta[campos[i]] || '');
    if (!valor) return { plana: examen };  // paquete antiguo sin meta: carpeta con el id
    if (!RE_SEGURO.test(valor)) throw new Error('metadatos del examen no válidos');
    limpia[campos[i]] = valor;
  }
  return limpia;
}

function nombreEntrega(meta, codigo) {
  if (meta.plana) return codigo + '.md';
  var partes = [meta.grupo, meta.siglas, meta.ra];
  if (meta.convocatoria !== 'ev_continua') partes.push(meta.convocatoria);
  partes.push(codigo);
  return partes.join('_') + '.md';
}

function normalizar(codigo) {
  return codigo.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

function localizador(salB64, codigo) {
  var firma = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_256,
    Utilities.newBlob(normalizar(codigo)).getBytes(),
    Utilities.base64Decode(salB64)
  );
  var hex = '';
  for (var i = 0; i < 8; i++) hex += ('0' + (firma[i] & 0xff).toString(16)).slice(-2);
  return hex;
}

/** Sal, localizadores y meta del paquete. Se cachean 6 h; `refrescar` salta la caché. */
function datosPaquete(examen, refrescar) {
  var cache = CacheService.getScriptCache();
  var clave = 'paquete2:' + examen;
  if (!refrescar) {
    var guardado = cache.get(clave);
    if (guardado) return JSON.parse(guardado);
  }
  var base = PropertiesService.getScriptProperties().getProperty('URL_PUBLICA');
  if (!base) throw new Error('falta la propiedad URL_PUBLICA');
  var url = base.replace(/\/?$/, '/') + 'examenes/' + examen + '.json';
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('examen no publicado');
  var paquete = JSON.parse(r.getContentText());
  var datos = {
    sal: paquete.sal,
    meta: paquete.meta || {},
    locs: paquete.entradas.map(function (x) { return x.loc; })
  };
  cache.put(clave, JSON.stringify(datos), 21600);
  return datos;
}

// ── Drive ───────────────────────────────────────────────────────────────

function carpetaRaiz() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ID_CARPETA_RAIZ');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (borrada) {}
  }
  var nombre = props.getProperty('CARPETA_RAIZ') || 'Examenes-Galileo';
  var existentes = DriveApp.getRootFolder().getFoldersByName(nombre);
  var carpeta = existentes.hasNext() ? existentes.next() : DriveApp.getRootFolder().createFolder(nombre);
  props.setProperty('ID_CARPETA_RAIZ', carpeta.getId());
  return carpeta;
}

/** <curso>/<grupo>/<SIGLAS>/<RA>/<convocatoria>, creando lo que falte. */
function carpetaExamen(meta, crear) {
  var ruta = meta.plana
    ? [meta.plana]
    : [meta.cursoEscolar, meta.grupo, meta.siglas, meta.ra, meta.convocatoria];
  var actual = carpetaRaiz();
  for (var i = 0; i < ruta.length; i++) {
    var hijas = actual.getFoldersByName(ruta[i]);
    if (hijas.hasNext()) actual = hijas.next();
    else if (crear) actual = actual.createFolder(ruta[i]);
    else return null;
  }
  return actual;
}

function subcarpeta(padre, nombre) {
  var it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function guardarAutoguardado(carpeta, codigo, datos) {
  var auto = subcarpeta(carpeta, '.autosave');
  var nombre = codigo + '.json';
  var contenido = JSON.stringify(datos);
  var it = auto.getFilesByName(nombre);
  if (it.hasNext()) it.next().setContent(contenido);
  else auto.createFile(nombre, contenido, 'application/json');
}

function leerAutoguardado(carpeta, codigo) {
  var it = carpeta.getFoldersByName('.autosave');
  if (!it.hasNext()) return null;
  var f = it.next().getFilesByName(codigo + '.json');
  return f.hasNext() ? JSON.parse(f.next().getBlob().getDataAsString()) : null;
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Ejecútala una vez desde el editor para conceder permisos y comprobar la configuración. */
function comprobarConfiguracion() {
  var base = PropertiesService.getScriptProperties().getProperty('URL_PUBLICA');
  if (!base) throw new Error('Añade la propiedad del script URL_PUBLICA');
  var r = UrlFetchApp.fetch(base, { muteHttpExceptions: true });
  Logger.log('URL_PUBLICA responde %s', r.getResponseCode());
  Logger.log('Carpeta de entregas: %s', carpetaRaiz().getUrl());
}
