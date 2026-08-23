import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Landing from "./pages/Landing.jsx";
import Directory from "./pages/Directory.jsx";
import PlumberProfile from "./pages/PlumberProfile.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import JobDetail from "./pages/JobDetail.jsx";
import EditPlumberProfile from "./pages/EditPlumberProfile.jsx";
import { useAuth } from "./hooks/useAuth.js";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <div className="container">
        <Routes>
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
            path="/mi-perfil"
            element={
              <Protected>
                <EditPlumberProfile />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}
