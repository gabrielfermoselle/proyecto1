const precioFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0
});

export function formatPrecio(value) {
  if (value == null || value === "") return "—";
  return precioFmt.format(Number(value));
}

export function formatFecha(iso, { hora = false } = {}) {
  if (!iso) return "A coordinar";
  const d = new Date(iso);
  return hora
    ? d.toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

// Valor para <input type="datetime-local"> en hora local.
export function toDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
