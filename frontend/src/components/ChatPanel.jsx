import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "../services/api.js";
import { getToken } from "../utils/storage.js";
import { useAuth } from "../hooks/useAuth.js";
import { imagenADataUrl } from "../utils/imagenes.js";
import { useToast } from "../context/ToastContext.jsx";
import { CameraIcon } from "./Icons.jsx";

// Chat interno cliente ↔ fletero de una solicitud: mensajes y fotos en tiempo real.
export default function ChatPanel({ solicitudId, fleteroId, otroNombre }) {
  const { usuario } = useAuth();
  const toast = useToast();
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const socketRef = useRef(null);
  const logRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setMensajes([]);
    api.get(`/mensajes/${solicitudId}/${fleteroId}`, { silent: true }).then(setMensajes).catch(() => {});
    const socket = io("/", { auth: { token: getToken() } });
    socketRef.current = socket;
    socket.emit("chat:join", { solicitudId, fleteroId });
    socket.on("chat:message", (m) => {
      if (m.solicitudId === solicitudId && m.fleteroId === fleteroId) {
        setMensajes((prev) => [...prev, m]);
      }
    });
    return () => socket.disconnect();
  }, [solicitudId, fleteroId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [mensajes]);

  function enviar(e) {
    e.preventDefault();
    const cuerpo = texto.trim();
    if (!cuerpo) return;
    socketRef.current.emit("chat:message", { solicitudId, fleteroId, cuerpo });
    setTexto("");
  }

  async function enviarFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const imagenUrl = await imagenADataUrl(file);
      socketRef.current.emit("chat:message", { solicitudId, fleteroId, imagenUrl });
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <div className="chat">
        <div className="chat-log" ref={logRef}>
          {mensajes.length === 0 && (
            <div className="empty">Sin mensajes.</div>
          )}
          {mensajes.map((m) => (
            <div key={m.id} className={`bubble ${m.remitenteId === usuario.id ? "me" : "them"}`}>
              {m.remitenteId !== usuario.id && <div className="who">{m.remitenteNombre || otroNombre}</div>}
              {m.imagenUrl && (
                <a href={m.imagenUrl} target="_blank" rel="noreferrer">
                  <img className="bubble-img" src={m.imagenUrl} alt="Foto enviada" />
                </a>
              )}
              {m.cuerpo}
            </div>
          ))}
        </div>
        <form className="chat-input" onSubmit={enviar}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => fileRef.current?.click()}
            aria-label="Enviar foto"
          >
            <CameraIcon />
          </button>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí un mensaje…" />
          <button className="btn">Enviar</button>
        </form>
        <input ref={fileRef} type="file" accept="image/*" onChange={enviarFoto} hidden />
      </div>
    </div>
  );
}
