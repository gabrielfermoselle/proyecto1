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
  TruckIcon,
  BoxIcon
} from "../components/Icons.jsx";
import { VEHICULOS } from "../utils/catalogos.js";

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
    rol: "cliente",
    tipoVehiculo: "",
    radioTrabajoKm: "10"
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setRol = (rol) => setForm({ ...form, rol });

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "El nombre es obligatorio.";
    if (!form.email.trim()) errs.email = "El email es obligatorio.";
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = "Ingresá un email válido.";
    if (!form.password) errs.password = "La contraseña es obligatoria.";
    else if (form.password.length < 6) errs.password = "Debe tener al menos 6 caracteres.";
    if (form.confirmPassword !== form.password) errs.confirmPassword = "Las contraseñas no coinciden.";
    if (form.rol === "fletero") {
      if (!form.tipoVehiculo) errs.tipoVehiculo = "Elegí tu tipo de vehículo.";
      const radio = Number(form.radioTrabajoKm);
      if (!form.radioTrabajoKm || Number.isNaN(radio) || radio <= 0) {
        errs.radioTrabajoKm = "Ingresá un radio de trabajo válido (en km).";
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const payload = {
        nombre: form.name.trim(),
        correo: form.email.trim(),
        contrasena: form.password,
        telefono: form.phone.trim(),
        rol: form.rol
      };
      if (form.rol === "fletero") {
        payload.tipoVehiculo = form.tipoVehiculo;
        payload.radioTrabajoKm = Number(form.radioTrabajoKm);
      }
      const usuario = await register(payload);
      navigate(usuario.rol === "fletero" ? "/mi-perfil-fletero" : "/solicitudes/nueva");
    } catch {
      // El toast global ya avisó del error.
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Crear cuenta">
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label>Tipo de cuenta</label>
          <div className="role-select">
            <button
              type="button"
              className={`role-option ${form.rol === "cliente" ? "active" : ""}`}
              onClick={() => setRol("cliente")}
            >
              <BoxIcon />
              <div className="title">Cliente</div>
            </button>
            <button
              type="button"
              className={`role-option ${form.rol === "fletero" ? "active" : ""}`}
              onClick={() => setRol("fletero")}
            >
              <TruckIcon />
              <div className="title">Fletero</div>
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
          <label>Teléfono</label>
          <div className="input-wrap">
            <span className="input-icon"><PhoneIcon /></span>
            <input value={form.phone} onChange={set("phone")} placeholder="381 123 4567" autoComplete="tel" />
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

        {form.rol === "fletero" && (
          <div className="worker-fields">
            <div className="worker-fields-title"><TruckIcon /> Vehículo</div>
            <div className="grid cols-2" style={{ gap: 14 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Tipo de vehículo</label>
                <select value={form.tipoVehiculo} onChange={set("tipoVehiculo")}>
                  <option value="">Elegí uno…</option>
                  {VEHICULOS.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
                {fieldErrors.tipoVehiculo && <div className="field-error">{fieldErrors.tipoVehiculo}</div>}
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Radio de trabajo (km)</label>
                <input value={form.radioTrabajoKm} onChange={set("radioTrabajoKm")} type="number" min="1" />
                {fieldErrors.radioTrabajoKm && <div className="field-error">{fieldErrors.radioTrabajoKm}</div>}
              </div>
            </div>
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
