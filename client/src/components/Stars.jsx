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

export function StarsInput({ value, onChange }) {
  return (
    <div className="star-input">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={n <= value ? "on" : ""}
          onClick={() => onChange(n)}
          role="button"
        >
          ★
        </span>
      ))}
    </div>
  );
}
