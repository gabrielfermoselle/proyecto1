import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
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
          {user && <NavLink to="/panel">Mis contrataciones</NavLink>}
          {user && user.role === "worker" && (
            <NavLink to="/mi-perfil">Mi perfil</NavLink>
          )}
          {!user && <NavLink to="/login">Ingresar</NavLink>}
          {!user && <NavLink to="/registro">Registrarse</NavLink>}
          {user && (
            <>
              <span className="muted" style={{ padding: "0 8px" }}>
                {user.name}
              </span>
              <button onClick={handleLogout}>Salir</button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
