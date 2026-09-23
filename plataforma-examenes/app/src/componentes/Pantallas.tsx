import { type FormEvent, useState } from 'react';
import { codigoValido, formatear } from '../lib/cripto';
import { formatoPuntos } from '../lib/entrega';
import type { Examen } from '../lib/tipos';

export function Tarjeta({ children, ancha = false }: { children: React.ReactNode; ancha?: boolean }) {
  return (
    <main className="fondo">
      <section className={`tarjeta ${ancha ? 'ancha' : ''}`}>{children}</section>
    </main>
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
  const [codigo, setCodigo] = useState('');
  const [local, setLocal] = useState<string | null>(null);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!codigoValido(codigo)) {
      const util = codigo.replace(/[^0-9A-Za-z]/g, '').length;
      setLocal(
        util !== 12
          ? 'Aquí va el código de acceso del alumno (12 caracteres, p. ej. K7FM-2QXR-9TPA). La contraseña del profesor se pide solo si el examen se bloquea.'
          : 'El código no es correcto. Revisa que lo has tecleado bien.',
      );
      return;
    }
    setLocal(null);
    alEntrar(codigo);
  };

  return (
    <Tarjeta>
      <p className="antetitulo">IES Galileo · Examen</p>
      <h1>{idExamen}</h1>
      <form onSubmit={enviar} className="formulario">
        <label htmlFor="codigo">Código de acceso</label>
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
          {ocupado ? 'Abriendo…' : 'Entrar'}
        </button>
      </form>
      {(local || error) && <Aviso tipo="error">{local ?? error}</Aviso>}
      <p className="nota">Tu profesor te dará un código de acceso. No escribas tu nombre en ningún sitio del examen.</p>
    </Tarjeta>
  );
}

export function Instrucciones({ examen, error, alEmpezar }: { examen: Examen; error: string | null; alEmpezar: () => void }) {
  const total = examen.partes.reduce((n, p) => n + p.preguntas.length, 0);
  const puntosDe = (p: Examen['partes'][number]) => p.preguntas.reduce((n, q) => n + (q.puntos ?? 0), 0);
  const conPuntos = examen.partes.some((p) => puntosDe(p) > 0);
  return (
    <Tarjeta ancha>
      <p className="antetitulo">{[examen.ciclo, examen.modulo].filter(Boolean).join(' · ')}</p>
      <h1>{examen.titulo || examen.id}</h1>
      {examen.raTexto && <p className="ra"><strong>{examen.ra}:</strong> {examen.raTexto}</p>}
      <ul className="datos">
        <li><strong>{examen.duracion} min</strong> de duración</li>
        <li><strong>{total}</strong> preguntas en {examen.partes.length} partes</li>
      </ul>
      {conPuntos && (
        <>
          <h2>Cuánto vale cada parte</h2>
          <table className="tabla-puntos">
            <tbody>
              {examen.partes.map((p) => (
                <tr key={p.id}>
                  <td>{p.titulo}</td>
                  <td>{p.preguntas.length} {p.preguntas.length === 1 ? 'pregunta' : 'preguntas'}</td>
                  <td><strong>{formatoPuntos(puntosDe(p))}</strong> puntos</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nota">
            Cada pregunta lleva escrito lo que suma, sobre 10. No todas valen igual: depende del
            criterio que evalúa y de su nivel.
          </p>
        </>
      )}
      <h2>Normas</h2>
      <ol className="normas">
        <li>El examen se hace en <strong>pantalla completa</strong>. Si sales de ella, cambias de ventana o de pestaña, <strong>el examen se bloquea</strong> y tendrá que desbloquearlo el profesor.</li>
        <li>No se puede copiar ni pegar.</li>
        <li><strong>No escribas tu nombre</strong> ni nada que te identifique en ninguna respuesta. Tu examen se identifica solo con tu código.</li>
        <li>Tus respuestas se guardan solas. Puedes moverte libremente entre preguntas.</li>
        <li>Cuando se acabe el tiempo, el examen se entrega automáticamente.</li>
        <li>Al entregar se descargará un fichero <code>.md</code>: súbelo también a la tarea de Teams.</li>
      </ol>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <button className="boton primario grande" onClick={alEmpezar}>Empezar el examen</button>
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
          <label htmlFor="contrasena">Contraseña del profesor</label>
          <input id="contrasena" type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="off" autoFocus disabled={ocupado} />
          <button className="boton primario" disabled={ocupado || !contrasena}>{ocupado ? 'Comprobando…' : boton}</button>
        </form>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {secundario}
      </div>
    </div>
  );
}
