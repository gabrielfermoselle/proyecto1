import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api.js";
import { getToken, setToken, getStoredUser, setStoredUser } from "../utils/storage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => getStoredUser());
  const [fleteroId, setFleteroId] = useState(null);
  const [loading, setLoading] = useState(true);

  function persistUsuario(next) {
    setUsuario(next);
    setStoredUser(next);
  }

  async function refresh() {
    if (!getToken()) {
      persistUsuario(null);
      setFleteroId(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get("/auth/me", { silent: true });
      persistUsuario(data.usuario);
      setFleteroId(data.fleteroId);
    } catch {
      setToken(null);
      persistUsuario(null);
      setFleteroId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(correo, contrasena) {
    const data = await api.post("/auth/login", { correo, contrasena });
    setToken(data.token);
    persistUsuario(data.usuario);
    await refresh();
    return data.usuario;
  }

  async function register(payload) {
    const data = await api.post("/auth/register", payload);
    setToken(data.token);
    persistUsuario(data.usuario);
    await refresh();
    return data.usuario;
  }

  function logout() {
    setToken(null);
    persistUsuario(null);
    setFleteroId(null);
  }

  const value = {
    usuario,
    rol: usuario?.rol ?? null,
    fleteroId,
    loading,
    login,
    register,
    logout,
    refresh
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
