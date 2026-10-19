import { type FormEvent, useState } from 'react';
import { codigoValido, formatear } from '../lib/cripto';
import { traduccionDe } from '../lib/traducciones';
import { formatoPuntos } from '../lib/entrega';
import { IDIOMAS, LOCALE, NOMBRE_IDIOMA, useIdioma } from '../lib/i18n';
import type { Examen } from '../lib/tipos';
import { horaDe } from './VistaExamen';
import { Rico } from './Rico';

export function Tarjeta({ children, ancha = false }: { children: React.ReactNode; ancha?: boolean }) {
  return (
    <main className="fondo">
      <section className={`tarjeta ${ancha ? 'ancha' : ''}`}>{children}</section>
    </main>
  );
}

/** Selector de idioma de la interfaz; cada idioma se nombra en sí mismo. */
export function SelectorIdioma() {
  const { idioma, cambiar, t } = useIdioma();
  return (
    <div className="selector-idioma" role="group" aria-label={t('idioma')}>
      {IDIOMAS.map((i) => (
        <button
          key={i}
          type="button"
          lang={i}
          className={`boton-idioma ${i === idioma ? 'activo' : ''}`}
          aria-pressed={i === idioma}
          onClick={() => cambiar(i)}
        >
          {NOMBRE_IDIOMA[i]}
        </button>
      ))}
    </div>
  );
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'error' | 'ok' | 'alerta'; children: React.ReactNode }) {
  return <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Portada({ idExamen, ocupado, error, alEntrar }: {
  idExamen: string;
  ocupado: boolean;
  error: string | null;
  alEntrar: (codigo: string) => void;
}) {
  const { t } = useIdioma();
  const [codigo, setCodigo] = useState('');
  const [local, setLocal] = useState<string | null>(null);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!codigoValido(codigo)) {
      const util = codigo.replace(/[^0-9A-Za-z]/g, '').length;
      setLocal(util !== 12 ? t('errCodigoLongitud') : t('errCodigoMal'));
      return;
    }
    setLocal(null);
    alEntrar(codigo);
  };

  return (
    <Tarjeta>
      <SelectorIdioma />
      <p className="antetitulo">{t('portadaAntetitulo')}</p>
      <h1>{idExamen}</h1>
      <form onSubmit={enviar} className="formulario">
        <label htmlFor="codigo">{t('codigoAcceso')}</label>
        <input
          id="codigo"
          className="entrada-codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          onBlur={() => codigoValido(codigo) && setCodigo(formatear(codigo))}
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={16}
          autoFocus
          disabled={ocupado}
        />
        <button className="boton primario" disabled={ocupado || !codigo.trim()}>
          {ocupado ? t('abriendo') : t('entrar')}
        </button>
      </form>
      {(local || error) && <Aviso tipo="error">{local ?? error}</Aviso>}
      <p className="nota">{t('notaPortada')}</p>
    </Tarjeta>
  );
}

export function Instrucciones({ examen, error, alEmpezar }: { examen: Examen; error: string | null; alEmpezar: () => void }) {
  const { idioma, t } = useIdioma();
  const trad = traduccionDe(examen, idioma);
  const titulo = (p: Examen['partes'][number]) => trad?.partes?.[p.id] ?? p.titulo;
  const total = examen.partes.reduce((n, p) => n + p.preguntas.length, 0);
  const puntosDe = (p: Examen['partes'][number]) => p.preguntas.reduce((n, q) => n + (q.puntos ?? 0), 0);
  const conPuntos = examen.partes.some((p) => puntosDe(p) > 0);
  return (
    <Tarjeta ancha>
      <SelectorIdioma />
      <p className="antetitulo">{[examen.ciclo, examen.modulo].filter(Boolean).join(' · ')}</p>
      <h1>{trad?.titulo ?? (examen.titulo || examen.id)}</h1>
      {examen.raTexto && <p className="ra"><strong>{examen.ra}:</strong> {trad?.raTexto ?? examen.raTexto}</p>}
      <ul className="datos">
        {examen.fin ? (
          <li>
            <Rico texto={t('terminaA', {
              h: horaDe(examen.fin),
              f: new Date(examen.fin).toLocaleDateString(LOCALE[idioma], { day: 'numeric', month: 'long' }),
            })} />
          </li>
        ) : (
          <li><Rico texto={t('duracionDesde', { n: examen.duracion })} /></li>
        )}
        <li><Rico texto={t('preguntasEnPartes', { n: total, p: examen.partes.length })} /></li>
      </ul>
      {idioma !== 'es' && <Aviso tipo="info">{trad ? t('avisoTraduccion') : t('sinTraduccion')}</Aviso>}
      {conPuntos && (
        <>
          <h2>{t('cuantoVale')}</h2>
          <table className="tabla-puntos">
            <tbody>
              {examen.partes.map((p) => (
                <tr key={p.id}>
                  <td>{titulo(p)}</td>
                  <td>{p.preguntas.length} {p.preguntas.length === 1 ? t('unaPregunta') : t('variasPreguntas')}</td>
                  <td><Rico texto={t('puntosN', { n: formatoPuntos(puntosDe(p)) })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nota">{t('notaPuntos')}</p>
        </>
      )}
      <h2>{t('normas')}</h2>
      <ol className="normas">
        {(['norma1', 'norma2', 'norma3', 'norma4', 'norma5', 'norma6', ...(idioma !== 'es' ? ['normaIdioma' as const] : [])] as const).map((k) => (
          <li key={k}><Rico texto={t(k)} /></li>
        ))}
      </ol>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <button className="boton primario grande" onClick={alEmpezar}>{t('empezar')}</button>
    </Tarjeta>
  );
}

/** Pide la contraseña del profesor (bloqueo, reanudación o reapertura). */
export function PedirContrasena({ titulo, texto, boton, error, ocupado, alEnviar, secundario }: {
  titulo: string;
  texto: React.ReactNode;
  boton: string;
  error: string | null;
  ocupado: boolean;
  alEnviar: (contrasena: string) => void;
  secundario?: React.ReactNode;
}) {
  const { t } = useIdioma();
  const [contrasena, setContrasena] = useState('');
  return (
    <div className="capa-bloqueo" role="dialog" aria-modal="true">
      <div className="tarjeta bloqueo">
        <div className="icono-candado" aria-hidden>🔒</div>
        <h1>{titulo}</h1>
        <div className="texto-bloqueo">{texto}</div>
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault();
            alEnviar(contrasena);
            setContrasena('');
          }}
        >
          <label htmlFor="contrasena">{t('contrasenaProfesor')}</label>
          <input id="contrasena" type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="off" autoFocus disabled={ocupado} />
          <button className="boton primario" disabled={ocupado || !contrasena}>{ocupado ? t('comprobando') : boton}</button>
        </form>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {secundario}
      </div>
    </div>
  );
}
