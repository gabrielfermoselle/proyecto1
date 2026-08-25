import axios from "axios";
import { getToken, setToken } from "../utils/storage.js";

const http = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" }
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// El ToastProvider se registra acá para poder avisar errores de red desde
// este módulo (fuera del árbol de React) sin acoplar api.js a React.
let notifyError = null;
export function registerToastNotifier(fn) {
  notifyError = fn;
}

http.interceptors.response.use(
  (response) => {
    const contentType = response.headers?.["content-type"] || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Backend no disponible");
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      setToken(null);
    }
    const message = error.response?.data?.error || error.message || "Error de servidor";
    // Las llamadas marcadas { silent: true } manejan su propio error inline
    // (p. ej. el estado vacío de una página) y no necesitan además un toast.
    if (!error.config?.silent && notifyError) notifyError(message);
    return Promise.reject(new Error(message));
  }
);

export const api = {
  get: (path, config) => http.get(path, config).then((res) => res.data),
  post: (path, body, config) => http.post(path, body, config).then((res) => res.data),
  put: (path, body, config) => http.put(path, body, config).then((res) => res.data),
  patch: (path, body, config) => http.patch(path, body, config).then((res) => res.data)
};

export default http;
