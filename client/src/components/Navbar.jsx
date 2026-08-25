import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function confirmLogout() {
    setConfirmOpen(false);
    logout();
    navigate("/");
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="brand">
          <span className="dot">✓</span> Oficios Validados
        </NavLink>
        <div className="nav-links">
          <NavLink to="/directorio">
            Directorio
          </NavLink>
          {user && (
            <NavLink to="/panel">{user.role === "plomero" ? "Pedidos recibidos" : "Mis pedidos"}</NavLink>
          )}
          {user && user.role === "plomero" && (
            <NavLink to="/mi-perfil-plomero">Mi perfil</NavLink>
          )}
          {!user && <NavLink to="/login">Ingresar</NavLink>}
          {!user && <NavLink to="/registro">Registrarse</NavLink>}
          {user && (
            <>
              <span className="muted" style={{ padding: "0 8px" }}>
                {user.name}
              </span>
              <button onClick={() => setConfirmOpen(true)}>Salir</button>
            </>
          )}
        </div>
      </div>
      {confirmOpen && (
        <ConfirmDialog
          title="¿Seguro que querés cerrar sesión?"
          message="Vas a tener que ingresar de nuevo tu email y contraseña para volver a entrar."
          confirmLabel="Cerrar sesión"
          cancelLabel="Cancelar"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirmLogout}
        />
      )}
    </nav>
  );
}
