import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "client"
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await register(form);
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
        <form onSubmit={submit}>
          <div className="field">
            <label>¿Cómo querés usar la plataforma?</label>
            <select value={form.role} onChange={set("role")}>
              <option value="client">Busco contratar un servicio (Cliente)</option>
              <option value="worker">Ofrezco mi oficio (Trabajador)</option>
            </select>
          </div>
          <div className="field">
            <label>Nombre completo</label>
            <input value={form.name} onChange={set("name")} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={set("email")} type="email" required />
          </div>
          <div className="field">
            <label>Teléfono (privado, no se muestra públicamente)</label>
            <input value={form.phone} onChange={set("phone")} />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input value={form.password} onChange={set("password")} type="password" required minLength={6} />
          </div>
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
