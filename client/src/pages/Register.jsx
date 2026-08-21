import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

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
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

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
    <div className="center-narrow">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Crear cuenta</h2>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label>¿Cómo querés usar la plataforma?</label>
            <select value={form.role} onChange={set("role")}>
              <option value="client">Busco contratar un servicio (Cliente)</option>
              <option value="worker">Ofrezco mi oficio (Trabajador)</option>
            </select>
          </div>
          <div className="field">
            <label>Nombre completo</label>
            <input value={form.name} onChange={set("name")} />
            {fieldErrors.name && <div className="alert error" style={{ marginTop: 6 }}>{fieldErrors.name}</div>}
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={set("email")} type="email" />
            {fieldErrors.email && <div className="alert error" style={{ marginTop: 6 }}>{fieldErrors.email}</div>}
          </div>
          <div className="field">
            <label>Teléfono (privado, no se muestra públicamente)</label>
            <input value={form.phone} onChange={set("phone")} />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input value={form.password} onChange={set("password")} type="password" />
            {fieldErrors.password && <div className="alert error" style={{ marginTop: 6 }}>{fieldErrors.password}</div>}
          </div>
          <div className="field">
            <label>Confirmar contraseña</label>
            <input value={form.confirmPassword} onChange={set("confirmPassword")} type="password" />
            {fieldErrors.confirmPassword && (
              <div className="alert error" style={{ marginTop: 6 }}>{fieldErrors.confirmPassword}</div>
            )}
          </div>

          {form.role === "worker" && (
            <>
              <hr className="sep" />
              <div className="field">
                <label>Especialidad (ej. Plomería, Electricidad)</label>
                <input value={form.specialty} onChange={set("specialty")} placeholder="Plomería" />
                {fieldErrors.specialty && (
                  <div className="alert error" style={{ marginTop: 6 }}>{fieldErrors.specialty}</div>
                )}
              </div>
              <div className="field">
                <label>Radio de trabajo (km desde tu zona)</label>
                <input value={form.coverageKm} onChange={set("coverageKm")} type="number" min="1" />
                {fieldErrors.coverageKm && (
                  <div className="alert error" style={{ marginTop: 6 }}>{fieldErrors.coverageKm}</div>
                )}
              </div>
              <p className="muted" style={{ marginTop: -6 }}>
                Podés completar el resto de tu perfil (foto, portafolio, ubicación exacta) después de crear la cuenta.
              </p>
            </>
          )}

          <button className="btn block" disabled={busy}>
            {busy ? "Creando…" : "Crear cuenta"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>
          ¿Ya tenés cuenta? <Link className="link" to="/login">Ingresá</Link>
        </p>
      </div>
    </div>
  );
}
