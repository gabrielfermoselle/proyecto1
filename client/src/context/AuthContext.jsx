import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api.js";
import { getToken, setToken, getStoredUser, setStoredUser } from "../utils/storage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [plumberId, setPlumberId] = useState(null);
  const [loading, setLoading] = useState(true);

  function persistUser(nextUser) {
    setUser(nextUser);
    setStoredUser(nextUser);
  }

  async function refresh() {
    if (!getToken()) {
      persistUser(null);
      setPlumberId(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get("/auth/me");
      persistUser(data.user);
      setPlumberId(data.plumberId);
    } catch {
      setToken(null);
      persistUser(null);
      setPlumberId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(email, password) {
    const data = await api.post("/auth/login", { email, password });
    setToken(data.token);
    persistUser(data.user);
    await refresh();
    return data.user;
  }

  async function register(payload) {
    const data = await api.post("/auth/register", payload);
    setToken(data.token);
    persistUser(data.user);
    await refresh();
    return data.user;
  }

  function logout() {
    setToken(null);
    persistUser(null);
    setPlumberId(null);
  }

  const value = {
    user,
    role: user?.role ?? null,
    plumberId,
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
