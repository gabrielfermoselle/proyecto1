import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import AuthLayout from "../components/AuthLayout.jsx";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon } from "../components/Icons.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  function fillDemo(demoEmail) {
    setEmail(demoEmail);
    setPassword("123456");
    setFieldErrors({});
  }

  return (
    <AuthLayout title="Bienvenido de nuevo" subtitle="Ingresá para gestionar tus contrataciones o tu perfil profesional.">
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label>Email</label>
          <div className={`input-wrap ${fieldErrors.email ? "has-error" : ""}`}>
            <span className="input-icon"><MailIcon /></span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </div>
          {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
        </div>
        <div className="field">
          <label>Contraseña</label>
          <div className={`input-wrap ${fieldErrors.password ? "has-error" : ""}`}>
            <span className="input-icon"><LockIcon /></span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              className="with-toggle"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="input-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
        </div>
        <button className="btn block" disabled={busy}>
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
      </form>

      <p className="auth-switch">
        ¿No tenés cuenta? <Link className="link" to="/registro">Registrate</Link>
      </p>

      <div className="demo-box">
        <div className="demo-box-title">Cuentas de demo</div>
        <div className="demo-chips">
          <button type="button" className="demo-chip" onClick={() => fillDemo("ana@demo.com")}>
            👤 Cliente · ana@demo.com
          </button>
          <button type="button" className="demo-chip" onClick={() => fillDemo("carlos@demo.com")}>
            🔧 Trabajador · carlos@demo.com
          </button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>Clave para ambas: <b>123456</b></div>
      </div>
    </AuthLayout>
  );
}
