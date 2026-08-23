import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

const OFICIOS = [
  { name: "Plomería", desc: "Canillas, caños, calefones y todo lo que gotea o no debería." },
  { name: "Electricidad", desc: "Instalaciones, tableros, cortocircuitos y matriculados." },
  { name: "Carpintería", desc: "Muebles a medida, aberturas, reparaciones de madera." },
  { name: "Pintura", desc: "Interiores, exteriores, frentes y trabajos de terminación." }
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="showcase">
      <section className="storefront">
        <div className="storefront-sign">
          <div className="storefront-kicker">Directorio &amp; contratación de oficios de barrio</div>
          <h1>Oficios Validados</h1>
          <p className="lede">
            La confianza no se promete, se mide. Encontrá plomeros, electricistas, carpinteros y
            pintores cerca tuyo, con reputación comprobable por trabajos reales — no por
            recomendaciones truchas.
          </p>
          <div className="storefront-rubros">
            <span>Plomería</span>
            <span>Electricidad</span>
            <span>Carpintería</span>
            <span>Pintura</span>
          </div>
          <div className="storefront-cta">
            <Link to="/directorio" className="btn gold">Buscar un oficial cerca tuyo</Link>
            {!user && (
              <Link to="/registro" className="btn ghost">
                Ofrezco mi oficio
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="showcase-band">
        <div className="showcase-inner">
          <h2 className="showcase-heading">Tres garantías, no tres promesas</h2>
          <p className="showcase-sub">
            Cada pilar de la plataforma existe para resolver la falta de transparencia al
            contratar un servicio para tu casa.
          </p>
          <div className="trust-grid">
            <div className="trust-plate">
              <div className="seal">📐</div>
              <h3>Distancia real, no "cerca tuyo"</h3>
              <p>
                Filtrá por zona de cobertura y distancia calculada con tu ubicación real sobre
                un mapa interactivo, nunca un cálculo aproximado.
              </p>
            </div>
            <div className="trust-plate">
              <div className="seal">✓</div>
              <h3>Reseña anclada a un trabajo real</h3>
              <p>
                Solo puede reseñar a un oficial quien tuvo una contratación marcada como
                completada con él, y una única vez. Nada de estrellas infladas.
              </p>
            </div>
            <div className="trust-plate">
              <div className="seal">💬</div>
              <h3>Chat privado, nunca tu teléfono</h3>
              <p>
                Acordá presupuesto y detalles por el chat interno de la contratación. Tu email
                y tu número no se comparten hasta que vos decidís.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="showcase-band">
        <div className="showcase-inner">
          <h2 className="showcase-heading">Un historial que se ve, no que se afirma</h2>
          <p className="showcase-sub">
            Así queda el historial de un oficial en su perfil: cada trabajo completado deja una
            marca con fecha, imposible de fabricar. (Ejemplo ilustrativo.)
          </p>
          <div className="patch-row">
            <div className="patch">
              <div className="stitch-date">12 feb 2026</div>
              <div className="stitch-title">Arreglo de canilla</div>
              <div className="stitch-who">Zona Palermo · completado</div>
            </div>
            <div className="patch">
              <div className="stitch-date">28 ene 2026</div>
              <div className="stitch-title">Tablero eléctrico</div>
              <div className="stitch-who">Zona Villa Crespo · completado</div>
            </div>
            <div className="patch">
              <div className="stitch-date">14 ene 2026</div>
              <div className="stitch-title">Mueble a medida</div>
              <div className="stitch-who">Zona Almagro · completado</div>
            </div>
            <div className="patch">
              <div className="stitch-date">03 ene 2026</div>
              <div className="stitch-title">Pintura de frente</div>
              <div className="stitch-who">Zona Caballito · completado</div>
            </div>
          </div>
        </div>
      </section>

      <section className="showcase-band">
        <div className="showcase-inner">
          <h2 className="showcase-heading">Rubros disponibles</h2>
          <p className="showcase-sub">Empezá por el oficio que necesitás.</p>
          <div className="oficio-grid">
            {OFICIOS.map((o) => (
              <Link to={`/directorio?oficio=${encodeURIComponent(o.name)}`} className="oficio-window" key={o.name}>
                <div className="oficio-name">{o.name}</div>
                <p>{o.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="showcase-band">
        <div className="showcase-inner">
          <div className="chalkboard">
            <h2>¿Tenés un oficio? Sumate al directorio.</h2>
            <p>Registrate, fijá tu zona de cobertura y empezá a recibir solicitudes reales.</p>
            <Link to={user ? "/mi-perfil" : "/registro"} className="btn gold">
              {user ? "Completar mi perfil" : "Registrar mi oficio"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
