import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/panel");
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
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
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
