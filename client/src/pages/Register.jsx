import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import AuthLayout from "../components/AuthLayout.jsx";
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  UserIcon,
  PhoneIcon,
  WrenchIcon,
  HomeIcon
} from "../components/Icons.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    role: "client",
    specialty: "",
    coverageKm: "10"
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setRole = (role) => setForm({ ...form, role });

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "El nombre es obligatorio.";
    if (!form.email.trim()) errs.email = "El email es obligatorio.";
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = "Ingresá un email válido.";
    if (!form.password) errs.password = "La contraseña es obligatoria.";
    else if (form.password.length < 6) errs.password = "Debe tener al menos 6 caracteres.";
    if (form.confirmPassword !== form.password) errs.confirmPassword = "Las contraseñas no coinciden.";
    if (form.role === "worker") {
      if (!form.specialty.trim()) errs.specialty = "Indicá tu especialidad (ej. Plomería).";
      const radius = Number(form.coverageKm);
      if (!form.coverageKm || Number.isNaN(radius) || radius <= 0) {
        errs.coverageKm = "Ingresá un radio de trabajo válido (en km).";
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        role: form.role
      };
      if (form.role === "worker") {
        payload.specialty = form.specialty.trim();
        payload.coverageKm = Number(form.coverageKm);
      }
      const user = await register(payload);
      navigate(user.role === "worker" ? "/mi-perfil" : "/panel");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Creá tu cuenta" subtitle="Sumate como cliente para contratar, o como trabajador para ofrecer tu oficio.">
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label>¿Cómo querés usar la plataforma?</label>
          <div className="role-select">
            <button
              type="button"
              className={`role-option ${form.role === "client" ? "active" : ""}`}
              onClick={() => setRole("client")}
            >
              <HomeIcon />
              <div className="title">Cliente</div>
              <div className="desc">Busco contratar un servicio</div>
            </button>
            <button
              type="button"
              className={`role-option ${form.role === "worker" ? "active" : ""}`}
              onClick={() => setRole("worker")}
            >
              <WrenchIcon />
              <div className="title">Trabajador</div>
              <div className="desc">Ofrezco mi oficio</div>
            </button>
          </div>
        </div>

        <div className="field">
          <label>Nombre completo</label>
          <div className={`input-wrap ${fieldErrors.name ? "has-error" : ""}`}>
            <span className="input-icon"><UserIcon /></span>
            <input value={form.name} onChange={set("name")} placeholder="Nombre y apellido" autoComplete="name" />
          </div>
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>

        <div className="field">
          <label>Email</label>
          <div className={`input-wrap ${fieldErrors.email ? "has-error" : ""}`}>
            <span className="input-icon"><MailIcon /></span>
            <input value={form.email} onChange={set("email")} type="email" placeholder="tu@email.com" autoComplete="email" />
          </div>
          {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
        </div>

        <div className="field">
          <label>Teléfono <span className="muted">(privado, no se muestra públicamente)</span></label>
          <div className="input-wrap">
            <span className="input-icon"><PhoneIcon /></span>
            <input value={form.phone} onChange={set("phone")} placeholder="099 123 456" autoComplete="tel" />
          </div>
        </div>

        <div className="grid cols-2" style={{ gap: 14 }}>
          <div className="field">
            <label>Contraseña</label>
            <div className={`input-wrap ${fieldErrors.password ? "has-error" : ""}`}>
              <span className="input-icon"><LockIcon /></span>
              <input
                value={form.password}
                onChange={set("password")}
                type={showPassword ? "text" : "password"}
                className="with-toggle"
                placeholder="Mín. 6 caracteres"
                autoComplete="new-password"
              />
              <button type="button" className="input-toggle" onClick={() => setShowPassword((v) => !v)} aria-label="Mostrar u ocultar contraseña">
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
          </div>
          <div className="field">
            <label>Confirmar contraseña</label>
            <div className={`input-wrap ${fieldErrors.confirmPassword ? "has-error" : ""}`}>
              <span className="input-icon"><LockIcon /></span>
              <input
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                type={showConfirm ? "text" : "password"}
                className="with-toggle"
                placeholder="Repetí tu contraseña"
                autoComplete="new-password"
              />
              <button type="button" className="input-toggle" onClick={() => setShowConfirm((v) => !v)} aria-label="Mostrar u ocultar contraseña">
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {fieldErrors.confirmPassword && <div className="field-error">{fieldErrors.confirmPassword}</div>}
          </div>
        </div>

        {form.role === "worker" && (
          <div className="worker-fields">
            <div className="worker-fields-title"><WrenchIcon /> Datos de tu oficio</div>
            <div className="grid cols-2" style={{ gap: 14 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Especialidad</label>
                <input value={form.specialty} onChange={set("specialty")} placeholder="Plomería, Electricidad…" />
                {fieldErrors.specialty && <div className="field-error">{fieldErrors.specialty}</div>}
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Radio de trabajo (km)</label>
                <input value={form.coverageKm} onChange={set("coverageKm")} type="number" min="1" />
                {fieldErrors.coverageKm && <div className="field-error">{fieldErrors.coverageKm}</div>}
              </div>
            </div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Después de crear la cuenta vas a poder sumar foto, portafolio y tu ubicación exacta en el mapa.
            </p>
          </div>
        )}

        <button className="btn block" disabled={busy}>
          {busy ? "Creando…" : "Crear cuenta"}
        </button>
      </form>

      <p className="auth-switch">
        ¿Ya tenés cuenta? <Link className="link" to="/login">Ingresá</Link>
      </p>
    </AuthLayout>
  );
}
