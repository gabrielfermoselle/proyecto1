import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api } from "../services/api.js";
import { getToken } from "../utils/storage.js";
import { useAuth } from "../hooks/useAuth.js";
import ReviewForm from "../components/ReviewForm.jsx";
import { ORDER_STATUS_LABEL } from "../utils/orderStatus.js";

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

  if (error && !job) return <div className="alert error">{error}</div>;
  if (!job) return <div>Cargando…</div>;

  const isClient = user.id === job.clientId;
  const isPlumber = user.id === job.plumberUserId;
  const other = isClient ? job.plumberName : job.clientName;

  return (
    <div className="grid cols-2">
      <div className="grid" style={{ gap: 20 }}>
        <div className="card">
          <div className="spread">
            <h2 style={{ margin: 0 }}>{job.title}</h2>
            <span className={`status ${job.status}`}>{ORDER_STATUS_LABEL[job.status]}</span>
          </div>
          <p className="muted">{isClient ? `Con ${other} (plomero)` : `Con ${other} (cliente)`}</p>
          <p>{job.description || "Sin detalles."}</p>
          {job.agreedPrice != null && (
            <p className="tag-price" style={{ fontSize: 18 }}>Presupuesto acordado: ${job.agreedPrice}</p>
          )}

          {error && <div className="alert error">{error}</div>}
          {msg && <div className="alert ok">{msg}</div>}

          <hr className="sep" />

          {/* Acciones del plomero */}
          {isPlumber && (
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
                <div className="row">
                  <button className="btn" onClick={() => changeStatus("started")}>Iniciar trabajo</button>
                  <button className="btn danger" onClick={() => changeStatus("cancelled")}>Cancelar</button>
                </div>
              )}
              {job.status === "started" && (
                <div className="row">
                  <button className="btn success" onClick={() => changeStatus("completed")}>Finalizar trabajo</button>
                  <button className="btn danger" onClick={() => changeStatus("cancelled")}>Cancelar</button>
                </div>
              )}
            </div>
          )}

          {/* Acciones del cliente */}
          {isClient && (
            <div className="grid" style={{ gap: 12 }}>
              {(job.status === "requested" || job.status === "accepted" || job.status === "started") && (
                <button className="btn danger" onClick={() => changeStatus("cancelled")}>Cancelar contratación</button>
              )}
              {job.status === "started" && (
                <p className="muted" style={{ margin: 0 }}>
                  El plomero está trabajando en tu pedido. Cuando termine, lo va a marcar como finalizado.
                </p>
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
              <ReviewForm
                jobId={id}
                plumberId={job.plumberId}
                onSubmitted={() => {
                  setMsg("¡Gracias por tu reseña!");
                  loadJob();
                }}
              />
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
