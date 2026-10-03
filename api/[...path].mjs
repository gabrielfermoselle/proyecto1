import app from "../backend/src/app.js";

// Vercel a veces entrega /fleteros en vez de /api/fleteros. Express espera el prefijo /api.
function apiUrl(req) {
  const raw = req.url || "/";
  const absolute = raw.startsWith("http://") || raw.startsWith("https://");
  const parsed = absolute ? new URL(raw) : null;
  const path = parsed ? parsed.pathname : raw.split("?")[0];
  const search = parsed ? parsed.search : raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
  if (path === "/api" || path.startsWith("/api/")) return `${path}${search}`;

  const slug = req.query?.path ?? req.query?.slug;
  const parts = Array.isArray(slug) ? slug : typeof slug === "string" && slug ? [slug] : [];
  const base = parts.length ? `/api/${parts.join("/")}` : `/api${path === "/" ? "" : path}`;
  if (search) return `${base}${search}`;

  if (req.query && typeof req.query === "object") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key === "path" || key === "slug") continue;
      if (Array.isArray(value)) value.forEach((item) => params.append(key, String(item)));
      else if (value != null) params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) return `${base}?${qs}`;
  }
  return base;
}

export default function handler(req, res) {
  req.url = apiUrl(req);
  return app(req, res);
}
