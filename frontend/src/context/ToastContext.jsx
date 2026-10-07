import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerToastNotifier } from "../services/api.js";

const ToastContext = createContext(null);
const AUTO_DISMISS_MS = 5000;

const KIND_STYLE = {
  error: { icon: "✕", classes: "border-[var(--danger)] text-[var(--danger)]" },
  success: { icon: "✓", classes: "border-[var(--line-strong)]" },
  info: { icon: "i", classes: "border-[var(--line-strong)]" }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, kind = "info") => {
      if (!message) return;
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, kind }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const api = useRef({
    error: (msg) => push(msg, "error"),
    success: (msg) => push(msg, "success"),
    info: (msg) => push(msg, "info")
  }).current;

  // El interceptor de axios (fuera del árbol de React) reporta errores acá.
  useEffect(() => {
    registerToastNotifier((msg) => api.error(msg));
    return () => registerToastNotifier(null);
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[1200] flex flex-col items-stretch gap-2 p-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end sm:p-0"
          role="region"
          aria-label="Notificaciones"
        >
          {toasts.map((t) => {
            const style = KIND_STYLE[t.kind] || KIND_STYLE.info;
            return (
              <div
                key={t.id}
                role={t.kind === "error" ? "alert" : "status"}
                className={`toast-in pointer-events-auto flex w-full items-start gap-3 rounded border bg-white px-4 py-3 text-sm sm:w-80 ${style.classes}`}
              >
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center text-[11px] font-bold" aria-hidden="true">
                  {style.icon}
                </span>
                <span className="flex-1 leading-snug">{t.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Cerrar notificación"
                  className="flex-none text-base leading-none opacity-60 transition hover:opacity-100"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
