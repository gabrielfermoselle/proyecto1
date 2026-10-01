import { useAuth } from "../hooks/useAuth.js";
import MisSolicitudes from "./MisSolicitudes.jsx";
import MisFletes from "./MisFletes.jsx";

export default function Panel() {
  const { rol } = useAuth();
  return rol === "fletero" ? <MisFletes /> : <MisSolicitudes />;
}
