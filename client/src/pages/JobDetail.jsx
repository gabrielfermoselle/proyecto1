import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api, getToken } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { StarsInput } from "../components/Stars.jsx";

const STATUS_LABEL = {
  requested: "Solicitado",
  accepted: "Aceptado",
  completed: "Completado",
  cancelled: "Cancelado"
};

export default function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const socketRef = useRef(null);
  const logRef = useRef(null);

  const [price, setPrice] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  async function loadJob() {
    try {
      const j = await api.get(`/jobs/${id}`);
      setJob(j);
      if (j.agreedPrice != null) setPrice(j.agreedPrice);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadJob();
    api.get(`/messages/${id}`).then(setMessages).catch(() => {});
  }, [id]);

  // Conexión de chat en tiempo real (Socket.io).
  useEffect(() => {
    const socket = io("/", { auth: { token: getToken() } });
    socketRef.current = socket;
    socket.emit("chat:join", id);
    socket.on("chat:message", (m) => {
      if (m.jobId === id) setMessages((prev) => [...prev, m]);
    });
    return () => socket.disconnect();
  }, [id]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    socketRef.current.emit("chat:message", { jobId: id, body });
    setText("");
  }

  async function changeStatus(status) {
    setError("");
    try {
      const j = await api.patch(`/jobs/${id}/status`, { status });
      setJob(j);
    } catch (e) {
      setError(e.message);
    }
  }

  async function savePrice(e) {
    e.preventDefault();
    setError("");
    try {
      const j = await api.patch(`/jobs/${id}/price`, { agreedPrice: price });
      setJob(j);
      setMsg("Presupuesto actualizado.");
    } catch (e) {
      setError(e.message);
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/reviews", { jobId: id, rating, comment });
      setMsg("¡Gracias por tu reseña!");
      await loadJob();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !job) return <div className="alert error">{error}</div>;
  if (!job) return <div>Cargando…</div>;

  const isClient = user.id === job.clientId;
  const isWorker = user.id === job.workerUserId;
  const other = isClient ? job.workerName : job.clientName;

  return (
    <div className="grid cols-2">
      <div className="grid" style={{ gap: 20 }}>
        <div className="card">
          <div className="spread">
            <h2 style={{ margin: 0 }}>{job.title}</h2>
            <span className={`status ${job.status}`}>{STATUS_LABEL[job.status]}</span>
          </div>
          <p className="muted">{isClient ? `Con ${other} (trabajador)` : `Con ${other} (cliente)`}</p>
          <p>{job.description || "Sin detalles."}</p>
          {job.agreedPrice != null && (
            <p className="tag-price" style={{ fontSize: 18 }}>Presupuesto acordado: ${job.agreedPrice}</p>
          )}

          {error && <div className="alert error">{error}</div>}
          {msg && <div className="alert ok">{msg}</div>}

          <hr className="sep" />

          {/* Acciones del trabajador */}
          {isWorker && (
            <div className="grid" style={{ gap: 12 }}>
              {job.status === "requested" && (
                <div className="row">
                  <button className="btn success" onClick={() => changeStatus("accepted")}>Aceptar trabajo</button>
                  <button className="btn danger" onClick={() => changeStatus("cancelled")}>Rechazar</button>
                </div>
              )}
              {(job.status === "requested" || job.status === "accepted") && (
                <form className="row" onSubmit={savePrice}>
                  <div style={{ flex: 1 }}>
                    <label>Presupuesto acordado ($)</label>
                    <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </div>
                  <button className="btn ghost" style={{ alignSelf: "flex-end" }}>Guardar</button>
                </form>
              )}
              {job.status === "accepted" && (
                <button className="btn" onClick={() => changeStatus("completed")}>Marcar como completado</button>
              )}
            </div>
          )}

          {/* Acciones del cliente */}
          {isClient && (
            <div className="grid" style={{ gap: 12 }}>
              {(job.status === "requested" || job.status === "accepted") && (
                <button className="btn danger" onClick={() => changeStatus("cancelled")}>Cancelar contratación</button>
              )}
              {job.status === "accepted" && (
                <button className="btn" onClick={() => changeStatus("completed")}>
                  Confirmar trabajo completado
                </button>
              )}
            </div>
          )}
        </div>

        {/* Reseña: SOLO cliente + trabajo completado + no reseñado */}
        {isClient && job.status === "completed" && (
          <div className="card">
            <h3>Dejá tu reseña</h3>
            {job.reviewed ? (
              <div className="alert ok">Ya reseñaste este trabajo. ¡Gracias!</div>
            ) : (
              <form onSubmit={submitReview}>
                <div className="field">
                  <label>Calificación</label>
                  <StarsInput value={rating} onChange={setRating} />
                </div>
                <div className="field">
                  <label>Comentario</label>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="¿Cómo fue tu experiencia?" />
                </div>
                <button className="btn">Publicar reseña</button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Chat en tiempo real */}
      <div className="card">
        <h3>Chat con {other}</h3>
        <div className="privacy-note">
          🔒 Coordiná el presupuesto por acá. Tus datos de contacto (email y teléfono) no se comparten.
        </div>
        <div className="chat">
          <div className="chat-log" ref={logRef}>
            {messages.length === 0 && <div className="empty">Todavía no hay mensajes. ¡Escribí el primero!</div>}
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.senderId === user.id ? "me" : "them"}`}>
                {m.senderId !== user.id && <div className="who">{m.senderName || other}</div>}
                {m.body}
              </div>
            ))}
          </div>
          <form className="chat-input" onSubmit={send}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí un mensaje…" />
            <button className="btn">Enviar</button>
          </form>
        </div>
      </div>
    </div>
  );
}
