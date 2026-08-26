import { useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../services/api.js";

export default function CreateOrderModal({ plumber, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const createdJobRef = useRef(null);

  // El pedido ya se creó en el momento del submit; recién al terminar la animación
  // de cierre navegamos, para no cortarla con un cambio de página abrupto.
  function handleClosed() {
    if (createdJobRef.current) onCreated(createdJobRef.current);
    else onClose();
  }

  async function submit(e, close) {
    e.preventDefault();
    setBusy(true);
    try {
      const job = await api.post("/jobs", { plumberId: plumber.id, title, description });
      createdJobRef.current = job;
      close();
    } catch {
      // El toast global ya avisó del error.
      setBusy(false);
    }
  }

  return (
    <Modal onClose={handleClosed} eyebrow="Nuevo pedido" title={`Solicitar a ${plumber.name}`}>
      {(close) => (
        <form onSubmit={(e) => submit(e, close)}>
          <div className="field">
            <label>¿Qué necesitás?</label>
            <input
              placeholder="Ej: Arreglo de canilla que pierde"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Descripción del problema</label>
            <textarea
              placeholder="Contá el problema, materiales, disponibilidad…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
          </div>
          <p className="muted" style={{ margin: "8px 0 18px" }}>
            Se abrirá un chat interno con el profesional para acordar el presupuesto. Tus datos de
            contacto no se comparten.
          </p>
          <div className="row">
            <button className="btn success" disabled={busy}>
              {busy ? "Enviando…" : "Enviar pedido"}
            </button>
            <button type="button" className="btn ghost" onClick={close}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
