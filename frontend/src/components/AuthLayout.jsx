import { Link } from "react-router-dom";
import { CheckIcon } from "./Icons.jsx";

const BENEFITS = [
  "Reseñas ancladas a trabajos reales, sin valoraciones truchas",
  "Chat interno para presupuestar sin exponer tu teléfono o email",
  "Filtro por zona y distancia con mapa interactivo"
];

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <Link to="/" className="auth-brand-logo">
            <span className="dot" /> Oficios Validados
          </Link>
          <div className="auth-brand-body">
            <div>
              <h1>Contratá y ofrecé oficios con confianza</h1>
              <p>
                La plataforma que conecta vecinos con plomeros, electricistas, carpinteros y otros
                profesionales validados por trabajos reales, no por recomendaciones dudosas.
              </p>
            </div>
            <ul className="auth-benefits">
              {BENEFITS.map((b) => (
                <li key={b}>
                  <CheckIcon />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="auth-form">
          <h2>{title}</h2>
          {subtitle && <p className="sub">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
