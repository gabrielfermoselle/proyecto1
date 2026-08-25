import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Modal from "./components/Modal.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import Landing from "./pages/Landing.jsx";
import Directory from "./pages/Directory.jsx";
import PlumberProfile from "./pages/PlumberProfile.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import JobDetail from "./pages/JobDetail.jsx";
import EditPlumberProfile from "./pages/EditPlumberProfile.jsx";
import MyPlumberProfile from "./pages/MyPlumberProfile.jsx";
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

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
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
    else navigate("/mi-perfil-plomero", { replace: true });
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
      <Modal onClose={close} onRequestClose={requestClose} eyebrow="Mi perfil" title="Editar perfil de plomero" wide>
        {(animateClose) => {
          animateCloseRef.current = animateClose;
          return <EditPlumberProfile onDone={handleCancel} onDirtyChange={setDirty} />;
        }}
      </Modal>
      {confirmOpen && (
        <ConfirmDialog onCancel={() => setConfirmOpen(false)} onConfirm={confirmExit} />
      )}
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
        <div
          className={`route-transition ${leaving ? "is-leaving" : ""}`}
          key={renderedLocation.pathname}
        >
          <Routes location={renderedLocation}>
            <Route path="/" element={<Landing />} />
            <Route path="/directorio" element={<Directory />} />
            <Route path="/plomero/:id" element={<PlumberProfile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route
              path="/panel"
              element={
                <Protected>
                  <Dashboard />
                </Protected>
              }
            />
            <Route
              path="/trabajo/:id"
              element={
                <Protected>
                  <JobDetail />
                </Protected>
              }
            />
            <Route
              path="/mi-perfil-plomero"
              element={
                <Protected>
                  <MyPlumberProfile />
                </Protected>
              }
            />
            <Route
              path="/mi-perfil"
              element={
                <Protected>
                  <EditProfileModalRoute />
                </Protected>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      {background && (
        <Routes>
          <Route
            path="/mi-perfil"
            element={
              <Protected>
                <EditProfileModalRoute />
              </Protected>
            }
          />
        </Routes>
      )}
    </>
  );
}
