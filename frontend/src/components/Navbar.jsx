import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { HamburgerIcon, CloseIcon } from "./Icons.jsx";

const linkCls = ({ isActive }) =>
  `block px-3 py-2 text-[15px] ${isActive ? "font-semibold underline underline-offset-4" : "hover:underline"}`;

export default function Navbar() {
  const { usuario, rol, logout } = useAuth();
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

  const close = () => setMenuOpen(false);
  const navItems = (
    <>
      <NavLink to="/fleteros" className={linkCls} onClick={close}>
        Fleteros
      </NavLink>
      {rol === "cliente" && (
        <NavLink to="/solicitudes/nueva" className={linkCls} onClick={close}>
          Publicar flete
        </NavLink>
      )}
      {rol === "fletero" && (
        <NavLink to="/disponibles" className={linkCls} onClick={close}>
          Solicitudes cerca
        </NavLink>
      )}
      {usuario && (
        <NavLink to="/panel" className={linkCls} onClick={close}>
          {rol === "fletero" ? "Mis fletes" : "Mis solicitudes"}
        </NavLink>
      )}
      {rol === "fletero" && (
        <NavLink to="/mi-perfil-fletero" className={linkCls} onClick={close}>
          Mi perfil
        </NavLink>
      )}
      {!usuario && (
        <NavLink to="/login" className={linkCls} onClick={close}>
          Ingresar
        </NavLink>
      )}
      {!usuario && (
        <NavLink to="/registro" className={linkCls} onClick={close}>
          Registrarse
        </NavLink>
      )}
    </>
  );

  return (
    <nav className="sticky top-0 z-[500] bg-[var(--ink-bg)] text-[var(--on-ink)]">
      <div className="mx-auto flex max-w-[1160px] items-center gap-3 px-4 py-3 sm:px-5">
        <NavLink to="/" className="brand flex-1" onClick={() => setMenuOpen(false)}>
          <span className="dot">⇄</span> Fletes Tucumán
        </NavLink>

        {/* Nav inline — visible desde tablet/desktop en adelante */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems}
          {usuario && (
            <>
              <span className="px-2 text-sm text-[var(--on-ink-muted)]">{usuario.nombre}</span>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="px-3 py-2 text-[15px] hover:underline"
              >
                Salir
              </button>
            </>
          )}
        </div>

        {/* Botón hamburguesa — visible por default en mobile/tablet chico */}
        <button
          type="button"
          className="flex h-11 w-11 flex-none items-center justify-center md:hidden"
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
          className={`absolute right-0 top-0 flex h-full w-[82vw] max-w-[320px] flex-col gap-1 bg-[var(--ink-bg)] px-4 pb-6 pt-4 text-[var(--on-ink)] transition-transform duration-300 ease-out ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Menú</span>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center"
              aria-label="Cerrar menú"
              onClick={() => setMenuOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex flex-col gap-1">{navItems}</div>

          {usuario && (
            <div className="mt-4 border-t border-[var(--ink-line)] pt-4">
              <div className="px-3 pb-2 text-sm text-[var(--on-ink-muted)]">
                Sesión: <span className="font-semibold">{usuario.nombre}</span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="block w-full px-3 py-2 text-left text-[15px] hover:underline"
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
