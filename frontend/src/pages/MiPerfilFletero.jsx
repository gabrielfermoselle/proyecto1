import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import FleteroPerfilView from "../components/FleteroPerfilView.jsx";
import { EditIcon } from "../components/Icons.jsx";
import { SkeletonProfile } from "../components/Skeleton.jsx";

export default function MiPerfilFletero() {
  const { fleteroId } = useAuth();
  const location = useLocation();
  const [fletero, setFletero] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!fleteroId) return undefined;
    const cargar = () =>
      api.get(`/fleteros/${fleteroId}`, { silent: true }).then(setFletero).catch((e) => setError(e.message));
    cargar();
    // El modal de edición se abre sobre esta página: al guardar avisa para refrescar.
    window.addEventListener("perfil:actualizado", cargar);
    return () => window.removeEventListener("perfil:actualizado", cargar);
  }, [fleteroId]);

  if (error) return <div className="alert error">{error}</div>;
  if (!fletero) return <SkeletonProfile />;

  return (
    <div>
      <div className="spread panel-header">
        <h2 className="section-title" style={{ margin: 0 }}>Mi perfil</h2>
        <Link to="/mi-perfil" state={{ background: location }} className="btn gold panel-edit-btn">
          <EditIcon /> Editar perfil y vehículo
        </Link>
      </div>
      {fletero.latitud == null && (
        <div className="alert info" style={{ marginBottom: 16 }}>
          Falta marcar tu ubicación en "Zona de trabajo".
        </div>
      )}
      <FleteroPerfilView fletero={fletero} />
    </div>
  );
}
