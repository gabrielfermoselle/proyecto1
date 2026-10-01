import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Modal from "./components/Modal.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import Fleteros from "./pages/Fleteros.jsx";
import FleteroPerfil from "./pages/FleteroPerfil.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Panel from "./pages/Panel.jsx";
import NuevaSolicitud from "./pages/NuevaSolicitud.jsx";
import SolicitudDetalle from "./pages/SolicitudDetalle.jsx";
import SolicitudesDisponibles from "./pages/SolicitudesDisponibles.jsx";
import MiPerfilFletero from "./pages/MiPerfilFletero.jsx";
import EditarPerfilFletero from "./pages/EditarPerfilFletero.jsx";
import { useAuth } from "./hooks/useAuth.js";

const ROUTE_EXIT_MS = 150;

function usePageTransition(displayLocation) {
  const [renderedLocation, setRenderedLocation] = useState(displayLocation);
  const [leaving, setLeaving] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (displayLocation.pathname === renderedLocation.pathname) {
      setRenderedLocation(displayLocation);
      return undefined;
    }
    setLeaving(true);
    timeoutRef.current = window.setTimeout(() => {
      setRenderedLocation(displayLocation);
      setLeaving(false);
    }, ROUTE_EXIT_MS);
    return () => window.clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayLocation]);

  return { renderedLocation, leaving };
}

// Inicio: cada rol arranca en su pantalla de trabajo.
function Inicio() {
  const { usuario, loading } = useAuth();
  if (loading) return null;
  if (!usuario) return <Navigate to="/fleteros" replace />;
  return <Navigate to={usuario.rol === "fletero" ? "/disponibles" : "/panel"} replace />;
}

// Exige sesión y, opcionalmente, un rol ("cliente" | "fletero").
function Protected({ rol, children }) {
  const { usuario, loading } = useAuth();
  if (loading) return <div className="container">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (rol && usuario.rol !== rol) return <Navigate to="/panel" replace />;
  return children;
}

function EditProfileModalRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const background = location.state?.background;
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Guarda la función de cierre animado que expone <Modal>, para poder dispararla
  // tanto desde el botón "Cancelar" del formulario como desde el ConfirmDialog.
  const animateCloseRef = useRef(() => {});

  function close() {
    if (background) navigate(-1);
    else navigate("/mi-perfil-fletero", { replace: true });
  }

  function requestClose() {
    if (dirty) {
      setConfirmOpen(true);
      return false;
    }
    return true;
  }

  function handleCancel() {
    if (dirty) setConfirmOpen(true);
    else animateCloseRef.current();
  }

  function confirmExit() {
    setConfirmOpen(false);
    animateCloseRef.current();
  }

  return (
    <>
      <Modal onClose={close} onRequestClose={requestClose} eyebrow="Mi perfil" title="Editar perfil de fletero" wide>
        {(animateClose) => {
          animateCloseRef.current = animateClose;
          return <EditarPerfilFletero onDone={handleCancel} onDirtyChange={setDirty} />;
        }}
      </Modal>
      {confirmOpen && <ConfirmDialog onCancel={() => setConfirmOpen(false)} onConfirm={confirmExit} />}
    </>
  );
}

export default function App() {
  const location = useLocation();
  const background = location.state?.background;
  const displayLocation = background || location;
  const { renderedLocation, leaving } = usePageTransition(displayLocation);

  return (
    <>
      <Navbar />
      <div className="container">
        <div className={`route-transition ${leaving ? "is-leaving" : ""}`} key={renderedLocation.pathname}>
          <Routes location={renderedLocation}>
            <Route path="/" element={<Inicio />} />
            <Route path="/fleteros" element={<Fleteros />} />
            <Route path="/fletero/:id" element={<FleteroPerfil />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/panel" element={<Protected><Panel /></Protected>} />
            <Route path="/solicitudes/nueva" element={<Protected rol="cliente"><NuevaSolicitud /></Protected>} />
            <Route path="/solicitud/:id" element={<Protected><SolicitudDetalle /></Protected>} />
            <Route path="/solicitud/:id/editar" element={<Protected rol="cliente"><NuevaSolicitud /></Protected>} />
            <Route path="/disponibles" element={<Protected rol="fletero"><SolicitudesDisponibles /></Protected>} />
            <Route path="/mi-perfil-fletero" element={<Protected rol="fletero"><MiPerfilFletero /></Protected>} />
            <Route path="/mi-perfil" element={<Protected rol="fletero"><EditProfileModalRoute /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      {background && (
        <Routes>
          <Route path="/mi-perfil" element={<Protected rol="fletero"><EditProfileModalRoute /></Protected>} />
        </Routes>
      )}
    </>
  );
}
