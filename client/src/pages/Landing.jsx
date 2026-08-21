import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export default function Landing() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to={user.role === "worker" ? "/mi-perfil" : "/panel"} replace />;
  }

  return (
    <div>
      <div className="hero">
        <h1>Contratá oficios de confianza, con reputación comprobable</h1>
        <p>
          Oficios Validados conecta vecinos con plomeros, electricistas, carpinteros y otros
          profesionales cerca tuyo. Filtrá por zona, comparás reseñas ancladas a trabajos reales
          y coordiná todo por chat interno, sin exponer tu teléfono ni tu email.
        </p>
        <div className="badges">
          <span className="badge">📍 Filtro por zona y distancia</span>
          <span className="badge">⭐ Reseñas ancladas a trabajos reales</span>
          <span className="badge">💬 Chat interno para presupuestar</span>
        </div>
        <div className="row" style={{ marginTop: 24 }}>
          <Link className="btn" to="/login">Ingresar</Link>
          <Link className="btn ghost" to="/registro" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
            Crear cuenta
          </Link>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>¿Buscás contratar un servicio?</h3>
          <p className="muted">
            Explorá el directorio de profesionales validados, filtrá por oficio y distancia, y
            contratá con la tranquilidad de ver reseñas reales de otros vecinos.
          </p>
          <Link className="btn ghost" to="/directorio">Ver directorio</Link>
        </div>
        <div className="card">
          <h3>¿Ofrecés un oficio?</h3>
          <p className="muted">
            Creá tu perfil profesional, sumá tu especialidad y tu zona de cobertura, y empezá a
            recibir contrataciones de clientes cerca de tu ubicación.
          </p>
          <Link className="btn ghost" to="/registro">Registrarme como trabajador</Link>
        </div>
      </div>
    </div>
  );
}
