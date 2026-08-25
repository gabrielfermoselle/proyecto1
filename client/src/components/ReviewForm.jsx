import { useState } from "react";
import { api } from "../services/api.js";

const MAX_COMMENT = 500;
const RATING_HINTS = {
  1: "Muy insatisfecho",
  2: "Insatisfecho",
  3: "Correcto",
  4: "Muy bueno",
  5: "Excelente"
};

// Estrellas seleccionables con preview al pasar el mouse/teclado.
function StarPicker({ value, hovered, onHover, onPick }) {
  const shown = hovered || value;
  return (
    <div className="review-star-picker" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} estrella${n > 1 ? "s" : ""}${RATING_HINTS[n] ? ` – ${RATING_HINTS[n]}` : ""}`}
          className={`review-star ${n <= shown ? "on" : ""}`}
          onMouseEnter={() => onHover(n)}
          onMouseLeave={() => onHover(0)}
          onFocus={() => onHover(n)}
          onBlur={() => onHover(0)}
          onClick={() => onPick(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * Formulario de reseña (1-5 estrellas + comentario).
 * Se muestra únicamente cuando el pedido está finalizado y aún no fue reseñado.
 * Al confirmar el envío, notifica a onSubmitted con la reseña creada.
 */
export default function ReviewForm({ jobId, plumberId, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const ratingMissing = touched && rating === 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setError("");
    if (rating === 0) return;

    setSubmitting(true);
    try {
      const review = await api.post("/reviews", {
        jobId,
        rating,
        comment: comment.trim()
      });
      setDone(true);
      window.dispatchEvent(
        new CustomEvent("review:created", { detail: { plumberId, review } })
      );
      onSubmitted?.(review);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="review-done" role="status">
        <span className="review-done-badge">✓</span>
        <div>
          <strong>¡Gracias por tu reseña!</strong>
          <p className="muted" style={{ margin: "2px 0 0" }}>
            Ya se publicó en el perfil del profesional.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label>Calificación</label>
        <StarPicker
          value={rating}
          hovered={hovered}
          onHover={setHovered}
          onPick={(n) => {
            setRating(n);
            setError("");
          }}
        />
        <div className={`review-rating-hint ${ratingMissing ? "is-error" : ""}`}>
          {rating > 0
            ? RATING_HINTS[hovered || rating]
            : ratingMissing
            ? "Elegí una calificación para continuar"
            : "Tocá una estrella para calificar"}
        </div>
      </div>

      <div className="field">
        <label htmlFor="review-comment">Comentario</label>
        <textarea
          id="review-comment"
          value={comment}
          maxLength={MAX_COMMENT}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Contá cómo fue tu experiencia: puntualidad, calidad del trabajo, trato…"
        />
        <div className="review-char-count muted">
          {comment.length}/{MAX_COMMENT}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? (
          <>
            <span className="spinner" style={{ borderTopColor: "var(--paper)" }} />
            Publicando…
          </>
        ) : (
          "Publicar reseña"
        )}
      </button>
    </form>
  );
}
