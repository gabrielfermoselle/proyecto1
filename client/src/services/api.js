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
    return Promise.reject(new Error(message));
  }
);

export const api = {
  get: (path) => http.get(path).then((res) => res.data),
  post: (path, body) => http.post(path, body).then((res) => res.data),
  put: (path, body) => http.put(path, body).then((res) => res.data),
  patch: (path, body) => http.patch(path, body).then((res) => res.data)
};

export default http;
