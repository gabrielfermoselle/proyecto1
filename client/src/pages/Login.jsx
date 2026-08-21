import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function validate() {
    const errs = {};
    if (!email.trim()) errs.email = "El email es obligatorio.";
    else if (!EMAIL_RE.test(email.trim())) errs.email = "Ingresá un email válido.";
    if (!password) errs.password = "La contraseña es obligatoria.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      navigate(user.role === "worker" ? "/mi-perfil" : "/panel");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-narrow">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Ingresar</h2>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
            {fieldErrors.email && <div className="alert error" style={{ marginTop: 6 }}>{fieldErrors.email}</div>}
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
            />
            {fieldErrors.password && <div className="alert error" style={{ marginTop: 6 }}>{fieldErrors.password}</div>}
          </div>
          <button className="btn block" disabled={busy}>
            {busy ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>
          ¿No tenés cuenta? <Link className="link" to="/registro">Registrate</Link>
        </p>
        <div className="alert info" style={{ marginTop: 6 }}>
          Demo: <b>ana@demo.com</b> (cliente) o <b>carlos@demo.com</b> (trabajador) · clave <b>123456</b>
        </div>
      </div>
    </div>
  );
}
