import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { HamburgerIcon, CloseIcon } from "./Icons.jsx";

const linkCls = ({ isActive }) =>
  `block rounded-full px-4 py-2.5 text-[15px] font-semibold tracking-wide transition-colors ${
    isActive
      ? "bg-[var(--gold)] text-[var(--ground)]"
      : "text-[var(--muted-on-dark)] hover:bg-white/10 hover:text-[var(--gold-bright)]"
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Cerrar el drawer con Escape y bloquear el scroll del body mientras está abierto
  // (mismo tratamiento que los modales, para que se sienta consistente en mobile).
  useEffect(() => {
    if (!menuOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function confirmLogout() {
    setConfirmOpen(false);
    setMenuOpen(false);
    logout();
    navigate("/");
  }

  const navItems = (
    <>
      <NavLink to="/directorio" className={linkCls} onClick={() => setMenuOpen(false)}>
        Directorio
      </NavLink>
      {user && (
        <NavLink to="/panel" className={linkCls} onClick={() => setMenuOpen(false)}>
          {user.role === "plomero" ? "Pedidos recibidos" : "Mis pedidos"}
        </NavLink>
      )}
      {user && user.role === "plomero" && (
        <NavLink to="/mi-perfil-plomero" className={linkCls} onClick={() => setMenuOpen(false)}>
          Mi perfil
        </NavLink>
      )}
      {!user && (
        <NavLink to="/login" className={linkCls} onClick={() => setMenuOpen(false)}>
          Ingresar
        </NavLink>
      )}
      {!user && (
        <NavLink to="/registro" className={linkCls} onClick={() => setMenuOpen(false)}>
          Registrarse
        </NavLink>
      )}
    </>
  );

  return (
    <nav className="sticky top-0 z-[500] border-b-[3px] border-[var(--gold)] bg-[var(--ground)] shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
      <div className="mx-auto flex max-w-[1160px] items-center gap-3 px-4 py-3 sm:px-5">
        <NavLink to="/" className="brand flex-1" onClick={() => setMenuOpen(false)}>
          <span className="dot">✓</span> Oficios Validados
        </NavLink>

        {/* Nav inline — visible desde tablet/desktop en adelante */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems}
          {user && (
            <>
              <span className="muted px-2 text-sm">{user.name}</span>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="rounded-full px-4 py-2.5 text-[15px] font-semibold text-[var(--muted-on-dark)] transition-colors hover:bg-white/10 hover:text-[var(--gold-bright)]"
              >
                Salir
              </button>
            </>
          )}
        </div>

        {/* Botón hamburguesa — visible por default en mobile/tablet chico */}
        <button
          type="button"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[var(--gold-bright)] transition-colors hover:bg-white/10 md:hidden"
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-drawer"
          onClick={() => setMenuOpen(true)}
        >
          <HamburgerIcon />
        </button>
      </div>

      {/* Drawer mobile — desliza desde la derecha, con X para cerrar (estilo X/Twitter) */}
      <div
        className={`fixed inset-0 z-[600] md:hidden ${menuOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!menuOpen}
      >
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMenuOpen(false)}
        />
        <div
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className={`absolute right-0 top-0 flex h-full w-[82vw] max-w-[320px] flex-col gap-1 bg-[var(--ground)] px-4 pb-6 pt-4 shadow-2xl transition-transform duration-300 ease-out ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[2px] text-[var(--muted-on-dark)]">
              Menú
            </span>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--gold-bright)] transition-colors hover:bg-white/10"
              aria-label="Cerrar menú"
              onClick={() => setMenuOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex flex-col gap-1">{navItems}</div>

          {user && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="px-4 pb-2 text-sm text-[var(--muted-on-dark)]">
                Sesión: <span className="font-semibold text-[var(--gold-bright)]">{user.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="block w-full rounded-full px-4 py-2.5 text-left text-[15px] font-semibold text-[var(--muted-on-dark)] transition-colors hover:bg-white/10 hover:text-[var(--gold-bright)]"
              >
                Salir
              </button>
            </div>
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
