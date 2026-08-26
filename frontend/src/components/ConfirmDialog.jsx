import { useState } from "react";
import { createPortal } from "react-dom";

export default function ConfirmDialog({
  title = "¿Seguro que querés salir?",
  message = "Tenés cambios sin guardar. Si salís ahora, se van a perder.",
  confirmLabel = "Salir sin guardar",
  cancelLabel = "Seguir editando",
  onConfirm,
  onCancel
}) {
  const [closing, setClosing] = useState(false);

  function close(action) {
    if (closing) return;
    setClosing(true);
    window.setTimeout(action, 350);
  }

  return createPortal(
    <div className={`confirm-veil ${closing ? "is-closing" : ""}`} onClick={() => close(onCancel)}>
      <div
        className="confirm-panel"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="btn ghost" onClick={() => close(onCancel)}>
            {cancelLabel}
          </button>
          <button type="button" className="btn danger" onClick={() => close(onConfirm)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
