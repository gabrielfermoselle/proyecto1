export function StarsDisplay({ value = 0, count }) {
  const full = Math.round(value);
  return (
    <span className="rating-line">
      <span className="stars">
        {"★".repeat(full)}
        {"☆".repeat(5 - full)}
      </span>
      <span className="muted">
        {value > 0 ? value.toFixed(1) : "Sin reseñas"}
        {count != null && value > 0 ? ` (${count})` : ""}
      </span>
    </span>
  );
}
