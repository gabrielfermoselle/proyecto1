import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import FleteroPerfilView from "../components/FleteroPerfilView.jsx";
import { SkeletonProfile } from "../components/Skeleton.jsx";

export default function FleteroPerfil() {
  const { id } = useParams();
  const { usuario, rol } = useAuth();
  const [fletero, setFletero] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/fleteros/${id}`, { silent: true }).then(setFletero).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="alert error">{error}</div>;
  if (!fletero) return <SkeletonProfile />;

  const puedePublicar = !usuario || rol === "cliente";

  return (
    <FleteroPerfilView
      fletero={fletero}
      actions={
        puedePublicar && (
          <Link className="btn" to={usuario ? "/solicitudes/nueva" : "/login"}>
            Publicar flete
          </Link>
        )
      }
    />
  );
}
