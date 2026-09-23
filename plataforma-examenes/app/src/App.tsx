import { useCallback, useEffect, useRef, useState } from 'react';
import { Aviso, Instrucciones, PedirContrasena, Portada, Tarjeta } from './componentes/Pantallas';
import { formatoReloj, VistaExamen } from './componentes/VistaExamen';
import { entrarPantallaCompleta, salirPantallaCompleta, useSinPortapapeles, useVigilancia } from './lib/antitrampa';
import { ordenAlumno, type PreguntaVista } from './lib/barajar';
import { abrirPaquete, CodigoNoValido, contrasenaCorrecta, esPaquete, formatear, semilla } from './lib/cripto';
import { descargar, generarMd, nombreFichero } from './lib/entrega';
import { cargar, guardar } from './lib/persistencia';
import { consultarEstado, desfaseDe, enviar, marcarInicio } from './lib/receptor';
import type { Config, Estado, Examen, Paquete, Respuesta } from './lib/tipos';

type Fase = 'cargando' | 'error' | 'portada' | 'instrucciones' | 'reanudar' | 'examen' | 'entregado' | 'cerrado';

const ID_EXAMEN = new URLSearchParams(location.search).get('e')?.trim() ?? '';
const AUTOGUARDADO_MS = 60_000;

export default function App() {
  const [fase, setFase] = useState<Fase>('cargando');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [config, setConfig] = useState<Config>({});
  const [paquete, setPaquete] = useState<Paquete | null>(null);
  const [examen, setExamen] = useState<Examen | null>(null);
  const [vista, setVista] = useState<PreguntaVista[]>([]);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [reabrir, setReabrir] = useState(false);
  const [ahora, setAhora] = useState(Date.now());
  const ultimoAutoguardado = useRef('');

  const enExamen = fase === 'examen';
  const faseActual = useRef(fase);
  faseActual.current = fase;
  useSinPortapapeles(enExamen || fase === 'reanudar');
  // La guarda con la fase evita bloqueos espurios al entregar (descarga, salida de pantalla completa).
  useVigilancia(enExamen && !bloqueado, () => faseActual.current === 'examen' && setBloqueado(true));

  // ── Carga del paquete ────────────────────────────────────────────────
  useEffect(() => {
    if (!/^[\w-]{3,61}$/.test(ID_EXAMEN)) {
      setError('Falta el identificador del examen en la dirección (…/?e=ID). Pide el enlace a tu profesor.');
      setFase('error');
      return;
    }
    (async () => {
      const cfg = await fetch('config.json', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}));
      setConfig(cfg);
      // Un sitio estático puede responder 200 con su propia página cuando el
      // fichero no existe, así que no basta con mirar el código de estado.
      let descargado: unknown = null;
      try {
        const r = await fetch(`examenes/${ID_EXAMEN}.json`, { cache: 'no-store' });
        if (r.ok) descargado = await r.json();
      } catch {
        descargado = null;
      }
      if (!esPaquete(descargado)) {
        setError(
          navigator.onLine === false
            ? 'No hay conexión. Avisa a tu profesor.'
            : `No existe ningún examen con el identificador «${ID_EXAMEN}», o ya no está disponible. Comprueba el enlace con tu profesor.`,
        );
        setFase('error');
        return;
      }
      setPaquete(descargado);
      setFase('portada');
    })();
  }, []);

  // ── Guardado local en cada cambio y autoguardado remoto periódico ────
  useEffect(() => {
    if (estado) guardar(estado);
  }, [estado]);

  // El autoguardado aprovecha para resincronizar el reloj con el del receptor,
  // así un cambio de hora en el equipo se corrige en menos de un minuto.
  //
  // El estado se lee de una ref a propósito: si el efecto dependiera de `estado`,
  // cada tecla reiniciaría el intervalo y un alumno que escribe sin parar no
  // llegaría a autoguardar nunca, que es justo cuando más falta hace.
  const estadoRef = useRef<Estado | null>(estado);
  estadoRef.current = estado;
  useEffect(() => {
    if (!enExamen || !config.receptor) return;
    const t = setInterval(async () => {
      const e = estadoRef.current;
      if (!e || e.entregado) return;
      const actual = JSON.stringify(e.respuestas);
      if (actual === ultimoAutoguardado.current) return;
      ultimoAutoguardado.current = actual;
      const { desfase } = await enviar(
        config.receptor!,
        { accion: 'autosave', examen: e.id, codigo: e.codigo, inicio: e.inicio, respuestas: e.respuestas },
        1,
      );
      if (desfase !== null) setEstado((s) => s && { ...s, desfase });
    }, AUTOGUARDADO_MS);
    return () => clearInterval(t);
  }, [enExamen, config.receptor]);

  // ── Reloj ────────────────────────────────────────────────────────────
  const desfase = estado?.desfase ?? 0;
  const relojVisible = enExamen || fase === 'reanudar' || fase === 'entregado';
  useEffect(() => {
    if (!relojVisible) return;
    setAhora(Date.now() + desfase);
    const t = setInterval(() => setAhora(Date.now() + desfase), 500);
    return () => clearInterval(t);
  }, [relojVisible, desfase]);

  const fin = estado?.inicio && examen ? estado.inicio + examen.duracion * 60_000 : Infinity;
  const restante = fin - ahora;

  const entregar = useCallback(
    async (automatica: boolean) => {
      if (!examen || !estado || estado.entregado) return;
      const momento = Math.min(Date.now() + desfase, fin);
      const md = generarMd(examen, estado, momento, automatica);
      const final: Estado = { ...estado, entregado: { fecha: momento, md, automatica } };
      setEstado(final);
      guardar(final);
      faseActual.current = 'entregado';
      setBloqueado(false);
      setFase('entregado');
      salirPantallaCompleta();
      descargar(nombreFichero(examen, estado.codigo), md);
      if (!config.receptor) return;
      // Los reintentos van por dentro: el alumno no tiene que saber que esto existe.
      await enviar(
        config.receptor,
        { accion: 'final', examen: examen.id, codigo: estado.codigo, inicio: estado.inicio, respuestas: estado.respuestas, md },
        4,
      );
    },
    [examen, estado, fin, config.receptor, desfase],
  );

  useEffect(() => {
    if (enExamen && restante <= 0) entregar(true);
  }, [enExamen, restante, entregar]);

  // ── Acciones ─────────────────────────────────────────────────────────
  const entrarConCodigo = async (codigo: string) => {
    if (!paquete) return;
    setOcupado(true);
    setError(null);
    try {
      const { examen: ex, loc } = await abrirPaquete(paquete, codigo);
      setExamen(ex);
      setVista(ordenAlumno(ex, await semilla(ex.id, codigo)));
      const antes = Date.now();
      const local = cargar(ex.id, loc);
      const remoto = config.receptor ? await consultarEstado(config.receptor, ex.id, codigo) : null;
      const desfaseRemoto = desfaseDe(remoto?.ahora, antes) ?? local?.desfase ?? 0;
      const nuevo: Estado = { id: ex.id, loc, codigo, inicio: null, desfase: desfaseRemoto, respuestas: {}, marcadas: [], actual: 0, entregado: null };
      if (local?.entregado) {
        setEstado({ ...local, desfase: desfaseRemoto });
        setFase('entregado');
      } else if (remoto?.estado === 'entregado') {
        setEstado(nuevo);
        setFase('cerrado');
      } else if (remoto?.estado === 'en-curso') {
        // Permite continuar en otro equipo si el suyo muere: se queda con el juego de
        // respuestas más completo, el de Drive o el de este navegador.
        const remotas = remoto.respuestas ?? {};
        const locales = local?.respuestas ?? {};
        setEstado({
          ...(local ?? nuevo),
          desfase: desfaseRemoto,
          inicio: remoto.inicio ?? local?.inicio ?? Date.now() + desfaseRemoto,
          respuestas: Object.keys(remotas).length >= Object.keys(locales).length ? remotas : locales,
        });
        setFase('reanudar');
      } else if (local?.inicio) {
        setEstado({ ...local, desfase: desfaseRemoto });
        setFase('reanudar');
      } else {
        setEstado(local ? { ...local, desfase: desfaseRemoto } : nuevo);
        setFase('instrucciones');
      }
    } catch (e) {
      setError(e instanceof CodigoNoValido ? 'Este código no sirve para este examen. Compruébalo con tu profesor.' : 'No se ha podido abrir el examen.');
    } finally {
      setOcupado(false);
    }
  };

  const empezar = async () => {
    if (!(await entrarPantallaCompleta())) {
      setError('No se ha podido activar la pantalla completa. Usa Chrome o Edge y vuelve a intentarlo.');
      return;
    }
    setError(null);
    // La hora de inicio la fija el receptor; si no hay red, se usa la del equipo.
    const remoto = estado && config.receptor ? await marcarInicio(config.receptor, estado.id, estado.codigo) : null;
    setEstado((e) => {
      if (!e) return e;
      const desfaseNuevo = remoto?.desfase ?? e.desfase;
      return { ...e, desfase: desfaseNuevo, inicio: e.inicio ?? remoto?.inicio ?? Date.now() + desfaseNuevo };
    });
    setAhora(Date.now() + (remoto?.desfase ?? estado?.desfase ?? 0));
    setFase('examen');
  };

  /** Comprueba la contraseña del profesor y vuelve al examen en pantalla completa. */
  const conContrasena = async (contrasena: string, alAcertar: () => void) => {
    if (!examen) return;
    setOcupado(true);
    setError(null);
    const ok = await contrasenaCorrecta(examen, contrasena);
    setOcupado(false);
    if (!ok) return setError('Contraseña incorrecta.');
    if (!(await entrarPantallaCompleta())) return setError('No se ha podido volver a pantalla completa. Inténtalo de nuevo.');
    alAcertar();
    setAhora(Date.now());
  };

  const responder = useCallback((id: string, r: Respuesta) => {
    setEstado((e) => e && { ...e, respuestas: { ...e.respuestas, [id]: r } });
  }, []);
  const mover = useCallback((actual: number) => setEstado((e) => e && { ...e, actual }), []);
  const marcar = useCallback((id: string) => {
    setEstado((e) => e && { ...e, marcadas: e.marcadas.includes(id) ? e.marcadas.filter((m) => m !== id) : [...e.marcadas, id] });
  }, []);

  // ── Pantallas ────────────────────────────────────────────────────────
  if (fase === 'cargando') return <Tarjeta><p>Cargando examen…</p></Tarjeta>;
  if (fase === 'error') return <Tarjeta><h1>Examen no disponible</h1><Aviso tipo="error">{error}</Aviso></Tarjeta>;
  if (fase === 'portada') return <Portada idExamen={ID_EXAMEN} ocupado={ocupado} error={error} alEntrar={entrarConCodigo} />;
  if (!examen || !estado) return null;

  if (fase === 'instrucciones') return <Instrucciones examen={examen} error={error} alEmpezar={empezar} />;

  if (fase === 'cerrado') {
    return (
      <Tarjeta>
        <h1>Examen ya entregado</h1>
        <p>El código <strong>{formatear(estado.codigo)}</strong> ya se usó para entregar este examen.</p>
        <p>Si crees que es un error, avisa a tu profesor.</p>
      </Tarjeta>
    );
  }

  if (fase === 'reanudar') {
    const agotado = restante <= 0;
    return (
      <PedirContrasena
        titulo="Reanudar examen"
        texto={<>
          <p>Este examen ya estaba empezado. Para continuar, llama al profesor.</p>
          <p>Tiempo restante: <strong>{agotado ? 'agotado' : formatoReloj(restante)}</strong></p>
        </>}
        boton="Reanudar"
        error={error}
        ocupado={ocupado}
        alEnviar={(c) => conContrasena(c, () => (agotado ? entregar(true) : setFase('examen')))}
      />
    );
  }

  if (fase === 'entregado') {
    const entregado = estado.entregado!;
    // Al alumno solo se le habla de Teams: si cree que ya está todo hecho, se salta
    // la subida y perdemos la copia el día que falle la red. La copia del centro es
    // cosa del profesor y no se menciona aquí (ver README, «El mensaje de entrega»).
    return (
      <Tarjeta>
        <p className="antetitulo">{examen.id}</p>
        <h1>Examen terminado</h1>
        {entregado.automatica && <Aviso tipo="alerta">Se acabó el tiempo: el examen se cerró automáticamente.</Aviso>}
        <Aviso tipo="alerta">
          Te falta un paso: <strong>sube el fichero descargado a la tarea de Teams</strong> del examen.
          Hasta que no lo subas, tu examen no está entregado.
        </Aviso>
        <p>Se ha descargado <code>{nombreFichero(examen, estado.codigo)}</code>, normalmente en tu carpeta de Descargas.</p>
        <div className="navegacion">
          <button className="boton primario" onClick={() => descargar(nombreFichero(examen, estado.codigo), entregado.md)}>Descargar de nuevo</button>
          <button className="boton discreto" onClick={() => { setError(null); setReabrir(true); }}>Reabrir (profesor)</button>
        </div>
        {reabrir && (
          <PedirContrasena
            titulo="Reabrir examen"
            texto={<p>{restante > 0 ? <>Quedan <strong>{formatoReloj(restante)}</strong>. El alumno podrá seguir y tendrá que volver a entregar.</> : 'El tiempo del examen está agotado: no se puede reabrir.'}</p>}
            boton="Reabrir"
            error={error}
            ocupado={ocupado}
            alEnviar={(c) => restante > 0 ? conContrasena(c, () => {
              setEstado({ ...estado, entregado: null });
              setBloqueado(false);
              setReabrir(false);
              setFase('examen');
            }) : setError('Tiempo agotado.')}
            secundario={<button className="boton discreto" onClick={() => setReabrir(false)}>Cancelar</button>}
          />
        )}
      </Tarjeta>
    );
  }

  return (
    <>
      <VistaExamen
        examen={examen}
        vista={vista}
        estado={estado}
        restante={restante}
        alResponder={responder}
        alMover={mover}
        alMarcar={marcar}
        alEntregar={() => entregar(false)}
      />
      {bloqueado && (
        <PedirContrasena
          titulo="Examen bloqueado"
          texto={<>
            <p>Has salido del examen (cambio de ventana, de pestaña o de pantalla completa).</p>
            <p>Llama al profesor para continuar. El tiempo sigue corriendo: <strong>{formatoReloj(restante)}</strong></p>
          </>}
          boton="Desbloquear"
          error={error}
          ocupado={ocupado}
          alEnviar={(c) => conContrasena(c, () => setBloqueado(false))}
        />
      )}
    </>
  );
}
