import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./Icons.jsx";

export default function Modal({ onClose, onRequestClose, title, eyebrow, children, wide }) {
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);

  function requestClose() {
    if (closing) return;
    if (onRequestClose && !onRequestClose()) return;
    setClosing(true);
    window.setTimeout(onClose, 450);
  }

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className={`modal-veil ${closing ? "is-closing" : "is-open"}`}>
      <div className="modal-bloom" />
      <div className="modal-backdrop" onClick={requestClose} />
      <div
        className={`modal-panel ${wide ? "wide" : ""}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-panel-glow" aria-hidden="true" />
        <div className="modal-head">
          <div>
            {eyebrow && <div className="modal-eyebrow">{eyebrow}</div>}
            {title && <h2 className="modal-title">{title}</h2>}
          </div>
          <button type="button" className="modal-close" onClick={requestClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
