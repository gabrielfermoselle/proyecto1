import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workerId, setWorkerId] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get("/auth/me");
      setUser(data.user);
      setWorkerId(data.workerId);
    } catch {
      setToken(null);
      setUser(null);
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
    await refresh();
    return data.user;
  }

  async function register(payload) {
    const data = await api.post("/auth/register", payload);
    setToken(data.token);
    await refresh();
    return data.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
    setWorkerId(null);
  }

  return (
    <AuthContext.Provider value={{ user, workerId, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
